import { Injectable } from '@nestjs/common';
import { Neo4jService } from '@/neo4j/neo4j.service';
import {
  FIRST_ORDER_GENES_QUERY,
  GENE_INTERACTIONS_QUERY,
  GET_DISEASES_QUERY,
  GET_GENES_QUERY,
  GET_HEADERS_QUERY,
} from '@/neo4j/neo4j.constants';
import { DataRequired, Gene, GeneInteractionOutput, Header, InteractionInput } from './models';
import { createHash } from 'node:crypto';

export interface GetGenesResult {
  ID: string;
  Gene_name?: string;
  Description?: string;
  hgnc_gene_id?: string;
  [property: string]: string;
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
    return result.records.map((record) => record.get('genes'));
  }

  async filterGenes(genes: Array<GetGenesResult>, config: Array<DataRequired>) {
    return genes.map<Gene>((gene: any) => {
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
    };
  }

  computeHash(query: string) {
    return createHash('sha256').update(query).digest('hex');
  }

  async getHeaders(disease?: string): Promise<Header> {
    const session = this.neo4jService.getSession();
    const result = await session.run<Record<'diseaseHeader' | 'commonHeader', string[]>>(GET_HEADERS_QUERY(disease));
    await this.neo4jService.releaseSession(session);
    return {
      disease: result.records[0].get('diseaseHeader'),
      common: result.records[0].get('commonHeader'),
    };
  }

  async getDiseases() {
    const session = this.neo4jService.getSession();
    const result = await session.run<{ diseases: string[] }>(GET_DISEASES_QUERY);
    await this.neo4jService.releaseSession(session);
    return result.records[0].get('diseases');
  }
}
