import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, safeParse, extractAll, promptFor, ParseError, tm } from '../src/index.js';

describe('parse()', () => {

  it('parses valid JSON', () => {
    assert.deepStrictEqual(parse('{"a": 1}'), { a: 1 });
  });

  it('parses with schema', () => {
    const r = parse('{"age": "30"}', tm.object({ age: tm.number() }));
    assert.deepStrictEqual(r, { age: 30 });
  });

  it('repairs and parses messy LLM output', () => {
    const input = '```json\n{name: "Bob", age: "25", tags: "engineer",}\n```';
    const r = parse(input, tm.object({
      name: tm.string(),
      age: tm.number(),
      tags: tm.array(tm.string()),
    }));
    assert.strictEqual(r.name, 'Bob');
    assert.strictEqual(r.age, 25);
    assert.deepStrictEqual(r.tags, ['engineer']);
  });

  it('accepts already-parsed objects', () => {
    assert.deepStrictEqual(parse({ a: 1 }), { a: 1 });
  });

  it('validates already-parsed objects against schema', () => {
    const r = parse({ age: '30' }, tm.object({ age: tm.number() }));
    assert.deepStrictEqual(r, { age: 30 });
  });

  it('throws ParseError on invalid JSON', () => {
    assert.throws(() => parse('not json'), (err) => {
      assert.ok(err instanceof ParseError);
      assert.strictEqual(err.name, 'ParseError');
      assert.ok(Array.isArray(err.errors));
      assert.strictEqual(err.raw, 'not json');
      return true;
    });
  });

  it('throws ParseError on schema validation failure', () => {
    assert.throws(
      () => parse('{"age": "abc"}', tm.object({ age: tm.number() })),
      (err) => {
        assert.ok(err instanceof ParseError);
        assert.ok(err.errors.length > 0);
        return true;
      }
    );
  });

  it('ParseError has repaired data on validation failure', () => {
    try {
      parse('{"a": "not_a_number"}', tm.object({ a: tm.number() }));
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.repaired !== undefined);
    }
  });
});

describe('safeParse()', () => {

  it('returns success for valid input', () => {
    const r = safeParse('{"a": 1}');
    assert.strictEqual(r.success, true);
    assert.deepStrictEqual(r.data, { a: 1 });
    assert.strictEqual(r.error, null);
    assert.deepStrictEqual(r.errors, []);
  });

  it('returns failure for invalid input', () => {
    const r = safeParse('not json');
    assert.strictEqual(r.success, false);
    assert.ok(r.error);
    assert.ok(r.errors.length > 0);
  });

  it('returns failure for schema validation', () => {
    const r = safeParse('{"age": "abc"}', tm.object({ age: tm.number() }));
    assert.strictEqual(r.success, false);
    assert.ok(r.errors.some(e => e.path === 'age'));
  });

  it('returns success with coerced data', () => {
    const r = safeParse('{"age": "30"}', tm.object({ age: tm.number() }));
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.data.age, 30);
  });

  it('preserves raw input', () => {
    const input = '{"a": 1}';
    const r = safeParse(input);
    assert.strictEqual(r.raw, input);
  });

  it('handles null and undefined schema gracefully', () => {
    const r = safeParse('{"a": 1}', undefined);
    assert.strictEqual(r.success, true);
  });
});

describe('extractAll()', () => {

  it('extracts multiple objects from prose', () => {
    const r = extractAll('First: {"a": 1} and then {"b": 2} finally {"c": 3}');
    assert.strictEqual(r.length, 3);
    assert.deepStrictEqual(r[0], { a: 1 });
    assert.deepStrictEqual(r[1], { b: 2 });
    assert.deepStrictEqual(r[2], { c: 3 });
  });

  it('extracts from multiple fenced blocks', () => {
    const r = extractAll('```json\n{"x": 1}\n```\ntext\n```json\n{"y": 2}\n```');
    assert.strictEqual(r.length, 2);
    assert.deepStrictEqual(r[0], { x: 1 });
    assert.deepStrictEqual(r[1], { y: 2 });
  });

  it('extracts arrays', () => {
    const r = extractAll('Array 1: [1,2] and Array 2: [3,4]');
    assert.strictEqual(r.length, 2);
  });

  it('returns empty array for no JSON', () => {
    assert.deepStrictEqual(extractAll('no json here'), []);
  });

  it('handles mixed objects and arrays', () => {
    const r = extractAll('obj: {"a":1} arr: [2,3]');
    assert.strictEqual(r.length, 2);
  });

  it('handles messy JSON in extraction', () => {
    const r = extractAll('```json\n{name: "test",}\n```');
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].name, 'test');
  });
});

describe('promptFor()', () => {

  it('generates prompt with JSON schema', () => {
    const s = tm.object({ name: tm.string() });
    const p = promptFor(s);
    assert.ok(p.includes('"type": "object"'));
    assert.ok(p.includes('"name"'));
  });

  it('includes strict instruction when option set', () => {
    const p = promptFor(tm.object({ a: tm.string() }), { strict: true });
    assert.ok(p.includes('ONLY valid JSON'));
  });

  it('does not include strict instruction by default', () => {
    const p = promptFor(tm.object({ a: tm.string() }));
    assert.ok(!p.includes('ONLY valid JSON'));
  });

  it('includes field descriptions', () => {
    const s = tm.object({ name: tm.string().describe('Full name') });
    const p = promptFor(s);
    assert.ok(p.includes('Full name'));
  });

  it('includes required fields', () => {
    const s = tm.object({
      required: tm.string(),
      optional: tm.string().optional(),
    });
    const p = promptFor(s);
    const schema = JSON.parse(p.split('\n').slice(1).join('\n').replace(/\nIMPORTANT:[\s\S]*/, ''));
    assert.ok(schema.required.includes('required'));
    assert.ok(!schema.required.includes('optional'));
  });
});

describe('end-to-end scenarios', () => {

  it('full LLM output pipeline', () => {
    const llmOutput = `Sure! Here's the analysis:

\`\`\`json
{
  sentiment: 'positive',
  confidence: "0.92",
  topics: "technology",
  summary: 'Great article about innovation'
}
\`\`\`

Let me know if you need anything else!`;

    const schema = tm.object({
      sentiment: tm.enum(['positive', 'negative', 'neutral']),
      confidence: tm.number(),
      topics: tm.array(tm.string()),
      summary: tm.string(),
    });

    const result = parse(llmOutput, schema);
    assert.strictEqual(result.sentiment, 'positive');
    assert.strictEqual(result.confidence, 0.92);
    assert.deepStrictEqual(result.topics, ['technology']);
    assert.strictEqual(result.summary, 'Great article about innovation');
  });

  it('handles Claude-style response with commentary', () => {
    const llmOutput = 'Based on my analysis, the result is: {"label": "SPAM", "score": "0.95", "reasons": "suspicious links"} I hope that helps!';
    const schema = tm.object({
      label: tm.enum(['spam', 'ham']),
      score: tm.number().min(0).max(1),
      reasons: tm.array(tm.string()),
    });
    const result = parse(llmOutput, schema);
    assert.strictEqual(result.label, 'spam'); // case-insensitive coercion
    assert.strictEqual(result.score, 0.95);
    assert.deepStrictEqual(result.reasons, ['suspicious links']);
  });

  it('handles truncated streaming response', () => {
    const truncated = '{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "ag';
    const result = safeParse(truncated);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.users[0].name, 'Alice');
  });

  it('handles response with JS comments and NaN', () => {
    const input = `{
      // User profile data
      "name": "Test",
      "score": NaN, /* invalid score */
      "active": undefined
    }`;
    const result = parse(input, tm.object({
      name: tm.string(),
      score: tm.number().nullable(),
      active: tm.boolean().nullable(),
    }));
    assert.strictEqual(result.name, 'Test');
    assert.strictEqual(result.score, null);
    assert.strictEqual(result.active, null);
  });

  it('passthrough mode preserves unknown LLM fields', () => {
    const schema = tm.object({ name: tm.string() }).passthrough();
    const result = parse('{"name": "test", "extra_field": "surprise", "metadata": 42}', schema);
    assert.strictEqual(result.name, 'test');
    assert.strictEqual(result.extra_field, 'surprise');
    assert.strictEqual(result.metadata, 42);
  });

  it('strict mode catches unexpected fields', () => {
    const schema = tm.object({ name: tm.string() }).strict();
    const result = safeParse('{"name": "test", "hacked": true}', schema);
    assert.strictEqual(result.success, false);
    assert.ok(result.errors.some(e => e.message.includes('hacked')));
  });
});
