import { ClickhouseService } from '@/clickhouse/clickhouse.service';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { TopGene } from './models';

@Resolver()
export class ClickhouseResolver {
  constructor(private readonly clickhouseService: ClickhouseService) {}

  @Query(() => [TopGene])
  async topGenesByDisease(
    @Args('diseaseId', { type: () => String }) diseaseId: string,
    @Args('limit', { type: () => Int, defaultValue: 25, nullable: true }) limit: number,
  ) {
    return this.clickhouseService.getTopGenesByDisease(diseaseId, limit);
  }
}
