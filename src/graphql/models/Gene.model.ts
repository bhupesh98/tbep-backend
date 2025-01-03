import { Field, ObjectType, ID } from '@nestjs/graphql';
import type GraphQLJSONType from 'graphql-type-json';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class Gene {
  @Field(() => ID)
  ID: string;

  @Field(() => String)
  Input: string;

  @Field(() => String, { nullable: true })
  Description?: string;

  @Field(() => String, { nullable: true })
  Gene_name?: string;

  @Field(() => String, { nullable: true })
  hgnc_gene_id?: string;

  @Field(() => String, { nullable: true })
  Aliases?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  common?: typeof GraphQLJSONType;

  @Field(() => GraphQLJSON, { nullable: true })
  disease?: typeof GraphQLJSONType;
}
