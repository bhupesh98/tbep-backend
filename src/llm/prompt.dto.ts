import { IsNotEmpty, IsString, MaxLength, IsEnum, IsOptional } from 'class-validator';
export enum Model {
  GPT_4O = 'gpt-4o',
  LLAMA_3 = 'meta/llama-3.1-405b-instruct',
}
export class PromptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question: string;

  @IsEnum(Model)
  @IsOptional()
  model?: Model;
}
