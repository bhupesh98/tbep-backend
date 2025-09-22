import { Args, Context, Info, Int, Query, Resolver } from '@nestjs/graphql';
import { GraphqlService } from '@/graphql/graphql.service';
import { DataRequired, Gene, GeneInteractionOutput, Header, InteractionInput } from './models';
import { RedisService } from '@/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { Kind, type GraphQLResolveInfo } from 'graphql';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationException } from 'nestjs-zod';

@Resolver()
export class GraphqlResolver {
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
    const bringMeta = info.fieldNodes[0].selectionSet?.selections.some(
      (selection) => selection.kind === Kind.FIELD && !['ID', 'common', 'disease'].includes(selection?.name.value),
    );
    const genes = this.graphqlService.getGenes(geneIDs, config, bringMeta);
    return config ? this.graphqlService.filterGenes(genes, config) : genes;
  }

  @Query(() => Header)
  async headers(@Args('disease', { type: () => String }) disease: string, @Info() info: GraphQLResolveInfo) {
    const bringCommon =
      info.fieldNodes[0].selectionSet?.selections.find(
        (val) => val.kind === Kind.FIELD && val.name.value === 'common',
      ) !== undefined;
    return this.graphqlService.getHeaders(disease, bringCommon);
  }

  @Query(() => GeneInteractionOutput)
  async getGeneInteractions(
    @Args('input', { type: () => InteractionInput }) input: InteractionInput,
    @Args('order', { type: () => Int }) order: number,
    @Context('req') req: Request,
  ): Promise<GeneInteractionOutput> {
    const userID: string = req.cookies['user-id'] ?? crypto.randomUUID();
    if (z.uuid().safeParse(userID).success === false) throw new ZodValidationException('Correct user ID not found');
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
        sameSite: 'strict',
      });
    }

    const graphName =
      input.graphName ??
      this.graphqlService.computeHash(JSON.stringify({ ...input, geneIDs: input.geneIDs.sort(), order }));
    const result = await this.graphqlService.getGeneInteractions(input, order, graphName, userID);
    return {
      genes: result.genes,
      links: result.links,
      graphName,
      averageClusteringCoefficient: result.averageClusteringCoefficient,
    };
  }
}
