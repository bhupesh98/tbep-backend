import { IsArray, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class GraphConfigDto {
  @IsString()
  @IsNotEmpty()
  graphName: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  geneIDs: string[];

  @IsString()
  @IsNotEmpty()
  diseaseMap: string;

  @IsNumber()
  @Min(0)
  @Max(2)
  order: number;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  interactionType: string[];

  @IsNumber()
  @Min(0)
  @Max(1)
  minScore: number;
}
