/**
 * typemeld — Parse, validate, and repair messy LLM outputs.
 *
 * Usage:
 *   import { parse, safeParse, tm } from 'typemeld';
 *
 *   const schema = tm.object({
 *     name: tm.string(),
 *     age: tm.number(),
 *     tags: tm.array(tm.string()),
 *   });
 *
 *   const result = parse(llmOutput, schema);
 *   // => { name: "John", age: 30, tags: ["dev"] }
 */

import { repairJson, RepairError } from './repair.js';
import { tm } from './schema.js';

/**
 * Parse and validate LLM output against a schema.
 * Throws on failure.
 *
 * @param {string|object} input - Raw LLM output (string or already-parsed object)
 * @param {Schema} [schema] - Optional schema to validate against
 * @returns {any} Parsed and validated data
 */
export function parse(input, schema) {
  const result = safeParse(input, schema);
  if (!result.success) {
    const err = new ParseError(result.error, result.errors);
    err.raw = input;
    err.repaired = result.data;
    throw err;
  }
  return result.data;
}

/**
 * Safely parse and validate LLM output.
 * Never throws — returns { success, data, errors }.
 *
 * @param {string|object} input - Raw LLM output
 * @param {Schema} [schema] - Optional schema to validate against
 * @returns {{ success: boolean, data: any, errors: Array, raw: string }}
 */
export function safeParse(input, schema) {
  let data;

  // Step 1: Repair and parse JSON
  try {
    if (typeof input === 'object' && input !== null) {
      data = input; // Already parsed
    } else {
      data = repairJson(String(input));
    }
  } catch (e) {
    return {
      success: false,
      data: null,
      error: `Failed to parse: ${e.message}`,
      errors: [{ path: 'root', message: e.message }],
      raw: input,
    };
  }

  // Step 2: Validate against schema (if provided)
  if (schema) {
    const result = schema.validate(data);
    return {
      success: result.valid,
      data: result.value,
      error: result.valid ? null : `Validation failed: ${result.errors.map(e => e.message).join('; ')}`,
      errors: result.errors,
      raw: input,
    };
  }

  return { success: true, data, error: null, errors: [], raw: input };
}

/**
 * Extract multiple JSON objects/arrays from a string.
 * Useful when LLM returns multiple JSON blocks.
 *
 * @param {string} input - Raw text with embedded JSON
 * @returns {Array} Array of parsed objects
 */
export function extractAll(input) {
  const results = [];
  const s = String(input);

  // Find all fenced code blocks
  const fenceRe = /```(?:json|JSON|js|javascript)?\s*\n?([\s\S]*?)```/g;
  let match;
  while ((match = fenceRe.exec(s)) !== null) {
    try { results.push(repairJson(match[1])); } catch {}
  }
  if (results.length > 0) return results;

  // Find all top-level { } and [ ] blocks
  let depth = 0;
  let start = -1;
  let opener = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;

    if ((c === '{' || c === '[') && depth === 0) { start = i; opener = c; }
    if (c === '{' || c === '[') depth++;
    if (c === '}' || c === ']') {
      depth--;
      if (depth === 0 && start >= 0) {
        try { results.push(repairJson(s.slice(start, i + 1))); } catch {}
        start = -1;
      }
    }
  }

  return results;
}

/**
 * Generate a system prompt fragment that describes the expected output format.
 *
 * @param {Schema} schema - Schema to describe
 * @param {Object} [options]
 * @param {boolean} [options.strict=false] - Emphasize strict JSON compliance
 * @returns {string} Prompt text
 */
export function promptFor(schema, options = {}) {
  const jsonSchema = schema.toJsonSchema();
  const strict = options.strict ? '\nIMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no explanations.\n' : '';
  return `Respond with a JSON object matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}\n${strict}`;
}

export class ParseError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ParseError';
    this.errors = errors;
  }
}

// Re-exports
export { repairJson, RepairError } from './repair.js';
export { tm } from './schema.js';
export { JsonStream, streamParse, parseStream } from './stream.js';
export { fromZod } from './adapter.js';
export { withRetry } from './retry.js';
