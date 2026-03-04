import { Schema } from './schema';

export interface RetryOptions {
  /** Schema to validate against */
  schema: Schema;
  /** Function that calls the LLM. Receives messages array, returns LLM response. */
  call: (messages: Array<{ role: string; content: string }>) => Promise<any>;
  /** Function that extracts text content from LLM response */
  extract: (response: any) => string;
  /** The user prompt to send to the LLM */
  prompt?: string;
  /** Optional system prompt. If omitted, auto-generated from schema. */
  system?: string;
  /** Full messages array (overrides prompt/system) */
  messages?: Array<{ role: string; content: string }>;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Whether to throw if all retries fail (default: true) */
  throwOnFailure?: boolean;
  /** Callback fired before each retry */
  onRetry?: (attempt: number, errors: any[], lastOutput: string) => void;
}

/**
 * Retry wrapper that re-prompts the LLM on validation failure.
 * Works with any LLM API that accepts a messages array.
 *
 * @example
 *   const result = await withRetry({
 *     schema: tm.object({ sentiment: tm.enum(['positive', 'negative', 'neutral']) }),
 *     call: (messages) => openai.chat.completions.create({ messages, model: 'gpt-4o-mini' }),
 *     extract: (res) => res.choices[0].message.content,
 *     prompt: 'What is the sentiment of: "I love this!"',
 *   });
 */
export function withRetry(options: RetryOptions): Promise<any>;
