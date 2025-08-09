import { Field, ObjectType, Float, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class ScoredKeyValue {
  @Field(() => String)
  key: string;

  @Field(() => Float)
  score: number;
}

@ObjectType()
export class Target {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  prioritization?: ScoredKeyValue[];
}

@ObjectType()
export class TargetDiseaseAssociationRow {
  @Field()
  target: Target;

  @Field(() => [ScoredKeyValue])
  datasourceScores: ScoredKeyValue[];

  @Field(() => Float)
  overall_score: number;
}

@ObjectType()
export class TargetDiseaseAssociationTable {
  @Field(() => [TargetDiseaseAssociationRow])
  rows: TargetDiseaseAssociationRow[];

  @Field(() => Int, { nullable: true })
  totalCount: number;
}
