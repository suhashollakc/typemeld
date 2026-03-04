import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tm } from '../src/schema.js';

describe('Schema Builder (tm)', () => {

  // ── String ──

  describe('tm.string()', () => {
    it('validates a string', () => {
      const r = tm.string().validate('hello');
      assert.strictEqual(r.valid, true);
      assert.strictEqual(r.value, 'hello');
    });
    it('coerces number to string', () => {
      assert.strictEqual(tm.string().validate(123).value, '123');
    });
    it('coerces boolean to string', () => {
      assert.strictEqual(tm.string().validate(true).value, 'true');
    });
    it('rejects object', () => {
      assert.strictEqual(tm.string().validate({}).valid, false);
    });
    it('rejects array', () => {
      assert.strictEqual(tm.string().validate([]).valid, false);
    });
    it('enforces min length', () => {
      assert.strictEqual(tm.string().min(3).validate('ab').valid, false);
      assert.strictEqual(tm.string().min(3).validate('abc').valid, true);
    });
    it('enforces max length', () => {
      assert.strictEqual(tm.string().max(3).validate('abcd').valid, false);
      assert.strictEqual(tm.string().max(3).validate('abc').valid, true);
    });
    it('enforces min and max together', () => {
      const s = tm.string().min(2).max(5);
      assert.strictEqual(s.validate('a').valid, false);
      assert.strictEqual(s.validate('ab').valid, true);
      assert.strictEqual(s.validate('abcde').valid, true);
      assert.strictEqual(s.validate('abcdef').valid, false);
    });
  });

  // ── Number ──

  describe('tm.number()', () => {
    it('validates a number', () => {
      const r = tm.number().validate(42);
      assert.strictEqual(r.valid, true);
      assert.strictEqual(r.value, 42);
    });
    it('validates zero', () => {
      assert.strictEqual(tm.number().validate(0).valid, true);
    });
    it('validates negative numbers', () => {
      assert.strictEqual(tm.number().validate(-5).value, -5);
    });
    it('validates floats', () => {
      assert.strictEqual(tm.number().validate(3.14).value, 3.14);
    });
    it('coerces numeric string', () => {
      assert.strictEqual(tm.number().validate('42').value, 42);
    });
    it('coerces float string', () => {
      assert.strictEqual(tm.number().validate('3.14').value, 3.14);
    });
    it('rejects non-numeric string', () => {
      assert.strictEqual(tm.number().validate('abc').valid, false);
    });
    it('rejects NaN', () => {
      assert.strictEqual(tm.number().validate(NaN).valid, false);
    });
    it('enforces min value', () => {
      assert.strictEqual(tm.number().min(0).validate(-1).valid, false);
      assert.strictEqual(tm.number().min(0).validate(0).valid, true);
    });
    it('enforces max value', () => {
      assert.strictEqual(tm.number().max(100).validate(101).valid, false);
      assert.strictEqual(tm.number().max(100).validate(100).valid, true);
    });
    it('enforces min and max together', () => {
      const n = tm.number().min(1).max(10);
      assert.strictEqual(n.validate(0).valid, false);
      assert.strictEqual(n.validate(5).valid, true);
      assert.strictEqual(n.validate(11).valid, false);
    });
  });

  // ── Boolean ──

  describe('tm.boolean()', () => {
    it('validates true', () => {
      assert.strictEqual(tm.boolean().validate(true).value, true);
    });
    it('validates false', () => {
      assert.strictEqual(tm.boolean().validate(false).value, false);
    });
    it('coerces "true"', () => {
      assert.strictEqual(tm.boolean().validate('true').value, true);
    });
    it('coerces "false"', () => {
      assert.strictEqual(tm.boolean().validate('false').value, false);
    });
    it('coerces 1', () => {
      assert.strictEqual(tm.boolean().validate(1).value, true);
    });
    it('coerces 0', () => {
      assert.strictEqual(tm.boolean().validate(0).value, false);
    });
    it('rejects arbitrary string', () => {
      assert.strictEqual(tm.boolean().validate('yes').valid, false);
    });
  });

  // ── Array ──

  describe('tm.array()', () => {
    it('validates an array of strings', () => {
      const r = tm.array(tm.string()).validate(['a', 'b']);
      assert.deepStrictEqual(r.value, ['a', 'b']);
    });
    it('validates an array of numbers', () => {
      const r = tm.array(tm.number()).validate([1, 2, 3]);
      assert.deepStrictEqual(r.value, [1, 2, 3]);
    });
    it('coerces array items', () => {
      assert.deepStrictEqual(tm.array(tm.number()).validate(['1', '2']).value, [1, 2]);
    });
    it('coerces single value to array', () => {
      assert.deepStrictEqual(tm.array(tm.string()).validate('solo').value, ['solo']);
    });
    it('coerces single number to array', () => {
      assert.deepStrictEqual(tm.array(tm.number()).validate(42).value, [42]);
    });
    it('rejects non-array non-coercible', () => {
      assert.strictEqual(tm.array(tm.number()).validate('abc').valid, false);
    });
    it('reports errors for invalid items', () => {
      const r = tm.array(tm.number()).validate([1, 'abc', 3]);
      assert.strictEqual(r.valid, false);
      assert.strictEqual(r.errors.length, 1);
      assert.ok(r.errors[0].path.includes('[1]'));
    });
    it('validates empty array', () => {
      assert.strictEqual(tm.array(tm.string()).validate([]).valid, true);
    });
    it('validates untyped array', () => {
      assert.strictEqual(tm.array().validate([1, 'a', true]).valid, true);
    });
    it('enforces min length', () => {
      assert.strictEqual(tm.array(tm.number()).min(2).validate([1]).valid, false);
      assert.strictEqual(tm.array(tm.number()).min(2).validate([1, 2]).valid, true);
    });
    it('enforces max length', () => {
      assert.strictEqual(tm.array(tm.number()).max(2).validate([1, 2, 3]).valid, false);
      assert.strictEqual(tm.array(tm.number()).max(2).validate([1, 2]).valid, true);
    });
  });

  // ── Object ──

  describe('tm.object()', () => {
    it('validates a simple object', () => {
      const s = tm.object({ name: tm.string(), age: tm.number() });
      const r = s.validate({ name: 'John', age: 30 });
      assert.strictEqual(r.valid, true);
      assert.deepStrictEqual(r.value, { name: 'John', age: 30 });
    });
    it('coerces values', () => {
      const s = tm.object({ name: tm.string(), age: tm.number() });
      assert.deepStrictEqual(s.validate({ name: 'John', age: '30' }).value, { name: 'John', age: 30 });
    });
    it('reports missing required fields', () => {
      const s = tm.object({ name: tm.string(), age: tm.number() });
      const r = s.validate({ name: 'John' });
      assert.strictEqual(r.valid, false);
      assert.ok(r.errors.some(e => e.path === 'age'));
    });
    it('strips extra keys by default', () => {
      const s = tm.object({ name: tm.string() });
      const r = s.validate({ name: 'John', extra: 'field' });
      assert.strictEqual(r.valid, true);
      assert.strictEqual(r.value.extra, undefined);
    });
    it('passthrough mode keeps extra keys', () => {
      const s = tm.object({ name: tm.string() }).passthrough();
      const r = s.validate({ name: 'John', extra: 'field' });
      assert.strictEqual(r.valid, true);
      assert.strictEqual(r.value.extra, 'field');
    });
    it('strict mode rejects extra keys', () => {
      const s = tm.object({ name: tm.string() }).strict();
      const r = s.validate({ name: 'John', extra: 'field' });
      assert.strictEqual(r.valid, false);
      assert.ok(r.errors.some(e => e.message.includes('Unexpected key')));
    });
    it('validates nested objects', () => {
      const s = tm.object({
        user: tm.object({ name: tm.string() }),
      });
      const r = s.validate({ user: { name: 'Alice' } });
      assert.strictEqual(r.valid, true);
      assert.strictEqual(r.value.user.name, 'Alice');
    });
    it('rejects non-object values', () => {
      assert.strictEqual(tm.object({ a: tm.string() }).validate('string').valid, false);
      assert.strictEqual(tm.object({ a: tm.string() }).validate(null).valid, false);
      assert.strictEqual(tm.object({ a: tm.string() }).validate([]).valid, false);
    });
    it('validates untyped object', () => {
      assert.strictEqual(tm.object().validate({ any: 'thing' }).valid, true);
    });
  });

  // ── Enum ──

  describe('tm.enum()', () => {
    it('validates matching value', () => {
      assert.strictEqual(tm.enum(['a', 'b', 'c']).validate('a').valid, true);
    });
    it('rejects non-matching value', () => {
      assert.strictEqual(tm.enum(['a', 'b', 'c']).validate('d').valid, false);
    });
    it('case-insensitive coercion for strings', () => {
      const r = tm.enum(['positive', 'negative']).validate('Positive');
      assert.strictEqual(r.valid, true);
      assert.strictEqual(r.value, 'positive');
    });
    it('case-insensitive returns canonical value', () => {
      const r = tm.enum(['ACTIVE', 'INACTIVE']).validate('active');
      assert.strictEqual(r.value, 'ACTIVE');
    });
    it('validates numeric enum', () => {
      assert.strictEqual(tm.enum([1, 2, 3]).validate(1).valid, true);
      assert.strictEqual(tm.enum([1, 2, 3]).validate(4).valid, false);
    });
    it('provides descriptive error', () => {
      const r = tm.enum(['a', 'b']).validate('z');
      assert.ok(r.errors[0].message.includes('a, b'));
    });
  });

  // ── Any ──

  describe('tm.any()', () => {
    it('accepts any value', () => {
      assert.strictEqual(tm.any().validate('string').valid, true);
      assert.strictEqual(tm.any().validate(42).valid, true);
      assert.strictEqual(tm.any().validate(null).valid, true);
      assert.strictEqual(tm.any().validate([]).valid, true);
      assert.strictEqual(tm.any().validate({}).valid, true);
    });
  });

  // ── Modifiers ──

  describe('modifiers', () => {
    it('.optional() accepts undefined', () => {
      const r = tm.string().optional().validate(undefined);
      assert.strictEqual(r.valid, true);
      assert.strictEqual(r.value, undefined);
    });
    it('.optional() still validates present values', () => {
      assert.strictEqual(tm.string().optional().validate('hello').valid, true);
      assert.strictEqual(tm.string().optional().validate({}).valid, false);
    });
    it('.nullable() accepts null', () => {
      const r = tm.string().nullable().validate(null);
      assert.strictEqual(r.valid, true);
      assert.strictEqual(r.value, null);
    });
    it('.nullable() still rejects undefined', () => {
      assert.strictEqual(tm.string().nullable().validate(undefined).valid, false);
    });
    it('.default() provides fallback', () => {
      assert.strictEqual(tm.string().default('fallback').validate(undefined).value, 'fallback');
    });
    it('.default() uses present value', () => {
      assert.strictEqual(tm.string().default('fallback').validate('provided').value, 'provided');
    });
    it('.describe() sets description', () => {
      const s = tm.number().describe('Age in years');
      assert.strictEqual(s.toJsonSchema().description, 'Age in years');
    });
    it('chaining multiple modifiers', () => {
      const s = tm.string().optional().nullable().describe('Name');
      assert.strictEqual(s.validate(undefined).valid, true);
      assert.strictEqual(s.validate(null).valid, true);
      assert.strictEqual(s.validate('test').valid, true);
    });
  });

  // ── toJsonSchema ──

  describe('toJsonSchema()', () => {
    it('string schema', () => {
      assert.deepStrictEqual(tm.string().toJsonSchema(), { type: 'string' });
    });
    it('number schema', () => {
      assert.deepStrictEqual(tm.number().toJsonSchema(), { type: 'number' });
    });
    it('boolean schema', () => {
      assert.deepStrictEqual(tm.boolean().toJsonSchema(), { type: 'boolean' });
    });
    it('enum schema', () => {
      const j = tm.enum(['a', 'b']).toJsonSchema();
      assert.strictEqual(j.type, 'string');
      assert.deepStrictEqual(j.enum, ['a', 'b']);
    });
    it('array schema', () => {
      const j = tm.array(tm.number()).toJsonSchema();
      assert.strictEqual(j.type, 'array');
      assert.deepStrictEqual(j.items, { type: 'number' });
    });
    it('object schema with required', () => {
      const j = tm.object({ name: tm.string(), age: tm.number().optional() }).toJsonSchema();
      assert.strictEqual(j.type, 'object');
      assert.ok(j.required.includes('name'));
      assert.ok(!j.required.includes('age'));
    });
    it('includes descriptions', () => {
      const j = tm.string().describe('User name').toJsonSchema();
      assert.strictEqual(j.description, 'User name');
    });
    it('nested object schema', () => {
      const j = tm.object({
        user: tm.object({ name: tm.string() }),
        tags: tm.array(tm.string()),
      }).toJsonSchema();
      assert.strictEqual(j.properties.user.type, 'object');
      assert.strictEqual(j.properties.tags.type, 'array');
    });
  });

  // ── Transform, Refine, Preprocess, Message ──

  describe('.transform()', () => {
    it('transforms value after validation', () => {
      const s = tm.string().transform(v => v.toUpperCase());
      const r = s.validate('hello');
      assert.strictEqual(r.valid, true);
      assert.strictEqual(r.value, 'HELLO');
    });

    it('chains multiple transforms', () => {
      const s = tm.string().transform(v => v.trim()).transform(v => v.toLowerCase());
      const r = s.validate('  HELLO  ');
      assert.strictEqual(r.value, 'hello');
    });

    it('transform runs after coercion', () => {
      const s = tm.number().transform(v => v * 2);
      const r = s.validate('5');
      assert.strictEqual(r.value, 10); // '5' coerced to 5, then doubled
    });

    it('does not run transform if validation fails', () => {
      let called = false;
      const s = tm.number().transform(v => { called = true; return v; });
      s.validate('not a number');
      assert.strictEqual(called, false);
    });
  });

  describe('.refine()', () => {
    it('passes when refinement returns true', () => {
      const s = tm.number().refine(v => v > 0, 'Must be positive');
      const r = s.validate(5);
      assert.strictEqual(r.valid, true);
    });

    it('fails when refinement returns false', () => {
      const s = tm.number().refine(v => v > 0, 'Must be positive');
      const r = s.validate(-1);
      assert.strictEqual(r.valid, false);
      assert.ok(r.errors[0].message.includes('Must be positive'));
    });

    it('chains multiple refinements', () => {
      const s = tm.number()
        .refine(v => v > 0, 'Must be positive')
        .refine(v => v < 100, 'Must be less than 100');
      assert.strictEqual(s.validate(50).valid, true);
      assert.strictEqual(s.validate(-1).valid, false);
      assert.strictEqual(s.validate(200).valid, false);
    });

    it('works with object message format', () => {
      const s = tm.string().refine(v => v.includes('@'), { message: 'Must be an email' });
      const r = s.validate('notanemail');
      assert.strictEqual(r.valid, false);
      assert.ok(r.errors[0].message.includes('Must be an email'));
    });

    it('refine runs after transform', () => {
      const s = tm.string()
        .transform(v => v.trim())
        .refine(v => v.length > 0, 'Cannot be empty');
      assert.strictEqual(s.validate('  hello  ').valid, true);
      assert.strictEqual(s.validate('   ').valid, false);
    });
  });

  describe('.preprocess()', () => {
    it('preprocesses value before validation', () => {
      const s = tm.number().preprocess(v => typeof v === 'string' ? parseInt(v, 10) : v);
      const r = s.validate('42');
      assert.strictEqual(r.valid, true);
      assert.strictEqual(r.value, 42);
    });

    it('chains multiple preprocessors', () => {
      const s = tm.string()
        .preprocess(v => v == null ? '' : v)
        .preprocess(v => String(v).trim());
      const r = s.validate(null);
      assert.strictEqual(r.valid, true);
      assert.strictEqual(r.value, '');
    });

    it('preprocessor runs before type checking', () => {
      const s = tm.string().preprocess(v => JSON.stringify(v));
      const r = s.validate({ a: 1 });
      assert.strictEqual(r.valid, true);
      assert.strictEqual(r.value, '{"a":1}');
    });
  });

  describe('.message()', () => {
    it('overrides default error message', () => {
      const s = tm.number().message('Please provide a valid number');
      const r = s.validate('abc');
      assert.strictEqual(r.valid, false);
      assert.strictEqual(r.errors[0].message, 'Please provide a valid number');
    });

    it('overrides message for missing required field', () => {
      const s = tm.string().message('Name is required');
      const r = s.validate(undefined);
      assert.strictEqual(r.valid, false);
      assert.strictEqual(r.errors[0].message, 'Name is required');
    });

    it('does not affect valid results', () => {
      const s = tm.string().message('Custom error');
      const r = s.validate('hello');
      assert.strictEqual(r.valid, true);
    });
  });

  // ── Complex nested validation ──

  describe('complex nested schemas', () => {
    it('validates deeply nested structure with coercion', () => {
      const s = tm.object({
        users: tm.array(tm.object({
          name: tm.string(),
          age: tm.number().optional(),
          roles: tm.array(tm.enum(['admin', 'user', 'guest'])).default([]),
        })),
        meta: tm.object({
          total: tm.number(),
          page: tm.number().default(1),
        }),
      });
      const r = s.validate({
        users: [
          { name: 'Alice', age: '28', roles: 'admin' },
          { name: 'Bob', roles: ['user', 'guest'] },
        ],
        meta: { total: '2' },
      });
      assert.strictEqual(r.valid, true);
      assert.strictEqual(r.value.users[0].age, 28);
      assert.deepStrictEqual(r.value.users[0].roles, ['admin']);
      assert.strictEqual(r.value.meta.page, 1);
      assert.strictEqual(r.value.meta.total, 2);
    });
  });
});
