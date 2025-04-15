import { IsNotEmpty, IsString, MaxLength, IsEnum, IsOptional, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export enum Model {
  GPT_4O = 'gpt-4o',
  LLAMA_3 = 'meta/llama-3.1-405b-instruct',
}

/**
 * Chat Window Message format
 * @class Message
 */
export class Message {
  /**
   * Message text
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  /**
   * Message sender
   */
  @IsString()
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';
}

export class PromptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question: string;

  @IsEnum(Model)
  @IsOptional()
  model?: Model;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Message)
  prevMessages?: Message[];
}
