import OpenAI from "openai";
import { getConfig } from "../config/env.js";
import { logger } from "../utils/logger.js";

export class OpenAIClient {
  private client: OpenAI;
  private model: string;
  private maxRetries: number = 2;

  constructor() {
    const config = getConfig();
    this.client = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
    this.model = config.OPENAI_MODEL;
  }

  /**
   * Generate completion with retries and timeout
   */
  async generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    requestId?: string
  ): Promise<string> {
    const startTime = Date.now();
    const reqId = requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info("OpenAI request started", {
      requestId: reqId,
      model: this.model,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Empty response from OpenAI");
        }

        const duration = Date.now() - startTime;
        logger.info("OpenAI request completed", {
          requestId: reqId,
          duration,
          tokensUsed: response.usage?.total_tokens,
          attempt: attempt + 1,
        });

        return content;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isNetworkError =
          error instanceof Error &&
          (error.message.includes("network") ||
            error.message.includes("timeout") ||
            error.message.includes("ECONNRESET") ||
            error.message.includes("ETIMEDOUT"));

        if (isNetworkError && attempt < this.maxRetries) {
          const waitTime = (attempt + 1) * 1000; // Exponential backoff
          logger.warn("OpenAI request failed, retrying", {
            requestId: reqId,
            attempt: attempt + 1,
            error: lastError.message,
            waitTime,
          });
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        // Non-retryable error or max retries reached
        const duration = Date.now() - startTime;
        logger.error("OpenAI request failed", {
          requestId: reqId,
          duration,
          attempt: attempt + 1,
          error: lastError.message,
        });
        throw lastError;
      }
    }

    throw lastError || new Error("OpenAI request failed after retries");
  }
}
