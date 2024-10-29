import { Args, Query, Resolver } from '@nestjs/graphql';
import { GraphqlService } from '@/graphql/graphql.service';
import { Logger } from '@nestjs/common';
import { Gene, GeneInteractionOutput, InteractionInput } from '@/graphql/graphql.schema';
import { DiseaseNames } from '@/decorators';

@Resolver()
export class GraphqlResolver {
  constructor(private readonly graphqlService: GraphqlService) {}

  private logger = new Logger(GraphqlResolver.name);

  @Query(() => String)
  async sayHello(): Promise<string> {
    return 'Hello World!';
  }

  @Query(() => [Gene])
  async getGenes(@Args('geneIDs') geneIDs: string[], @DiseaseNames() diseaseNames: string[]): Promise<Gene[]> {
    const genes = await this.graphqlService.getGenes(geneIDs);
    return this.graphqlService.filterGenesByDisease(genes, diseaseNames);
  }

  @Query(() => [GeneInteractionOutput])
  async getGeneInteractions(
    @Args('input') input: InteractionInput,
    @Args('order') order: number,
    @DiseaseNames({ depth: 1, fieldName: 'genes' }) diseaseNames: string[],
  ): Promise<GeneInteractionOutput> {
    const result = await this.graphqlService.getGeneInteractions(input, order);
    this.logger.log(`Genes: ${result.genes.length}, Links: ${result.links.length}`);
    return {
      genes: await this.graphqlService.filterGenesByDisease(result.genes, diseaseNames),
      links: result.links,
    };
  }
}
