import { Field, ObjectType, ID } from '@nestjs/graphql';

@ObjectType()
export class Disease {
  @Field(() => ID)
  ID: string;

  @Field(() => String, { nullable: true })
  name?: string;
}
