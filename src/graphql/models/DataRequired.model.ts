import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class DataRequired {
  @Field(() => String, { nullable: true })
  disease?: string;

  @Field(() => [String])
  properties: string[];
}
