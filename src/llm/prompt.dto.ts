import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export enum Model {
  GPT_4O = 'openai:gpt-4o',
  LLAMA_3 = 'nvidia:meta/llama-3.1-405b-instruct',
}

/**
 * Prompt DTO schema
 */
export const PromptDtoSchema = z.object({
  model: z.enum(Model).optional(),
  messages: z.array(z.any()).optional(),
});

export class PromptDto extends createZodDto(PromptDtoSchema) {}
