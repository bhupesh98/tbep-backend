import { Injectable } from '@nestjs/common';
import { Neo4jService } from '@/neo4j/neo4j.service';
import { FIRST_ORDER_GENES_QUERY, LEIDEN_QUERY, RENEW_QUERY } from '@/neo4j/neo4j.constants';
import { GraphConfigDto } from '@/algorithm/algorithm.dto';
import { RedisService } from '@/redis/redis.service';

@Injectable()
export class AlgorithmService {
  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly redisService: RedisService,
  ) {}

  // https://stackoverflow.com/a/54014428/1376947
  hslToHex(h: number, s: number, l: number) {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  colorGenerator() {
    let count = 0;
    return () => this.hslToHex(count++ * 137.508, 75, 50);
  }

  async leiden(graphName: string, resolution: number, weighted: boolean) {
    if (!(await this.neo4jService.graphExists(graphName))) return;
    const session = this.neo4jService.getSession();
    const response = (await session.run(LEIDEN_QUERY(weighted), { graphName, resolution })).records;
    await this.neo4jService.releaseSession(session);
    let count = 0;
    const colorGen = this.colorGenerator();
    return response.reduce(
      (acc, record) => {
        const community = record.get('community');
        if (!acc[community])
          acc[community] = {
            name: `Community ${++count}`,
            genes: [],
            color: colorGen(),
          };
        acc[community].genes.push(record.get('ID'));
        return acc;
      },
      {} as Record<string, { name: string; genes: string[]; color: string }>,
    );
  }

  async renewSession(graphConfig: GraphConfigDto) {
    if (await this.neo4jService.graphExists(graphConfig.graphName)) return false;
    const session = this.neo4jService.getSession();
    if (graphConfig.order === 2) {
      graphConfig.order = 0;
      graphConfig.geneIDs = (
        await session.run<{ geneIDs: string[] }>(FIRST_ORDER_GENES_QUERY(graphConfig.interactionType), {
          geneIDs: graphConfig.geneIDs,
          minScore: graphConfig.minScore,
        })
      ).records[0].get('geneIDs');
    }
    await session.run(RENEW_QUERY(graphConfig.order, graphConfig.interactionType), {
      geneIDs: graphConfig.geneIDs,
      minScore: graphConfig.minScore,
      graphName: graphConfig.graphName,
    });
    await this.neo4jService.releaseSession(session);
    await this.redisService.redisClient.set(graphConfig.graphName, '', 'EX', 60);
    return true;
  }
}
