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
        const graphName = key.replace(regexp`^${this.redisService.keyPrefix}`, '');
        const session = this.getSession();
        await session.run(GRAPH_DROP_QUERY, { graphName });
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
    return await this.redisService.checkKey(graphName);
  }

  getSession(graphName?: string, mode: SessionMode = 'READ'): Session {
    const pool = mode === 'READ' ? this.readPool : this.writePool;
    if (graphName) this.redisService.setKeyWithExpiry(graphName, this.KEY_EXPIRY);
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
