import { Module } from '@nestjs/common';
import { GraphqlResolver } from './graphql.resolver';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { join } from 'node:path';
import { GraphqlService } from './graphql.service';
import GraphQLJSON from 'graphql-type-json';
import { ClickhouseModule } from '@/clickhouse/clickhouse.module';
import { ClickhouseResolver } from './clickhouse.resolver';

@Module({
  imports: [
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      resolvers: { JSON: GraphQLJSON },
      path: '/graphql',
    }),
    ClickhouseModule,
  ],
  providers: [GraphqlResolver, ClickhouseResolver, GraphqlService],
})
export class GraphqlModule {}
