import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GRAPH_DROP_QUERY, NEO4J_CONFIG, NEO4J_DRIVER } from '@/neo4j/neo4j.constants';
import { Neo4jConfig } from '@/interfaces';
import { Driver, Session, SessionMode } from 'neo4j-driver';
import { RedisService } from '@/redis/redis.service';
import { regexp } from '@/neo4j/neo4j.util';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name);
  private readPool: Session[] = [];
  private writePool: Session[] = [];
  private readonly MAX_POOL_SIZE: number;
  private readonly KEY_EXPIRY: number;

  constructor(
    @Inject(NEO4J_CONFIG) private readonly config: Neo4jConfig,
    @Inject(NEO4J_DRIVER) private readonly driver: Driver,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.MAX_POOL_SIZE = this.configService.get<number>('NEO4J_MAX_POOL_SIZE', 10);
    this.KEY_EXPIRY = this.configService.get<number>('REDIS_KEY_EXPIRY', 120);
  }

  async onModuleInit() {
    try {
      await this.driver.getServerInfo();
      this.logger.log('Connected to Neo4j');
      this.logger.log(`Database: ${this.config.database}`);
      await this.redisService.onKeyExpiration(async (key: string) => {
        key = key.replace(regexp`^${this.redisService.keyPrefix}`, '');
        if (key.startsWith('user:')) return;
        const session = this.getSession();
        await session.run(GRAPH_DROP_QUERY, { graphName: key });
        await this.releaseSession(session);
      });
    } catch (error) {
      this.logger.error('Database not connected');
      this.logger.error(error);
    }
  }

  async onModuleDestroy() {
    await this.driver.close();
  }

  async graphExists(graphName: string): Promise<boolean> {
    const session = this.getSession('WRITE');
    const result = await session.run<{ exists: boolean }>(
      'CALL gds.graph.exists($graphName) YIELD exists RETURN exists',
      { graphName },
    );
    await this.releaseSession(session, 'WRITE');
    return result.records[0].get('exists');
  }

  async bindGraph(graphName: string, userID: string) {
    const [[, val], [, ttl]] = await this.redisService.redisClient.multi().get(userID).ttl(userID).exec();
    if (val) {
      if (val === graphName) {
        if ((await this.redisService.redisClient.exists(graphName)) === 1) return;
      } else {
        const num = await this.redisService.redisClient.decr(val as string);
        if (num === 0) {
          const session = this.getSession();
          await this.redisService.redisClient.del(val as string);
          await session.run(GRAPH_DROP_QUERY, { graphName: val });
          await this.releaseSession(session);
        }
      }
    }
    await this.redisService.redisClient
      .multi()
      .incr(graphName)
      .expire(graphName, this.KEY_EXPIRY)
      .set(userID, graphName, 'EX', Math.max(ttl as number, 120))
      .exec();
  }

  getSession(mode: SessionMode = 'READ'): Session {
    const pool = mode === 'READ' ? this.readPool : this.writePool;
    if (pool.length > 0) {
      return pool.pop()!;
    }
    return this.driver.session({
      database: this.config.database,
      defaultAccessMode: mode,
    });
  }

  async releaseSession(session: Session, mode: SessionMode = 'READ') {
    const pool = mode === 'READ' ? this.readPool : this.writePool;
    if (pool.length < this.MAX_POOL_SIZE) {
      pool.push(session);
    } else {
      await session.close();
    }
  }
}
