/**
 * typemeld — Parse, validate, and repair messy LLM outputs.
 *
 * @example
 * ```js
 * import { parse, tm } from 'typemeld';
 *
 * const schema = tm.object({
 *   name: tm.string(),
 *   age: tm.number(),
 *   tags: tm.array(tm.string()),
 * });
 *
 * const result = parse(llmOutput, schema);
 * // => { name: "John", age: 30, tags: ["dev"] }
 * ```
 */

import { Schema, tm, Infer, ValidationError, JsonSchema, ObjectShape } from './schema.js';
import { repairJson, RepairError } from './repair.js';

/**
 * Parse and validate LLM output against a schema.
 * Throws ParseError on failure.
 *
 * @param input - Raw LLM output (string or already-parsed object)
 * @param schema - Optional schema to validate and coerce against
 * @returns Parsed and validated data
 * @throws {ParseError} If parsing or validation fails
 */
export declare function parse<T>(input: string | object, schema: Schema<T>): T;
export declare function parse(input: string | object): any;

/** Result of safeParse — never throws */
export interface SafeParseResult<T = any> {
  success: boolean;
  data: T;
  error: string | null;
  errors: ValidationError[];
  raw: string | object;
}

/**
 * Safely parse and validate LLM output.
 * Never throws — returns { success, data, errors }.
 *
 * @param input - Raw LLM output (string or already-parsed object)
 * @param schema - Optional schema to validate against
 */
export declare function safeParse<T>(input: string | object, schema: Schema<T>): SafeParseResult<T>;
export declare function safeParse(input: string | object): SafeParseResult<any>;

/**
 * Extract multiple JSON objects/arrays from a string.
 * Useful when an LLM returns multiple JSON blocks in one response.
 *
 * @param input - Raw text with embedded JSON
 * @returns Array of parsed objects
 */
export declare function extractAll(input: string): any[];

/** Options for promptFor() */
export interface PromptForOptions {
  /** If true, adds a strict instruction to return only valid JSON */
  strict?: boolean;
}

/**
 * Generate a system prompt fragment describing the expected output format.
 *
 * @param schema - Schema to describe
 * @param options - Prompt generation options
 * @returns Prompt text ready to append to your system message
 */
export declare function promptFor(schema: Schema<any>, options?: PromptForOptions): string;

/** Error thrown by parse() when parsing or validation fails */
export declare class ParseError extends Error {
  readonly name: 'ParseError';
  /** Structured validation errors */
  readonly errors: ValidationError[];
  /** The original raw input */
  raw: string | object;
  /** The repaired (but possibly invalid) data */
  repaired: any;
  constructor(message: string, errors?: ValidationError[]);
}

// Re-exports
export { repairJson, RepairError } from './repair.js';
export { tm, Schema, Infer, ValidationError, ValidationResult, JsonSchema, ObjectShape } from './schema.js';
export { JsonStream, streamParse, parseStream, StreamOptions, StreamResult, StreamParseOptions } from './stream.js';
export { fromZod } from './adapter.js';
export { withRetry, RetryOptions } from './retry.js';
