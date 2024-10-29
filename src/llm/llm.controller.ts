import { Body, Controller, Post, Sse, Query, MessageEvent } from '@nestjs/common';
import { LlmService } from './llm.service';
import { PromptDto } from './prompt.dto';

@Controller({ path: 'llm', host: ['localhost', 'pdnet.saipuram.com'] })
export class LlmController {
  #promptStore = new Map<string, string>();

  constructor(private readonly llmService: LlmService) {}

  @Post('chat')
  async initChatStream(@Body() promptDto: PromptDto) {
    const streamID = Date.now().toString();
    this.#promptStore.set(streamID, promptDto.question);
    return { streamID };
  }

  @Sse('stream')
  async streamResponse(@Query('sid') streamID: string): Promise<Observable<MessageEvent>> {
    return new Observable<MessageEvent>((subscriber) => {
      (async () => {
        try {
          const prompt = this.#promptStore.get(streamID);
          if (!prompt) {
            subscriber.error('Invalid stream ID');
            return;
          }
          this.#promptStore.delete(streamID);
          const stream = await this.llmService.generateResponseStream(prompt);
          for await (const chunk of stream) {
            const content = chunk.choices[0].delta.content;
            if (content) {
              subscriber.next({ data: content });
            }
          }
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }
}
