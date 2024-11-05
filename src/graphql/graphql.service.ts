import { Injectable } from '@nestjs/common';
import { Neo4jService } from '@/neo4j/neo4j.service';
import {
  DISEASE_DEPENDENT_FIELDS,
  DISEASE_INDEPENDENT_FIELDS,
  FIRST_ORDER_GENES_QUERY,
  GENE_INTERACTIONS_QUERY,
  GET_GENES_QUERY,
} from '@/neo4j/neo4j.constants';
import type { Gene, GeneBase, InteractionInput } from '@/graphql/graphql.schema';

@Injectable()
export class GraphqlService {
  constructor(private readonly neo4jService: Neo4jService) {}

  async getGenes(geneIDs: string[], bringTotalData = true): Promise<Array<Record<string, string> | GeneBase>> {
    const session = this.neo4jService.getSession();
    const result = await session.run(GET_GENES_QUERY(bringTotalData), { geneIDs });
    await this.neo4jService.releaseSession(session);
    return result.records.map<Record<string, string>>((record) =>
      bringTotalData ? record.get('g').properties : record.get('g'),
    );
  }

  async filterGenesByDisease(genes: any[], diseaseNames: string[]) {
    return genes.map<Gene>((gene) => {
      gene.common = {};
      for (const diseaseName of diseaseNames) {
        gene[diseaseName] = {};
      }
      for (const key in gene) {
        diseaseNames.forEach((disease) => {
          if (DISEASE_DEPENDENT_FIELDS.some((field) => key.startsWith(`${disease}_${field}_`))) {
            gene[disease][key.slice(disease.length + 1)] = gene[key];
            delete gene[key];
          }
        });
        if (DISEASE_INDEPENDENT_FIELDS.some((field) => key.startsWith(`${field}_`))) {
          gene.common[key] = gene[key];
          delete gene[key];
        }
      }
      return gene;
    });
  }

  async getGeneInteractions(input: InteractionInput, order: number) {
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
    const result = await session.run<{
      genes: Array<GeneBase>;
      connections: Array<{ gene1: string; gene2: string; score: number }>;
    }>(GENE_INTERACTIONS_QUERY(order, input.interactionType), {
      geneIDs: input.geneIDs,
      minScore: input.minScore,
    });
    await this.neo4jService.releaseSession(session);
    return {
      genes: result.records[0]?.get('genes') ?? [],
      links: result.records[0]?.get('connections') ?? [],
    };
  }
}
