import { Args, Context, Info, Int, Query, Resolver } from '@nestjs/graphql';
import { GraphqlService } from '@/graphql/graphql.service';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DataRequired, Gene, GeneInteractionOutput, Header, InteractionInput } from './models';
import { RedisService } from '@/redis/redis.service';
import { isUUID } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import type { FieldNode, GraphQLResolveInfo } from 'graphql';

@Resolver()
export class GraphqlResolver {
  private readonly logger = new Logger(GraphqlResolver.name);

  constructor(
    private readonly graphqlService: GraphqlService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  @Query(() => String)
  async getUserID(@Context('req') { headers }: { headers: Record<string, string> }): Promise<string> {
    const header = headers['x-user-id'] || crypto.randomUUID();
    await this.redisService.redisClient.set(
      `user:${header}`,
      '',
      'EX',
      this.configService.get('REDIS_USER_EXPIRY', 7200),
    );
    return header;
  }

  @Query(() => [Gene])
  async getGenes(
    @Args('geneIDs', { type: () => [String] }) geneIDs: string[],
    @Args('config', { type: () => [DataRequired], nullable: true }) config: Array<DataRequired> | undefined,
    @Info() info: GraphQLResolveInfo,
  ): Promise<Gene[]> {
    const bringMeta = info.fieldNodes[0].selectionSet.selections.some(
      (selection: FieldNode) => !['ID', 'common', 'disease'].includes(selection?.name.value),
    );
    const genes = await this.graphqlService.getGenes(geneIDs, config, bringMeta);
    return config ? this.graphqlService.filterGenes(genes, config) : genes;
  }

  @Query(() => Header)
  async getHeaders(@Args('disease', { type: () => String, nullable: true }) disease?: string) {
    return this.graphqlService.getHeaders(disease);
  }

  @Query(() => [String])
  async getDiseases(): Promise<string[]> {
    return this.graphqlService.getDiseases();
  }

  @Query(() => GeneInteractionOutput)
  async getGeneInteractions(
    @Args('input', { type: () => InteractionInput }) input: InteractionInput,
    @Args('order', { type: () => Int }) order: number,
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
