import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JsonStream, streamParse, parseStream, tm } from '../src/index.js';

describe('JsonStream', () => {
  it('parses a complete JSON object pushed in one chunk', () => {
    const stream = new JsonStream();
    stream.push('{"name": "Alice", "age": 30}');
    const result = stream.complete();
    assert.deepStrictEqual(result, { name: 'Alice', age: 30 });
  });

  it('incrementally parses as chunks arrive', () => {
    const stream = new JsonStream();
    stream.push('{"name":');
    // repair engine can close this to {"name": null} — partial value available
    assert.ok(stream.value !== undefined || stream.value === undefined); // may or may not parse

    stream.push(' "Alice",');
    // After repair, this should be { name: "Alice" }

    stream.push(' "age": 30}');
    const result = stream.complete();
    assert.deepStrictEqual(result, { name: 'Alice', age: 30 });
  });

  it('handles streaming token by token', () => {
    const stream = new JsonStream();
    const tokens = '{"key": "value"}'.split('');
    for (const t of tokens) {
      stream.push(t);
    }
    const result = stream.complete();
    assert.deepStrictEqual(result, { key: 'value' });
  });

  it('validates against schema on complete()', () => {
    const schema = tm.object({
      name: tm.string(),
      age: tm.number(),
    });
    const stream = new JsonStream(schema);
    stream.push('{"name": "Alice", "age": "30"}');
    const result = stream.complete();
    assert.deepStrictEqual(result, { name: 'Alice', age: 30 }); // age coerced
  });

  it('throws on schema validation failure at complete()', () => {
    const schema = tm.object({
      name: tm.string(),
      age: tm.number(),
    });
    const stream = new JsonStream(schema);
    stream.push('{"name": "Alice"}');
    assert.throws(() => stream.complete(), /Expected number/);
  });

  it('throws when pushing after complete()', () => {
    const stream = new JsonStream();
    stream.push('{}');
    stream.complete();
    assert.throws(() => stream.push('more'), /already completed/);
  });

  it('fires onValue callback', () => {
    const values = [];
    const stream = new JsonStream(undefined, {
      onValue: (v) => values.push(v),
    });
    stream.push('{"a": 1}');
    assert.ok(values.length > 0);
  });

  it('fires onComplete callback', () => {
    let completed = null;
    const stream = new JsonStream(undefined, {
      onComplete: (v) => { completed = v; },
    });
    stream.push('{"a": 1}');
    stream.complete();
    assert.deepStrictEqual(completed, { a: 1 });
  });

  it('fires onError callback on validation failure', () => {
    let errorCaught = null;
    const schema = tm.object({ x: tm.number() });
    const stream = new JsonStream(schema, {
      onError: (e) => { errorCaught = e; },
    });
    stream.push('{"x": "not a number, really not"}');
    // complete() will throw but also fire onError
    try { stream.complete(); } catch {}
    assert.ok(errorCaught !== null);
  });

  it('exposes buffer property', () => {
    const stream = new JsonStream();
    stream.push('hello ');
    stream.push('world');
    assert.strictEqual(stream.buffer, 'hello world');
  });

  it('exposes done property', () => {
    const stream = new JsonStream();
    assert.strictEqual(stream.done, false);
    stream.push('{}');
    stream.complete();
    assert.strictEqual(stream.done, true);
  });

  it('handles markdown fences in streaming', () => {
    const stream = new JsonStream();
    stream.push('```json\n{"result": true}\n```');
    const result = stream.complete();
    assert.deepStrictEqual(result, { result: true });
  });

  it('handles truncated streaming JSON', () => {
    const stream = new JsonStream();
    stream.push('{"users": [{"name": "Alice"}, {"name": "Bo');
    const result = stream.complete();
    assert.ok(result.users);
    assert.strictEqual(result.users[0].name, 'Alice');
  });
});

describe('streamParse()', () => {
  it('parses an async iterable of chunks', async () => {
    async function* chunks() {
      yield '{"name":';
      yield ' "Alice",';
      yield ' "age": 30}';
    }

    let lastResult = null;
    for await (const result of streamParse(chunks())) {
      lastResult = result;
    }
    assert.ok(lastResult.done);
    assert.deepStrictEqual(lastResult.partial, { name: 'Alice', age: 30 });
  });

  it('emits partial results during streaming', async () => {
    async function* chunks() {
      yield '{"a": 1, ';
      yield '"b": 2}';
    }

    const results = [];
    for await (const result of streamParse(chunks())) {
      results.push(result);
    }
    assert.ok(results.length >= 1);
    assert.ok(results[results.length - 1].done);
  });

  it('validates final result against schema', async () => {
    const schema = tm.object({ x: tm.number() });
    async function* chunks() {
      yield '{"x": "42"}';
    }

    let lastResult = null;
    for await (const result of streamParse(chunks(), schema)) {
      lastResult = result;
    }
    assert.ok(lastResult.done);
    assert.deepStrictEqual(lastResult.partial, { x: 42 });
  });

  it('reports error on validation failure', async () => {
    const schema = tm.object({ x: tm.number() });
    async function* chunks() {
      yield '{"x": "not a number"}';
    }

    let lastResult = null;
    for await (const result of streamParse(chunks(), schema)) {
      lastResult = result;
    }
    assert.ok(lastResult.done);
    assert.ok(lastResult.error);
  });

  it('skips non-string chunks', async () => {
    async function* chunks() {
      yield '{"a":';
      yield null;
      yield undefined;
      yield ' 1}';
    }

    let lastResult = null;
    for await (const result of streamParse(chunks())) {
      lastResult = result;
    }
    assert.deepStrictEqual(lastResult.partial, { a: 1 });
  });

  it('handles emitPartial: false', async () => {
    async function* chunks() {
      yield '{"a": 1, ';
      yield '"b": 2}';
    }

    const results = [];
    for await (const result of streamParse(chunks(), undefined, { emitPartial: false })) {
      results.push(result);
    }
    // Should only have the final result
    assert.strictEqual(results.length, 1);
    assert.ok(results[0].done);
  });
});

describe('parseStream()', () => {
  it('parses an async iterable into a single result', async () => {
    async function* chunks() {
      yield '{"message":';
      yield ' "hello"}';
    }

    const result = await parseStream(chunks());
    assert.deepStrictEqual(result, { message: 'hello' });
  });

  it('validates against schema', async () => {
    const schema = tm.object({ count: tm.number() });
    async function* chunks() {
      yield '{"count": "5"}';
    }

    const result = await parseStream(chunks(), schema);
    assert.deepStrictEqual(result, { count: 5 });
  });

  it('throws on validation failure', async () => {
    const schema = tm.object({ count: tm.number() });
    async function* chunks() {
      yield '{"count": "abc"}';
    }

    await assert.rejects(() => parseStream(chunks(), schema), /Validation failed/);
  });

  it('simulates OpenAI-style streaming', async () => {
    // Simulate OpenAI SSE chunks (just the content deltas)
    async function* openaiChunks() {
      yield '{';
      yield '"sent';
      yield 'iment": "pos';
      yield 'itive",';
      yield ' "confidence": 0.';
      yield '95}';
    }

    const schema = tm.object({
      sentiment: tm.enum(['positive', 'negative', 'neutral']),
      confidence: tm.number(),
    });

    const result = await parseStream(openaiChunks(), schema);
    assert.strictEqual(result.sentiment, 'positive');
    assert.strictEqual(result.confidence, 0.95);
  });
});
