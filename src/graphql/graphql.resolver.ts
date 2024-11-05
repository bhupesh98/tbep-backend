import { Args, Query, Resolver } from '@nestjs/graphql';
import { GraphqlService } from '@/graphql/graphql.service';
import { Logger } from '@nestjs/common';
import { Gene, GeneBase, GeneInteractionOutput, InteractionInput } from '@/graphql/graphql.schema';
import { DiseaseNames } from '@/decorators';

@Resolver()
export class GraphqlResolver {
  private logger = new Logger(GraphqlResolver.name);

  constructor(private readonly graphqlService: GraphqlService) {}

  @Query(() => String)
  async sayHello(): Promise<string> {
    return 'Hello World!';
  }

  @Query(() => [Gene || GeneBase])
  async getGenes(
    @Args('geneIDs') geneIDs: string[],
    @DiseaseNames() diseaseNamesInfo: [Array<string>, boolean],
  ): Promise<(Gene | GeneBase)[]> {
    const bringTotalData = diseaseNamesInfo[0].length > 0 || diseaseNamesInfo[1];
    const genes = await this.graphqlService.getGenes(geneIDs, bringTotalData);
    return bringTotalData
      ? this.graphqlService.filterGenesByDisease(genes, diseaseNamesInfo[0])
      : (genes as GeneBase[]);
  }

  @Query(() => [GeneInteractionOutput])
  async getGeneInteractions(
    @Args('input') input: InteractionInput,
    @Args('order') order: number,
  ): Promise<GeneInteractionOutput> {
    const result = await this.graphqlService.getGeneInteractions(input, order);
    this.logger.log(`Genes: ${result.genes.length}, Links: ${result.links.length}`);
    return result;
  }
}
