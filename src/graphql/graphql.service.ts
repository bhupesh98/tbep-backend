import { Injectable } from '@nestjs/common';
import { Neo4jService } from '@/neo4j/neo4j.service';
import {
  FIRST_ORDER_GENES_QUERY,
  GENE_INTERACTIONS_QUERY,
  GET_DISEASES_QUERY,
  GET_GENES_QUERY,
  GET_HEADERS_QUERY,
} from '@/neo4j/neo4j.constants';
import type { DataRequired, Description, Gene, GeneInteractionOutput, Header, InteractionInput } from './models';
import { createHash } from 'node:crypto';
import { Disease } from '@/graphql/models';

export interface GetGenesResult {
  ID: string;
  Input: string;
  Gene_name?: string;
  Description?: string;
  hgnc_gene_id?: string;
  Aliases?: string[];
  [property: string]: string | string[] | undefined;
}

@Injectable()
export class GraphqlService {
  constructor(private readonly neo4jService: Neo4jService) {}

  async getGenes(geneIDs: string[], config?: Array<DataRequired> | undefined, bringMeta = true) {
    const properties = config?.flatMap((item) =>
      item.properties.map((prop) => `${item.disease ? `${item.disease}_` : ''}${prop}`),
    );
    const session = this.neo4jService.getSession();
    const result = await session.run<{ genes: GetGenesResult }>(GET_GENES_QUERY(properties, bringMeta), { geneIDs });
    await this.neo4jService.releaseSession(session);
    if (properties?.length) {
      return result.records.map((record) => {
        const gene = record.get('genes');
        return {
          ...gene,
          Aliases: gene.Aliases?.join(', '),
        };
      });
    } else {
      const inputSet = new Set<string>();
      const geneIDsIndexMap = new Map<string, number>();
      geneIDs.forEach((id, index) => {
        geneIDsIndexMap.set(id, index);
      });
      return result.records
        .reduce<Gene[]>((acc, record) => {
          const gene = record.get('genes');
          if (inputSet.has(gene.Input)) {
            return acc;
          } else {
            inputSet.add(gene.Input);
            acc.push({
              ...gene,
              Aliases: gene.Aliases?.join(', '),
            });
            return acc;
          }
        }, [])
        .sort(
          (a, b) =>
            (geneIDsIndexMap.get(a.Input) ?? geneIDsIndexMap.get(a.ID)) -
            (geneIDsIndexMap.get(b.Input) ?? geneIDsIndexMap.get(b.ID)),
        );
    }
  }

  async filterGenes(genes: ReturnType<typeof GraphqlService.prototype.getGenes>, config: Array<DataRequired>) {
    return (await genes).map<Gene>((gene: any) => {
      gene.common = {};
      gene.disease = {};
      for (const { disease: diseaseName, properties } of config) {
        if (!diseaseName) {
          for (const prop of properties) {
            gene.common[prop] = gene[prop];
            delete gene[prop];
          }
        } else {
          gene.disease[diseaseName] = {};
          for (const prop of properties) {
            const propName = `${diseaseName}_${prop}`;
            gene.disease[diseaseName][prop] = gene[propName];
            delete gene[propName];
          }
        }
      }
      return gene;
    });
  }

  async getGeneInteractions(
    input: InteractionInput,
    order: number,
    graphName: string,
    userID: string,
  ): Promise<GeneInteractionOutput> {
    const graphExists = await this.neo4jService.graphExists(graphName);
    const session = this.neo4jService.getSession();
    if (order === 2) {
      order = 0;
      input.geneIDs = (
        await session.run<{ geneIDs: string[] }>(FIRST_ORDER_GENES_QUERY(input.interactionType), {
          geneIDs: input.geneIDs,
          minScore: input.minScore,
        })
      ).records[0].get('geneIDs');
    }
    const result = await session.run<GeneInteractionOutput>(
      GENE_INTERACTIONS_QUERY(order, input.interactionType, graphExists),
      {
        geneIDs: input.geneIDs,
        minScore: input.minScore,
        graphName,
      },
    );
    await this.neo4jService.bindGraph(graphName, `user:${userID}`);
    await this.neo4jService.releaseSession(session);
    return {
      genes: result.records[0]?.get('genes') ?? [],
      links: result.records[0]?.get('links') ?? [],
      averageClusteringCoefficient: result.records[0]?.get('averageClusteringCoefficient') ?? 0,
    };
  }

  computeHash(query: string) {
    return createHash('sha256').update(query).digest('hex');
  }

  async getHeaders(disease: string, bringCommon: boolean): Promise<Header> {
    const session = this.neo4jService.getSession();
    const result = await session.run<Record<'diseaseHeader' | 'commonHeader', Description[]>>(
      GET_HEADERS_QUERY(bringCommon),
      { disease },
    );
    await this.neo4jService.releaseSession(session);
    return {
      disease: result.records[0].get('diseaseHeader'),
      common: bringCommon ? result.records[0].get('commonHeader') : [],
    };
  }

  async getDiseases() {
    const session = this.neo4jService.getSession();
    const result = await session.run<{ diseases: Disease }>(GET_DISEASES_QUERY);
    await this.neo4jService.releaseSession(session);
    return result.records.map((record) => record.get('diseases'));
  }
}
