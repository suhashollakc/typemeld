import { Schema } from './schema';

export interface StreamOptions {
  /** Callback fired when a new partial value is available */
  onValue?: (value: any) => void;
  /** Callback fired on errors */
  onError?: (error: Error) => void;
  /** Callback fired when stream is complete */
  onComplete?: (value: any) => void;
}

export interface StreamResult {
  /** Current best-effort parsed value */
  partial: any;
  /** Whether the stream is complete */
  done: boolean;
  /** Error if final validation failed */
  error?: Error;
}

export interface StreamParseOptions {
  /** Whether to emit partial values during streaming (default: true) */
  emitPartial?: boolean;
}

/**
 * Streaming JSON parser that incrementally builds a result as tokens arrive.
 * Works with OpenAI, Anthropic, Google, and any SSE-based LLM API.
 */
export class JsonStream {
  constructor(schema?: Schema, options?: StreamOptions);

  /** Push a new chunk of text into the stream */
  push(chunk: string): any;

  /** Get the current best-effort parsed value */
  get value(): any;

  /** Get the raw accumulated buffer */
  get buffer(): string;

  /** Whether the stream has been completed */
  get done(): boolean;

  /**
   * Complete the stream. Performs final repair and schema validation.
   * After calling complete(), no more chunks can be pushed.
   */
  complete(): any;
}

/**
 * Create a streaming parser that processes an async iterable of chunks.
 * Returns an async iterable of progressively more complete parsed values.
 */
export function streamParse(
  chunks: AsyncIterable<string>,
  schema?: Schema,
  options?: StreamParseOptions
): AsyncGenerator<StreamResult>;

/**
 * Convenience: parse a complete async iterable of chunks into a single result.
 * Buffers all chunks, repairs, and validates.
 */
export function parseStream(
  chunks: AsyncIterable<string>,
  schema?: Schema
): Promise<any>;
