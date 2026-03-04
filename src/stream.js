/**
 * typemeld — Streaming JSON Parser
 *
 * Incrementally parses JSON tokens as they arrive from LLM streaming APIs.
 * Works with OpenAI, Anthropic, Google, and any SSE-based LLM API.
 *
 * Usage:
 *   const stream = new JsonStream(schema);
 *   for await (const chunk of llmStream) {
 *     stream.push(chunk);
 *     const partial = stream.value; // best-effort parsed object so far
 *   }
 *   const final = stream.complete(); // fully validated result
 */

import { repairJson, RepairError } from './repair.js';

/**
 * Streaming JSON parser that incrementally builds a result as tokens arrive.
 */
export class JsonStream {
  /**
   * @param {import('./schema.js').Schema} [schema] - Optional schema to validate final result
   * @param {Object} [options]
   * @param {function} [options.onValue] - Callback fired when a new partial value is available
   * @param {function} [options.onError] - Callback fired on errors
   * @param {function} [options.onComplete] - Callback fired when stream is complete
   */
  constructor(schema, options = {}) {
    this._schema = schema;
    this._buffer = '';
    this._value = undefined;
    this._error = null;
    this._complete = false;
    this._onValue = options.onValue || null;
    this._onError = options.onError || null;
    this._onComplete = options.onComplete || null;
  }

  /**
   * Push a new chunk of text into the stream.
   * Attempts to repair and parse the accumulated buffer after each push.
   *
   * @param {string} chunk - New text chunk from LLM stream
   * @returns {any} Current best-effort parsed value, or undefined if not yet parseable
   */
  push(chunk) {
    if (this._complete) {
      throw new Error('Stream already completed. Create a new JsonStream instance.');
    }
    this._buffer += chunk;
    this._tryParse();
    return this._value;
  }

  /**
   * Get the current best-effort parsed value.
   * This is updated after each push() call.
   *
   * @returns {any} Current partial value, or undefined if nothing parseable yet
   */
  get value() {
    return this._value;
  }

  /**
   * Get the raw accumulated buffer.
   *
   * @returns {string}
   */
  get buffer() {
    return this._buffer;
  }

  /**
   * Whether the stream has been completed.
   *
   * @returns {boolean}
   */
  get done() {
    return this._complete;
  }

  /**
   * Complete the stream. Performs final repair and schema validation.
   * After calling complete(), no more chunks can be pushed.
   *
   * @returns {any} The final parsed (and optionally validated) result
   * @throws {RepairError} If the buffer cannot be repaired into valid JSON
   * @throws {Error} If schema validation fails
   */
  complete() {
    if (this._complete) return this._value;
    this._complete = true;

    // Final parse attempt with full repair
    const data = repairJson(this._buffer);

    // Validate against schema if provided
    if (this._schema) {
      const result = this._schema.validate(data);
      if (!result.valid) {
        const err = new Error(`Validation failed: ${result.errors.map(e => e.message).join('; ')}`);
        err.errors = result.errors;
        err.data = result.value;
        if (this._onError) this._onError(err);
        throw err;
      }
      this._value = result.value;
    } else {
      this._value = data;
    }

    if (this._onComplete) this._onComplete(this._value);
    return this._value;
  }

  /**
   * Internal: attempt to parse the current buffer.
   * Uses repairJson which handles truncated JSON (auto-closes brackets).
   */
  _tryParse() {
    try {
      const data = repairJson(this._buffer);
      this._value = data;
      this._error = null;
      if (this._onValue) this._onValue(data);
    } catch {
      // Not yet parseable — that's expected during streaming
    }
  }
}

/**
 * Create a streaming parser that processes an async iterable of chunks.
 * Returns an async iterable of progressively more complete parsed values.
 *
 * @param {AsyncIterable<string>} chunks - Async iterable of text chunks (from SSE, fetch, etc.)
 * @param {import('./schema.js').Schema} [schema] - Optional schema for final validation
 * @param {Object} [options]
 * @param {boolean} [options.emitPartial=true] - Whether to emit partial values during streaming
 * @returns {AsyncGenerator<{partial: any, done: boolean}>}
 *
 * @example
 *   // With OpenAI
 *   const stream = await openai.chat.completions.create({ stream: true, ... });
 *   for await (const { partial, done } of streamParse(
 *     (async function*() { for await (const chunk of stream) yield chunk.choices[0]?.delta?.content ?? ''; })(),
 *     schema
 *   )) {
 *     console.log(partial); // progressively more complete object
 *   }
 */
export async function* streamParse(chunks, schema, options = {}) {
  const emitPartial = options.emitPartial !== false;
  const jsonStream = new JsonStream(schema);
  let lastJson = undefined;

  for await (const chunk of chunks) {
    if (typeof chunk !== 'string') continue;
    jsonStream.push(chunk);

    if (emitPartial && jsonStream.value !== undefined) {
      // Only emit if value actually changed
      const json = JSON.stringify(jsonStream.value);
      if (json !== lastJson) {
        lastJson = json;
        yield { partial: jsonStream.value, done: false };
      }
    }
  }

  // Final complete with validation
  try {
    const final = jsonStream.complete();
    yield { partial: final, done: true };
  } catch (err) {
    yield { partial: jsonStream.value, done: true, error: err };
  }
}

/**
 * Convenience: parse a complete async iterable of chunks into a single result.
 * Buffers all chunks, repairs, and validates.
 *
 * @param {AsyncIterable<string>} chunks - Async iterable of text chunks
 * @param {import('./schema.js').Schema} [schema] - Optional schema for validation
 * @returns {Promise<any>} Final parsed result
 */
export async function parseStream(chunks, schema) {
  const jsonStream = new JsonStream(schema);
  for await (const chunk of chunks) {
    if (typeof chunk !== 'string') continue;
    jsonStream.push(chunk);
  }
  return jsonStream.complete();
}
