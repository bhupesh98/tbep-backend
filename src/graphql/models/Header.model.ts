import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Header {
  @Field(() => [String], { nullable: true })
  disease?: string[];

  @Field(() => [String], { nullable: true })
  common?: string[];
}
