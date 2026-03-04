/**
 * typemeld — LLM Retry Wrapper
 *
 * Automatically re-prompts the LLM when validation fails.
 * Works with any LLM API that accepts a messages array.
 *
 * Usage:
 *   import { withRetry, tm } from 'typemeld';
 *
 *   const result = await withRetry({
 *     schema: tm.object({ name: tm.string(), age: tm.number() }),
 *     call: (messages) => openai.chat.completions.create({ messages, model: 'gpt-4' }),
 *     extract: (response) => response.choices[0].message.content,
 *     prompt: 'Extract user data from: "John is 30 years old"',
 *   });
 */

import { safeParse, promptFor } from './index.js';

/**
 * Retry wrapper that re-prompts the LLM on validation failure.
 *
 * @param {Object} options
 * @param {import('./schema.js').Schema} options.schema - Schema to validate against
 * @param {function} options.call - Function that calls the LLM. Receives messages array, returns LLM response.
 * @param {function} options.extract - Function that extracts text content from LLM response.
 * @param {string} options.prompt - The user prompt to send to the LLM.
 * @param {string} [options.system] - Optional system prompt. If omitted, auto-generated from schema.
 * @param {Array} [options.messages] - Full messages array (overrides prompt/system).
 * @param {number} [options.maxRetries=3] - Maximum number of retry attempts.
 * @param {boolean} [options.throwOnFailure=true] - Whether to throw if all retries fail.
 * @param {function} [options.onRetry] - Callback fired before each retry: (attempt, errors, lastOutput) => void
 * @returns {Promise<any>} Parsed and validated result
 *
 * @example
 *   // With OpenAI
 *   const result = await withRetry({
 *     schema: tm.object({ sentiment: tm.enum(['positive', 'negative', 'neutral']) }),
 *     call: (messages) => openai.chat.completions.create({ messages, model: 'gpt-4o-mini' }),
 *     extract: (res) => res.choices[0].message.content,
 *     prompt: 'What is the sentiment of: "I love this product!"',
 *   });
 *
 * @example
 *   // With Anthropic
 *   const result = await withRetry({
 *     schema: mySchema,
 *     call: (messages) => anthropic.messages.create({
 *       model: 'claude-sonnet-4-20250514',
 *       max_tokens: 1024,
 *       system: messages.find(m => m.role === 'system')?.content,
 *       messages: messages.filter(m => m.role !== 'system'),
 *     }),
 *     extract: (res) => res.content[0].text,
 *     prompt: 'Extract entities from this text...',
 *   });
 */
export async function withRetry(options) {
  const {
    schema,
    call,
    extract,
    prompt,
    system,
    messages: userMessages,
    maxRetries = 3,
    throwOnFailure = true,
    onRetry,
  } = options;

  if (!schema) throw new Error('typemeld withRetry: schema is required');
  if (!call) throw new Error('typemeld withRetry: call function is required');
  if (!extract) throw new Error('typemeld withRetry: extract function is required');
  if (!prompt && !userMessages) throw new Error('typemeld withRetry: prompt or messages is required');

  // Build initial messages
  const systemPrompt = system || `You are a structured data extraction assistant.\n${promptFor(schema, { strict: true })}`;

  let messages = userMessages ? [...userMessages] : [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  let lastOutput = null;
  let lastErrors = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Call the LLM
    const response = await call(messages);
    const output = extract(response);
    lastOutput = output;

    // Try to parse and validate
    const result = safeParse(output, schema);
    if (result.success) {
      return result.data;
    }

    lastErrors = result.errors;

    // If we've exhausted retries, break
    if (attempt >= maxRetries) break;

    // Fire onRetry callback
    if (onRetry) {
      onRetry(attempt + 1, result.errors, output);
    }

    // Build correction message for next attempt
    const errorSummary = result.errors
      .map(e => `- ${e.path}: ${e.message}`)
      .join('\n');

    messages = [
      ...messages,
      { role: 'assistant', content: output },
      {
        role: 'user',
        content: `Your previous response had validation errors:\n${errorSummary}\n\nPlease fix these issues and return valid JSON matching the required schema. Return ONLY the JSON, no other text.`,
      },
    ];
  }

  // All retries exhausted
  if (throwOnFailure) {
    const err = new Error(`typemeld withRetry: validation failed after ${maxRetries + 1} attempts`);
    err.errors = lastErrors;
    err.lastOutput = lastOutput;
    throw err;
  }

  // Return best-effort parsed data
  const finalResult = safeParse(lastOutput, schema);
  return finalResult.data;
}
