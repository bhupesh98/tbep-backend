import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Description {
  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  description: string;
}

@ObjectType()
export class Header {
  @Field(() => [Description], { nullable: true })
  disease?: Description[];

  @Field(() => [Description], { nullable: true })
  common?: Description[];
}
