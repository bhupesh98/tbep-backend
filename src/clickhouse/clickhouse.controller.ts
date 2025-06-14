import { Controller, Get, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ClickhouseService } from './clickhouse.service';

@Controller('clickhouse')
export class ClickhouseController {
  constructor(private readonly clickhouseService: ClickhouseService) {}

  @Get('top-genes')
  async getTopGenes(
    @Query('diseaseId') diseaseId: string,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    if (!diseaseId) {
      return { error: 'diseaseId is required' };
    }
    return this.clickhouseService.getTopGenesByDisease(diseaseId, limit);
  }
}
