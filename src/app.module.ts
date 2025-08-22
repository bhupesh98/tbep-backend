import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { Neo4jModule } from './neo4j/neo4j.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Neo4jScheme } from '@/interfaces';
import { GraphqlModule } from './graphql/graphql.module';
import { LlmModule } from './llm/llm.module';
import { AlgorithmModule } from './algorithm/algorithm.module';
import { RedisModule } from './redis/redis.module';
import { RedisService } from '@/redis/redis.service';
import { ClickhouseModule } from './clickhouse/clickhouse.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),
    Neo4jModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        scheme: configService.get<Neo4jScheme>('NEO4J_SCHEME', 'bolt'),
        host: configService.get<string>('NEO4J_HOST', 'localhost'),
        port: configService.get<number>('NEO4J_PORT', 7687),
        username: configService.get<string>('NEO4J_USERNAME', 'neo4j'),
        password: configService.get<string>('NEO4J_PASSWORD', ''),
        database: configService.get<string>('NEO4J_DATABASE', 'tbep'),
      }),
      inject: [ConfigService],
    }),
    GraphqlModule,
    LlmModule,
    AlgorithmModule,
    {
      module: RedisModule,
      global: true,
      exports: [RedisService],
    },
    ClickhouseModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
