import { Injectable } from '@nestjs/common';
import { Neo4jService } from '@/neo4j/neo4j.service';
import { FIRST_ORDER_GENES_QUERY, GENE_INTERACTIONS_QUERY, GET_GENES_QUERY } from '@/neo4j/neo4j.constants';
import { Gene, InteractionInput } from '@/graphql/graphql.schema';

@Injectable()
export class GraphqlService {
  constructor(private readonly neo4jService: Neo4jService) {}

  async getGenes(geneIDs: string[]) {
    const session = this.neo4jService.getSession();
    const result = await session.run(GET_GENES_QUERY, { geneIDs });
    await this.neo4jService.releaseSession(session);
    return result.records.map<Record<string, string>>((record) => record.get('g').properties);
  }

  async filterGenesByDisease(genes: any[], diseaseNames: string[]) {
    return genes.map<Gene>((gene) => {
      gene.common = {};
      for (const diseaseName of diseaseNames) {
        gene[diseaseName] = {};
      }
      for (const key in gene) {
        diseaseNames.forEach((disease) => {
          if (
            key.startsWith(`${disease}_GWAS_`) ||
            key.startsWith(`${disease}_GDA_`) ||
            key.startsWith(`${disease}_logFC_`) ||
            key.startsWith(`${disease}_database_`)
          ) {
            gene[disease][key.slice(disease.length + 1)] = gene[key];
            delete gene[key];
          }
        });
        if (key.startsWith(`pathway_`) || key.startsWith(`Druggability_`) || key.startsWith(`TE_`)) {
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
      genes: Array<{ properties: Record<string, string> }>;
      connections: Array<{ gene1: string; gene2: string; score: number }>;
    }>(GENE_INTERACTIONS_QUERY(order, input.interactionType), {
      geneIDs: input.geneIDs,
      minScore: input.minScore,
    });
    await this.neo4jService.releaseSession(session);
    return {
      genes: result.records[0]?.get('genes').map((gene) => gene.properties) ?? [],
      links: result.records[0]?.get('connections') ?? [],
    };
  }
}
