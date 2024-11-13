import { Module } from '@nestjs/common';
import { GraphqlResolver } from './graphql.resolver';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { join } from 'node:path';
import { GraphqlService } from './graphql.service';

@Module({
  imports: [
    GraphQLModule.forRootAsync({
      driver: ApolloDriver,
      useFactory: async () => ({
        sortSchema: true,
        path: '/graphql',
        typePaths: ['./**/*.graphql'],
        playground: true,
        definitions: {
          path: join(process.cwd(), 'src/graphql/graphql.schema.ts'),
          outputAs: 'class' as const,
          enumsAsTypes: true,
        },
      }),
    }),
  ],
  providers: [GraphqlResolver, GraphqlService],
})
export class GraphqlModule {}
