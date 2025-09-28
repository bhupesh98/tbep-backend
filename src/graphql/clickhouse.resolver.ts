import { ClickhouseService } from '@/clickhouse/clickhouse.service';
import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
  TopGene,
  OrderByEnum,
  ScoredKeyValue,
  Target,
  TargetDiseaseAssociationTable,
  DataRequired,
  GeneProperty,
} from './models';
import { Pagination } from './models/Pagination.input';
import { DataLoaderService } from '@/dataloader';

@Resolver()
export class ClickhouseResolver {
  constructor(private readonly clickhouseService: ClickhouseService) {}

  @Query(() => [TopGene])
  async topGenesByDisease(
    @Args('diseaseId', { type: () => String }) diseaseId: string,
    @Args('page', { type: () => Pagination, nullable: true }) pagination: Pagination,
  ) {
    if (pagination.page < 1) {
      pagination.page = 1;
    }
    if (pagination.limit < 1) {
      pagination.limit = 25; // Default limit
    }
    return this.clickhouseService.getTopGenesByDisease(diseaseId, pagination);
  }

  @Query(() => TargetDiseaseAssociationTable)
  async targetDiseaseAssociationTable(
    @Args('geneIds', { type: () => [String] }) geneIds: string[],
    @Args('diseaseId', { type: () => String }) diseaseId: string,
    @Args('orderBy', { type: () => OrderByEnum, defaultValue: OrderByEnum.SCORE, nullable: true }) orderBy: OrderByEnum,
    @Args('page', { type: () => Pagination, nullable: true }) pagination: Pagination,
  ) {
    if (pagination.page < 1) {
      pagination.page = 1;
    }
    if (pagination.limit < 1) {
      pagination.limit = 25; // Default limit
    }
    return this.clickhouseService.getTargetDiseaseAssociationTable(geneIds, diseaseId, orderBy, pagination);
  }

  @Query(() => [GeneProperty])
  async geneProperties(
    @Args('geneIds', { type: () => [String] }) geneIds: string[],
    @Args('config', { type: () => [DataRequired] }) config: DataRequired[],
  ) {
    return this.clickhouseService.getGeneProperties(geneIds, config);
  }
}

@Resolver(() => Target)
export class TargetResolver {
  constructor(private readonly dataLoaderService: DataLoaderService) {}

  @ResolveField('prioritization', () => [ScoredKeyValue])
  async prioritizationTable(@Parent() target: Target) {
    const prioritizationLoader = this.dataLoaderService.getPrioritizationLoader();
    return prioritizationLoader.load(target.id);
  }
}
