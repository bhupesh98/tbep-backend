import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class GeneInteraction {
  @Field(() => String)
  gene1: string;

  @Field(() => String)
  gene2: string;

  @Field(() => Float)
  score: number;
}
