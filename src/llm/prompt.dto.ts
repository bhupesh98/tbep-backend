import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PromptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question: string;
}
