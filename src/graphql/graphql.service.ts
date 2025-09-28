import { Injectable } from '@nestjs/common';
import { Neo4jService } from '@/neo4j/neo4j.service';
import {
  FIRST_ORDER_GENES_QUERY,
  GENE_INTERACTIONS_QUERY,
  GET_GENES_QUERY,
  GET_HEADERS_QUERY,
} from '@/neo4j/neo4j.constants';
import type { Description, GeneMetadata, GeneInteractionOutput, Header, InteractionInput } from './models';
import { createHash } from 'node:crypto';
import { mergeEdgesAndAverageScore } from '@/utils';
import { GeneInteractionQueryOutput } from '@/interfaces';

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

  async getGenes(geneIDs: string[]) {
    const session = this.neo4jService.getSession();
    const result = await session.run<{ genes: GetGenesResult }>(GET_GENES_QUERY, { geneIDs });
    await this.neo4jService.releaseSession(session);
    const inputSet = new Set<string>();
    const geneIDsIndexMap = new Map<string, number>();
    geneIDs.forEach((id, index) => {
      geneIDsIndexMap.set(id, index);
    });
    return result.records
      .reduce<GeneMetadata[]>((acc, record) => {
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
          (geneIDsIndexMap.get(a.Input) ?? geneIDsIndexMap.get(a.ID) ?? 0) -
          (geneIDsIndexMap.get(b.Input) ?? geneIDsIndexMap.get(b.ID) ?? 0),
      );
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
    const result = await session.run<GeneInteractionQueryOutput>(
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
      links: mergeEdgesAndAverageScore(result.records[0]?.get('links') ?? []),
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
}
