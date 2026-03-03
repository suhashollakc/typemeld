/**
 * typemeld — JSON Repair Engine Type Declarations
 */

/**
 * Repair and parse malformed JSON from LLM outputs.
 *
 * Fixes: markdown fences, trailing commas, unquoted keys, single quotes,
 * JS comments, truncated JSON, NaN/Infinity/undefined, prose extraction.
 *
 * @param input - Raw string containing malformed JSON, or an already-parsed value
 * @returns Parsed JavaScript value
 * @throws {RepairError} If the JSON cannot be repaired
 */
export declare function repairJson(input: string): any;
export declare function repairJson<T>(input: T): T;

/** Error thrown when JSON repair fails */
export declare class RepairError extends Error {
  readonly name: 'RepairError';
  /** The original input that could not be repaired */
  readonly input: string;
  constructor(message: string, input: string);
}
