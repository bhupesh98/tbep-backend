import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LlmService {
  #openai: OpenAI;

  constructor(configService: ConfigService) {
    this.#openai = new OpenAI({
      baseURL: 'https://integrate.api.nvidia.com/v1',
      apiKey: configService.get('OPENAI_API_KEY'),
    });
  }

  #PROMPT_GENERATOR(prompt: string) {
    return `Answer the following biomedical question in a very specific manner,
      providing only the names of the genes or causes when asked. Do not explain anything extra
      unless specifically asked in the user query. Provide citations [and their corresponding links] 
      to support your answer, included with links.
      Scrape the internet for accurate and precise answers and their corresponding citations; 
      and IF you do not find any CITATIONS, then send a message:
      Not able to scrape citations for this question. but DO NOT HALLUCINATE or CREATE DUMMY LINKS. Recheck your answers with live web scraping for better accuracy and precision.
      Highlight only the main keywords or genes:\n\n${prompt}`;
  }

  async generateResponseStream(prompt: string) {
    return this.#openai.chat.completions.create({
      model: 'meta/llama-3.1-405b-instruct',
      messages: [{ role: 'user', content: this.#PROMPT_GENERATOR(prompt) }],
      temperature: 0.2,
      top_p: 0.7,
      max_tokens: 1024,
      stream: true,
    });
  }
}
