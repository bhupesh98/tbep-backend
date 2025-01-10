import { Args, Context, Info, Int, Query, Resolver } from '@nestjs/graphql';
import { GraphqlService } from '@/graphql/graphql.service';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DataRequired, Gene, GeneInteractionOutput, Header, InteractionInput } from './models';
import { RedisService } from '@/redis/redis.service';
import { isUUID } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import type { FieldNode, GraphQLResolveInfo } from 'graphql';
import { Disease } from '@/graphql/models/Disease.model';
import { Request } from 'express';

@Resolver()
export class GraphqlResolver {
  private readonly logger = new Logger(GraphqlResolver.name);

  constructor(
    private readonly graphqlService: GraphqlService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  @Query(() => [Gene])
  async genes(
    @Args('geneIDs', { type: () => [String] }) geneIDs: string[],
    @Args('config', { type: () => [DataRequired], nullable: true }) config: Array<DataRequired> | undefined,
    @Info() info: GraphQLResolveInfo,
  ): Promise<Gene[]> {
    const bringMeta = info.fieldNodes[0].selectionSet.selections.some(
      (selection: FieldNode) => !['ID', 'common', 'disease'].includes(selection?.name.value),
    );
    const genes = this.graphqlService.getGenes(geneIDs, config, bringMeta);
    return config ? this.graphqlService.filterGenes(genes, config) : genes;
  }

  @Query(() => Header)
  async headers(@Args('disease', { type: () => String, nullable: true }) disease?: string) {
    return this.graphqlService.getHeaders(disease);
  }

  @Query(() => [Disease])
  async diseases(): Promise<Disease[]> {
    return this.graphqlService.getDiseases();
  }

  @Query(() => GeneInteractionOutput)
  async getGeneInteractions(
    @Args('input', { type: () => InteractionInput }) input: InteractionInput,
    @Args('order', { type: () => Int }) order: number,
    @Context('req') req: Request,
  ): Promise<GeneInteractionOutput> {
    const userID = req.cookies['user-id'] ?? crypto.randomUUID();
    if (!isUUID(userID)) throw new HttpException('Correct user ID not found', HttpStatus.UNAUTHORIZED);
    if (!req.cookies['user-id']) {
      await this.redisService.redisClient.set(
        `user:${userID}`,
        '',
        'EX',
        this.configService.get('REDIS_USER_EXPIRY', 7200),
      );

      req.res?.cookie('user-id', userID, {
        maxAge: this.configService.get('REDIS_USER_EXPIRY', 7200) * 1000,
        httpOnly: true,
        secure: this.configService.get('NODE_ENV') === 'production',
      });
    }

    const graphName =
      input.graphName ??
      this.graphqlService.computeHash(JSON.stringify({ ...input, geneIDs: input.geneIDs.sort(), order }));
    const result = await this.graphqlService.getGeneInteractions(input, order, graphName, userID);
    this.logger.log(`Genes: ${result.genes.length}, Links: ${result.links.length}`);
    return {
      genes: result.genes,
      links: result.links,
      graphName,
    };
  }
}
