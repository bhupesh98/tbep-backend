import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NEO4J_CONFIG, NEO4J_DRIVER } from '@/neo4j/neo4j.constants';
import { Neo4jConfig } from '@/interfaces';
import { Driver, Session, SessionMode } from 'neo4j-driver';

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name);
  private readPool: Session[] = [];
  private writePool: Session[] = [];
  private MAX_POOL_SIZE = 10;

  constructor(
    @Inject(NEO4J_CONFIG) private readonly config: Neo4jConfig,
    @Inject(NEO4J_DRIVER) private readonly driver: Driver,
  ) {}

  async onModuleInit() {
    try {
      await this.driver.getServerInfo();
      this.logger.log('Connected to Neo4j');
      this.logger.log(`Database: ${this.config.database}`);
    } catch (error) {
      this.logger.error('Database not connected');
      this.logger.error(error);
    }
  }

  async onModuleDestroy() {
    await this.driver.close();
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
