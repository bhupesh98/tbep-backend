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
    const goldenAngle = 137.508;
    return () => {
      let h = (count * goldenAngle) % 360;
      const s = 40 + (count % 4) * 20;
      let l = 20 + (count % 5) * 15;
      if (h > 60 && h < 180) {
        l = l < 50 ? l + 10 : l - 10;
        h = h < 120 ? h + 60 : h - 60;
      }
      count++;
      return this.hslToHex(h, s, l);
    };
  }

  async leiden(graphName: string, resolution: number, weighted: boolean, minCommunitySize: number) {
    if (!(await this.neo4jService.graphExists(graphName))) return;
    const session = this.neo4jService.getSession();
    const response = (
      await session.run<{
        community: { ID: string; communityId: number }[];
        modularity: number;
      }>(LEIDEN_QUERY(minCommunitySize, weighted), { graphName, resolution })
    ).records[0];
    await this.neo4jService.releaseSession(session);
    const colorGen = this.colorGenerator();
    let count = 0;
    return {
      modularity: response.get('modularity').toFixed(3),
      communities: response.get('community').reduce((acc, { ID, communityId }) => {
        if (!acc[communityId]) {
          acc[communityId] = { name: `Community ${++count}`, color: colorGen(), genes: [] };
        }
        acc[communityId].genes.push(ID);
        return acc;
      }, {}),
    };
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
