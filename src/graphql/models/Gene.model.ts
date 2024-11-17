import { Field, ObjectType } from '@nestjs/graphql';
import GraphQLJSONType from 'graphql-type-json';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class Gene {
  @Field(() => String)
  ID: string;

  @Field(() => String, { nullable: true })
  Description?: string;

  @Field(() => String, { nullable: true })
  Gene_name?: string;

  @Field(() => String, { nullable: true })
  hgnc_gene_id?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  common?: typeof GraphQLJSONType;

  @Field(() => GraphQLJSON, { nullable: true })
  disease?: typeof GraphQLJSONType;
}
