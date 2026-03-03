import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { repairJson, RepairError } from '../src/repair.js';

describe('repairJson', () => {

  // ── Basic parsing ──

  describe('valid JSON passthrough', () => {
    it('parses a valid object', () => {
      assert.deepStrictEqual(repairJson('{"a": 1, "b": 2}'), { a: 1, b: 2 });
    });
    it('parses a valid array', () => {
      assert.deepStrictEqual(repairJson('[1, 2, 3]'), [1, 2, 3]);
    });
    it('parses nested structures', () => {
      assert.deepStrictEqual(repairJson('{"a": {"b": [1, 2]}}'), { a: { b: [1, 2] } });
    });
    it('parses bare primitives', () => {
      assert.strictEqual(repairJson('42'), 42);
      assert.strictEqual(repairJson('"hello"'), 'hello');
      assert.strictEqual(repairJson('true'), true);
      assert.strictEqual(repairJson('false'), false);
      assert.strictEqual(repairJson('null'), null);
    });
    it('passes through non-string input', () => {
      const obj = { already: 'parsed' };
      assert.strictEqual(repairJson(obj), obj);
      assert.strictEqual(repairJson(null), null);
      assert.strictEqual(repairJson(42), 42);
    });
  });

  // ── Markdown fences ──

  describe('markdown fence stripping', () => {
    it('strips ```json fences', () => {
      assert.deepStrictEqual(repairJson('```json\n{"a": 1}\n```'), { a: 1 });
    });
    it('strips ``` fences without language', () => {
      assert.deepStrictEqual(repairJson('```\n{"a": 1}\n```'), { a: 1 });
    });
    it('strips ```js fences', () => {
      assert.deepStrictEqual(repairJson('```js\n{"a": 1}\n```'), { a: 1 });
    });
    it('strips ```javascript fences', () => {
      assert.deepStrictEqual(repairJson('```javascript\n{"a": 1}\n```'), { a: 1 });
    });
    it('strips ```typescript fences', () => {
      assert.deepStrictEqual(repairJson('```typescript\n{"a": 1}\n```'), { a: 1 });
    });
    it('strips single backtick wrapping', () => {
      assert.deepStrictEqual(repairJson('`{"a": 1}`'), { a: 1 });
    });
  });

  // ── Prose extraction ──

  describe('JSON extraction from prose', () => {
    it('extracts object from surrounding text', () => {
      assert.deepStrictEqual(
        repairJson('Sure! Here is the data: {"result": true} Hope this helps!'),
        { result: true }
      );
    });
    it('extracts array from surrounding text', () => {
      assert.deepStrictEqual(
        repairJson('The list is: [1, 2, 3] as requested.'),
        [1, 2, 3]
      );
    });
    it('handles prose before object', () => {
      assert.deepStrictEqual(
        repairJson('Here you go:\n{"name": "test"}'),
        { name: 'test' }
      );
    });
  });

  // ── Trailing commas ──

  describe('trailing comma removal', () => {
    it('fixes trailing comma in object', () => {
      assert.deepStrictEqual(repairJson('{"a": 1, "b": 2,}'), { a: 1, b: 2 });
    });
    it('fixes trailing comma in array', () => {
      assert.deepStrictEqual(repairJson('[1, 2, 3,]'), [1, 2, 3]);
    });
    it('fixes trailing comma with whitespace', () => {
      assert.deepStrictEqual(repairJson('{"a": 1 , }'), { a: 1 });
    });
    it('preserves commas inside strings', () => {
      assert.deepStrictEqual(
        repairJson('{"msg": "a,}b"}'),
        { msg: 'a,}b' }
      );
    });
  });

  // ── Unquoted keys ──

  describe('unquoted key fixing', () => {
    it('quotes simple keys', () => {
      assert.deepStrictEqual(repairJson('{name: "John"}'), { name: 'John' });
    });
    it('quotes keys with $ and _', () => {
      assert.deepStrictEqual(repairJson('{$key: 1, _private: 2}'), { $key: 1, _private: 2 });
    });
    it('quotes camelCase keys', () => {
      assert.deepStrictEqual(repairJson('{firstName: "John"}'), { firstName: 'John' });
    });
    it('quotes hyphenated keys', () => {
      assert.deepStrictEqual(repairJson('{"content-type": "json"}'), { 'content-type': 'json' });
    });
    it('does not corrupt colons inside strings', () => {
      assert.deepStrictEqual(
        repairJson('{"url": "http://example.com"}'),
        { url: 'http://example.com' }
      );
    });
  });

  // ── Single quotes ──

  describe('single quote conversion', () => {
    it('converts single-quoted keys and values', () => {
      assert.deepStrictEqual(repairJson("{'name': 'John'}"), { name: 'John' });
    });
    it('handles mixed quotes', () => {
      assert.deepStrictEqual(repairJson("{'name': \"John\"}"), { name: 'John' });
    });
    it('escapes double quotes inside single-quoted strings', () => {
      assert.deepStrictEqual(repairJson("{'msg': 'He said \"hi\"'}"), { msg: 'He said "hi"' });
    });
  });

  // ── Comments ──

  describe('comment stripping', () => {
    it('strips line comments', () => {
      assert.deepStrictEqual(repairJson('{"a": 1 // comment\n}'), { a: 1 });
    });
    it('strips block comments', () => {
      assert.deepStrictEqual(repairJson('{"a": 1 /* block */}'), { a: 1 });
    });
    it('does not strip comment-like content in strings', () => {
      assert.deepStrictEqual(repairJson('{"url": "http://example.com"}'), { url: 'http://example.com' });
    });
  });

  // ── Special values ──

  describe('special value replacement', () => {
    it('replaces NaN with null', () => {
      assert.deepStrictEqual(repairJson('{"a": NaN}'), { a: null });
    });
    it('replaces Infinity with null', () => {
      assert.deepStrictEqual(repairJson('{"a": Infinity}'), { a: null });
    });
    it('replaces -Infinity with null', () => {
      assert.deepStrictEqual(repairJson('{"a": -Infinity}'), { a: null });
    });
    it('replaces undefined with null', () => {
      assert.deepStrictEqual(repairJson('{"a": undefined}'), { a: null });
    });
    it('does not replace these inside strings', () => {
      assert.deepStrictEqual(repairJson('{"a": "NaN is not a number"}'), { a: 'NaN is not a number' });
    });
  });

  // ── Truncated JSON ──

  describe('truncated JSON repair', () => {
    it('closes unclosed object', () => {
      const r = repairJson('{"a": 1');
      assert.deepStrictEqual(r, { a: 1 });
    });
    it('closes unclosed array', () => {
      const r = repairJson('[1, 2, 3');
      assert.deepStrictEqual(r, [1, 2, 3]);
    });
    it('closes unclosed string and brackets', () => {
      const r = repairJson('{"items": ["one", "tw');
      assert.deepStrictEqual(r, { items: ['one', 'tw'] });
    });
    it('closes deeply nested truncation', () => {
      const r = repairJson('{"a": {"b": {"c": [1, 2');
      assert.strictEqual(typeof r, 'object');
      assert.strictEqual(r.a.b.c[0], 1);
    });
    it('removes trailing comma before closing', () => {
      const r = repairJson('{"a": 1,');
      assert.deepStrictEqual(r, { a: 1 });
    });
  });

  // ── Combined repairs ──

  describe('combined repair scenarios', () => {
    it('fences + trailing commas + unquoted keys', () => {
      assert.deepStrictEqual(
        repairJson('```json\n{name: "John", age: 30,}\n```'),
        { name: 'John', age: 30 }
      );
    });
    it('prose + single quotes + comments', () => {
      assert.deepStrictEqual(
        repairJson("Here: {'name': 'John' // a comment\n} done!"),
        { name: 'John' }
      );
    });
    it('all repairs together', () => {
      const input = "Sure! Here's the JSON:\n```json\n{name: 'Alice', age: 30, active: undefined, score: NaN,}\n```\nHope that helps!";
      const r = repairJson(input);
      assert.strictEqual(r.name, 'Alice');
      assert.strictEqual(r.age, 30);
      assert.strictEqual(r.active, null);
      assert.strictEqual(r.score, null);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles empty object', () => {
      assert.deepStrictEqual(repairJson('{}'), {});
    });
    it('handles empty array', () => {
      assert.deepStrictEqual(repairJson('[]'), []);
    });
    it('handles whitespace-wrapped input', () => {
      assert.deepStrictEqual(repairJson('  \n {"a": 1} \n  '), { a: 1 });
    });
    it('handles unicode keys and values', () => {
      assert.deepStrictEqual(repairJson('{"名前": "太郎", "emoji": "🎉"}'), { '名前': '太郎', emoji: '🎉' });
    });
    it('handles escaped characters in strings', () => {
      assert.deepStrictEqual(repairJson('{"msg": "line1\\nline2"}'), { msg: 'line1\nline2' });
    });
    it('handles very long strings', () => {
      const long = 'a'.repeat(100000);
      const r = repairJson(`{"data": "${long}"}`);
      assert.strictEqual(r.data.length, 100000);
    });
  });

  // ── Error handling ──

  describe('error handling', () => {
    it('throws RepairError for completely invalid input', () => {
      assert.throws(() => repairJson('not json at all'), (err) => {
        assert.strictEqual(err.name, 'RepairError');
        assert.strictEqual(err.input, 'not json at all');
        return true;
      });
    });
    it('throws RepairError for empty string', () => {
      assert.throws(() => repairJson(''), { name: 'RepairError' });
    });
    it('throws RepairError for whitespace only', () => {
      assert.throws(() => repairJson('   '), { name: 'RepairError' });
    });
  });

  // ── Security ──

  describe('security', () => {
    it('does not execute code in input', () => {
      // This must NOT execute — it should throw RepairError
      assert.throws(() => repairJson('process.exit(1)'), { name: 'RepairError' });
    });
    it('does not execute require() calls', () => {
      assert.throws(() => repairJson("require('child_process').execSync('echo pwned')"), { name: 'RepairError' });
    });
    it('does not execute function expressions', () => {
      assert.throws(() => repairJson('(function(){ return 1; })()'), { name: 'RepairError' });
    });
  });
});
