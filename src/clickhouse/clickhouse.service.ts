import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ClickHouseClient, createClient } from '@clickhouse/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config/dist/config.service';
import {
  TopGene,
  TargetDiseaseAssociationTable,
  OrderByEnum,
  Pagination,
  ScoredKeyValue,
  TargetDiseaseAssociationRow,
} from '@/graphql/models';

@Injectable()
export class ClickhouseService implements OnApplicationBootstrap {
  private client: ClickHouseClient;
  private readonly logger = new Logger(ClickhouseService.name);

  constructor(private readonly configService: ConfigService) {
    this.client = createClient({
      url: this.configService.get<string>('CLICKHOUSE_URL', 'http://localhost:8123'),
      username: this.configService.get<string>('CLICKHOUSE_USER', 'default'),
      password: this.configService.get<string>('CLICKHOUSE_PASSWORD', ''),
    });
  }

  async getTopGenesByDisease(diseaseId: string, { page, limit }: Pagination): Promise<TopGene[]> {
    const query = `
      SELECT gene_name
      FROM overall_association_score
      WHERE disease_id = {diseaseId:String}
      ORDER BY score DESC
      LIMIT {limit:UInt32}
      OFFSET {offset:UInt32}
    `;
    try {
      const resultSet = await this.client.query({
        query,
        query_params: { diseaseId, limit, offset: (page - 1) * limit },
        format: 'JSONEachRow',
      });

      const genes: TopGene[] = [];

      for await (const rows of resultSet.stream<TopGene>()) {
        for (const row of rows) {
          genes.push(row.json());
        }
      }

      return genes;
    } catch (error) {
      this.logger.error('query failed', error);
      throw error;
    }
  }

  async getTargetDiseaseAssociationTable(
    geneIds: string[],
    diseaseId: string,
    orderBy: OrderByEnum,
    { page, limit }: Pagination,
  ): Promise<TargetDiseaseAssociationTable> {
    const offset = (page - 1) * limit;

    // Determine if we should order by overall score or by a specific datasource
    const orderByScore = orderBy === OrderByEnum.SCORE;

    let query: string;

    if (orderByScore) {
      // Order by overall_score
      query = `
        SELECT
          gene_id,
          gene_name,
          disease_id,
          groupArray(concat(datasource_id, ',', toString(datasource_score))) AS datasourceScores,
          overall_score,
          count() OVER () AS total_count
        FROM mv_datasource_association_score_overall_association_score
        WHERE disease_id = {diseaseId:String}
          AND gene_id IN ({geneIds:Array(String)})
        GROUP BY
          disease_id, gene_id, overall_score, gene_name
        ORDER BY
          overall_score DESC
        LIMIT {limit:UInt32}
        OFFSET {offset:UInt32}
      `;
    } else {
      // Order by specific datasource score
      query = `
        SELECT
          gene_id,
          gene_name,
          disease_id,
          maxIf(datasource_score, datasource_id = {orderBy:String}) AS datasource_order_score,
          groupArray(concat(datasource_id, ',', toString(datasource_score))) AS datasourceScores,
          overall_score,
          count() OVER () AS total_count
        FROM mv_datasource_association_score_overall_association_score
        WHERE disease_id = {diseaseId:String}
          AND gene_id IN ({geneIds:Array(String)})
        GROUP BY
          disease_id, gene_id, overall_score, gene_name
        ORDER BY
          datasource_order_score DESC
        LIMIT {limit:UInt32}
        OFFSET {offset:UInt32}
      `;
    }

    try {
      const resultSet = await this.client.query({
        query,
        query_params: {
          diseaseId,
          geneIds,
          orderBy: orderByScore ? '' : orderBy,
          limit,
          offset,
        },
        format: 'JSONEachRow',
      });

      const results: TargetDiseaseAssociationRow[] = [];
      let totalCount = 0;

      for await (const rows of resultSet.stream<{
        gene_id: string;
        gene_name: string;
        disease_id: string;
        datasourceScores: string[];
        overall_score: number;
        total_count: number;
      }>()) {
        for (const row of rows) {
          const data = row.json();

          // Get total count from the first row
          if (totalCount === 0) {
            totalCount = data.total_count;
          }

          // Transform datasourceScores from string array to object array
          const datasourceScores = data.datasourceScores.map((scoreStr: string) => {
            const [key, score] = scoreStr.split(',');
            return {
              key,
              score: Number.parseFloat(score),
            };
          });

          results.push({
            target: {
              id: data.gene_id,
              name: data.gene_name,
            },
            datasourceScores,
            overall_score: data.overall_score,
          });
        }
      }

      return {
        rows: results,
        totalCount,
      };
    } catch (error) {
      this.logger.error('targetDiseaseAssociationTable query failed', error);
      throw error;
    }
  }

  async getBatchPrioritizationTable(geneIds: string[]): Promise<Map<string, ScoredKeyValue[]>> {
    const query = `
      SELECT
        gene_id,
        \`Membrane protein\`,
        \`Secreted protein\`,
        \`Known safety events\`,
        \`Predicted pockets\`,
        \`Ligand binder\`,
        \`Small molecule binder\`,
        \`Genetic constraint\`,
        \`Paralogues\`,
        \`Mouse ortholog identity\`,
        \`Cancer driver gene\`,
        \`Gene essentiality\`,
        \`Mouse models\`,
        \`Chemical probes\`,
        \`Target in clinic\`,
        \`Tissue specificity\`,
        \`Tissue distribution\`
      FROM target_prioritization_factors
      WHERE gene_id IN ({geneIds:Array(String)})
    `;

    try {
      const resultSet = await this.client.query({
        query,
        query_params: { geneIds },
        format: 'JSONEachRow',
      });

      const resultMap = new Map<string, ScoredKeyValue[]>();

      for await (const rows of resultSet.stream<Record<string, any>>()) {
        for (const row of rows) {
          const data = row.json();
          const geneId = data.gene_id;

          // Remove gene_id from the data and convert to ScoredKeyValue array
          delete data.gene_id;

          const scoredKeyValues = Object.entries(data).map(([key, score]) => ({
            key,
            score: score as number,
          }));

          resultMap.set(geneId, scoredKeyValues);
        }
      }
      return resultMap;
    } catch (error) {
      this.logger.error('batch prioritizationTable query failed', error);
      throw error;
    }
  }

  async onApplicationBootstrap() {
    await this.#runMigrations();
  }

  async #runMigrations() {
    const migrationDir = join(process.cwd(), 'src/clickhouse/migrations');
    this.logger.log(`Looking for migrations in: ${migrationDir}`);
    let files: string[];
    try {
      files = (await fs.readdir(migrationDir)).filter((f) => f.endsWith('.sql')).sort();
    } catch (e) {
      this.logger.warn(`Migration directory not found: ${migrationDir}`);
      this.logger.debug(`Error details: ${e}`);
      return;
    }

    await this.client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS migrations (
          version String,
          applied_at DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY version
      `,
    });

    const appliedVersions = await this.#getAppliedMigrations();

    for (const file of files) {
      const version = file.split('_')[0];
      if (!appliedVersions.includes(version)) {
        const sql = await fs.readFile(join(migrationDir, file), 'utf8');
        this.logger.log(`Running migration ${file}...`);
        try {
          await this.client.exec({
            query: sql,
          });
          await this.#markMigrationAsApplied(version);
          this.logger.log(`Migration ${file} applied.`);
        } catch (err) {
          this.logger.error(`Migration ${file} failed: ${err?.message || err}`);
        }
      }
    }
  }

  async #getAppliedMigrations(): Promise<string[]> {
    const result = await this.client.query({
      query: `SELECT version FROM migrations`,
      format: 'JSON',
    });
    const rows = await result.json<{ data: Array<Record<string, any>> }>();
    return rows.data.map((row) => row['version']);
  }

  async #markMigrationAsApplied(version: string) {
    await this.client.exec({
      query: `INSERT INTO migrations (version) VALUES ('${version}')`,
    });
  }
}
