import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { GraphqlService } from '@/graphql/graphql.service';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Gene, GeneBase, GeneInteractionOutput, InteractionInput } from '@/graphql/graphql.schema';
import { DiseaseNames } from '@/decorators';
import { RedisService } from '@/redis/redis.service';
import { isUUID } from 'class-validator';

@Resolver()
export class GraphqlResolver {
  private readonly logger = new Logger(GraphqlResolver.name);

  constructor(
    private readonly graphqlService: GraphqlService,
    private readonly redisService: RedisService,
  ) {}

  @Query(() => String)
  async getUserID(@Context('req') { headers }: { headers: Record<string, string> }): Promise<string> {
    const header = headers['x-user-id'] || crypto.randomUUID();
    await this.redisService.redisClient.set(`user:${header}`, '', 'EX', 28800);
    return header;
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
    @Context('req') { headers }: { headers: Record<string, string> },
  ): Promise<GeneInteractionOutput> {
    const header = headers['x-user-id'];
    if (!isUUID(header)) throw new HttpException('Correct user ID not found', HttpStatus.UNAUTHORIZED);
    const graphName =
      input.graphName ??
      this.graphqlService.computeHash(JSON.stringify({ ...input, geneIDs: input.geneIDs.sort(), order }));
    const result = await this.graphqlService.getGeneInteractions(input, order, graphName, header);
    this.logger.log(`Genes: ${result.genes.length}, Links: ${result.links.length}`);
    return {
      genes: result.genes,
      links: result.links,
      graphName,
    };
  }
}
