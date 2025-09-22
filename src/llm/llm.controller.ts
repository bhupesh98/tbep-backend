import { Body, Controller, Post, HttpException, HttpStatus, Res } from '@nestjs/common';
import { LlmService } from './llm.service';
import { Model, PromptDto } from './prompt.dto';
import type { Response } from 'express';

@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post('chat')
  async streamResponse(@Body() promptDto: PromptDto, @Res() res: Response) {
    try {
      // Check if the model is available
      const model = promptDto.model || Model.LLAMA_3;
      if (model && !this.llmService.isModelAvailable(model)) {
        throw new HttpException(`Model ${model} is currently not configured for use.`, HttpStatus.BAD_REQUEST);
      }

      // Generate the AI response stream using AI SDK
      const result = this.llmService.generateResponseStream(promptDto);

      // Return the AI SDK stream response directly
      return result.pipeUIMessageStreamToResponse(res);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      throw new HttpException(error.message || 'Failed to generate response stream', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
