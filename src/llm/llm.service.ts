import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LlmService {
  #openai: OpenAI;

  constructor(configService: ConfigService) {
    this.#openai = new OpenAI({
      // TODO: Change Base URL
      baseURL: 'https://integrate.api.nvidia.com/v1',
      apiKey: configService.get('OPENAI_API_KEY'),
    });
  }

  #SYSTEM_PROMPT = `Answer the following biomedical question in a very specific manner:
	1. Content Requirements:
	- Provide only the names of the genes, pathways, or gene-protein interactions when the question specifically asks for them.
	- Do not include any extra explanations or additional information unless explicitly requested in the query.
	- Highlight only the main keywords, genes, pathways, or their interactions when asked.
	2. Citation and Web Scraping Requirements:
	- Scrape the internet for accurate and precise answers along with their corresponding citations. Ensure live web scraping is used for improved accuracy and precision.
	- If no citations are found, respond with exactly:
  Not able to scrape citations for this question.
  Do not fabricate or hallucinate any citations or dummy links.
	3. Citation Format (for each citation):
The output for each citation must be in the following exact format:

Title of the paper  
Authors  
Journal
[Link](https://www.google.com/search?q={URL_ENCODED_TITLE_OF_THE_PAPER}&btnI=I%27m%20Feeling%20Lucky)

	- Title of the paper: Provide the title exactly as it appears.
	- Authors: List the authors of the paper.
	- Journal: List the journal where the paper was published.
	- Modified Link: The link should be in Markdown format. Instead of using direct URLs, construct the link using the paper title. Ensure that {URL_ENCODED_TITLE_OF_THE_PAPER} is the URL-encoded version of the paper’s title.

	4. Additional Notes:
	- Do not include any PMIDs, DOIs, or extra identifiers in the citation.
	- Strictly adhere to this format for all citations to support your answer.
	- Ensure that the answer is as precise and accurate as possible by using the latest available data from live web scraping.

Please strictly follow these guidelines in your responses.`;

  async generateResponseStream(prompt: string) {
    return this.#openai.chat.completions.create({
      model: 'meta/llama-3.1-405b-instruct',
      messages: [
        { role: 'system', content: this.#SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      top_p: 0.7,
      max_tokens: 1024,
      stream: true,
    });
  }
}
