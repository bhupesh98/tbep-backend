import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ClickHouseClient, createClient } from '@clickhouse/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config/dist/config.service';

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

  async getTopGenesByDisease(diseaseId: string, limit: number): Promise<string[]> {
    const query = `
      SELECT gene_name
      FROM overall_association_score
      WHERE disease_id = {diseaseId:String}
      ORDER BY score DESC
      LIMIT {limit:UInt32}
    `;
    try {
      const resultSet = await this.client.query({
        query,
        query_params: { diseaseId, limit },
        format: 'JSONEachRow',
      });

      const geneIds: string[] = [];

      for await (const rows of resultSet.stream<{
        gene_name: string;
      }>()) {
        for (const row of rows) {
          geneIds.push(row.json().gene_name);
        }
      }

      return geneIds;
    } catch (error) {
      this.logger.error('query failed', error);
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
      } else {
        this.logger.log(`Skipping already applied migration: ${file}`);
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
