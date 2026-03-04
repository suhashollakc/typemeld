import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fromZod, tm } from '../src/index.js';

// Since Zod is not a dependency, we mock Zod's internal structure
// to test the adapter without requiring the actual zod package.
// Zod schemas have a _def object with typeName and other metadata.

function mockZod(typeName, extra = {}) {
  return { _def: { typeName, ...extra } };
}

describe('fromZod()', () => {
  describe('primitive types', () => {
    it('converts ZodString to tm.string()', () => {
      const z = mockZod('ZodString');
      const schema = fromZod(z);
      const result = schema.validate('hello');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.value, 'hello');
    });

    it('converts ZodNumber to tm.number()', () => {
      const z = mockZod('ZodNumber');
      const schema = fromZod(z);
      const result = schema.validate(42);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.value, 42);
    });

    it('converts ZodBoolean to tm.boolean()', () => {
      const z = mockZod('ZodBoolean');
      const schema = fromZod(z);
      const result = schema.validate(true);
      assert.strictEqual(result.valid, true);
    });

    it('converted string schema still coerces', () => {
      const z = mockZod('ZodString');
      const schema = fromZod(z);
      const result = schema.validate(123);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.value, '123');
    });

    it('converted number schema still coerces', () => {
      const z = mockZod('ZodNumber');
      const schema = fromZod(z);
      const result = schema.validate('42');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.value, 42);
    });
  });

  describe('string with constraints', () => {
    it('converts ZodString with min/max checks', () => {
      const z = mockZod('ZodString', {
        checks: [
          { kind: 'min', value: 2 },
          { kind: 'max', value: 10 },
        ],
      });
      const schema = fromZod(z);

      assert.strictEqual(schema.validate('ab').valid, true);
      assert.strictEqual(schema.validate('a').valid, false);
      assert.strictEqual(schema.validate('a'.repeat(11)).valid, false);
    });
  });

  describe('number with constraints', () => {
    it('converts ZodNumber with min/max checks', () => {
      const z = mockZod('ZodNumber', {
        checks: [
          { kind: 'min', value: 0 },
          { kind: 'max', value: 100 },
        ],
      });
      const schema = fromZod(z);

      assert.strictEqual(schema.validate(50).valid, true);
      assert.strictEqual(schema.validate(-1).valid, false);
      assert.strictEqual(schema.validate(101).valid, false);
    });
  });

  describe('complex types', () => {
    it('converts ZodArray', () => {
      const z = mockZod('ZodArray', {
        type: mockZod('ZodString'),
      });
      const schema = fromZod(z);
      const result = schema.validate(['a', 'b']);
      assert.strictEqual(result.valid, true);
    });

    it('converts ZodArray with min/max length', () => {
      const z = mockZod('ZodArray', {
        type: mockZod('ZodString'),
        minLength: { value: 1 },
        maxLength: { value: 3 },
      });
      const schema = fromZod(z);

      assert.strictEqual(schema.validate(['a']).valid, true);
      assert.strictEqual(schema.validate([]).valid, false);
      assert.strictEqual(schema.validate(['a', 'b', 'c', 'd']).valid, false);
    });

    it('converts ZodObject', () => {
      const z = mockZod('ZodObject', {
        shape: {
          name: mockZod('ZodString'),
          age: mockZod('ZodNumber'),
        },
      });
      const schema = fromZod(z);
      const result = schema.validate({ name: 'Alice', age: 30 });
      assert.strictEqual(result.valid, true);
      assert.deepStrictEqual(result.value, { name: 'Alice', age: 30 });
    });

    it('converts ZodObject with passthrough', () => {
      const z = mockZod('ZodObject', {
        shape: { name: mockZod('ZodString') },
        unknownKeys: 'passthrough',
      });
      const schema = fromZod(z);
      const result = schema.validate({ name: 'Alice', extra: true });
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.value.extra, true);
    });

    it('converts ZodObject with strict', () => {
      const z = mockZod('ZodObject', {
        shape: { name: mockZod('ZodString') },
        unknownKeys: 'strict',
      });
      const schema = fromZod(z);
      const result = schema.validate({ name: 'Alice', extra: true });
      assert.strictEqual(result.valid, false);
    });

    it('converts ZodEnum', () => {
      const z = mockZod('ZodEnum', {
        values: ['red', 'green', 'blue'],
      });
      const schema = fromZod(z);
      assert.strictEqual(schema.validate('red').valid, true);
      assert.strictEqual(schema.validate('yellow').valid, false);
    });

    it('converted enum still does case-insensitive matching', () => {
      const z = mockZod('ZodEnum', {
        values: ['positive', 'negative'],
      });
      const schema = fromZod(z);
      const result = schema.validate('Positive');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.value, 'positive');
    });
  });

  describe('wrappers', () => {
    it('converts ZodOptional', () => {
      const z = mockZod('ZodOptional', {
        innerType: mockZod('ZodString'),
      });
      const schema = fromZod(z);
      assert.strictEqual(schema.validate(undefined).valid, true);
      assert.strictEqual(schema.validate('hello').valid, true);
    });

    it('converts ZodNullable', () => {
      const z = mockZod('ZodNullable', {
        innerType: mockZod('ZodString'),
      });
      const schema = fromZod(z);
      assert.strictEqual(schema.validate(null).valid, true);
      assert.strictEqual(schema.validate('hello').valid, true);
    });

    it('converts ZodDefault', () => {
      const z = mockZod('ZodDefault', {
        innerType: mockZod('ZodString'),
        defaultValue: 'fallback',
      });
      const schema = fromZod(z);
      const result = schema.validate(undefined);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.value, 'fallback');
    });

    it('converts ZodDefault with function default', () => {
      const z = mockZod('ZodDefault', {
        innerType: mockZod('ZodNumber'),
        defaultValue: () => 42,
      });
      const schema = fromZod(z);
      const result = schema.validate(undefined);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.value, 42);
    });

    it('converts ZodEffects (unwraps to inner schema)', () => {
      const z = mockZod('ZodEffects', {
        schema: mockZod('ZodString'),
      });
      const schema = fromZod(z);
      assert.strictEqual(schema.validate('hello').valid, true);
    });

    it('converts ZodBranded', () => {
      const z = mockZod('ZodBranded', {
        type: mockZod('ZodString'),
      });
      const schema = fromZod(z);
      assert.strictEqual(schema.validate('hello').valid, true);
    });

    it('converts ZodLazy', () => {
      const z = mockZod('ZodLazy', {
        getter: () => mockZod('ZodNumber'),
      });
      const schema = fromZod(z);
      assert.strictEqual(schema.validate(42).valid, true);
    });
  });

  describe('special types', () => {
    it('converts ZodLiteral to enum', () => {
      const z = mockZod('ZodLiteral', { value: 'fixed' });
      const schema = fromZod(z);
      assert.strictEqual(schema.validate('fixed').valid, true);
      assert.strictEqual(schema.validate('other').valid, false);
    });

    it('converts ZodUnion of literals to enum', () => {
      const z = mockZod('ZodUnion', {
        options: [
          mockZod('ZodLiteral', { value: 'a' }),
          mockZod('ZodLiteral', { value: 'b' }),
          mockZod('ZodLiteral', { value: 'c' }),
        ],
      });
      const schema = fromZod(z);
      assert.strictEqual(schema.validate('a').valid, true);
      assert.strictEqual(schema.validate('d').valid, false);
    });

    it('converts complex ZodUnion to any', () => {
      const z = mockZod('ZodUnion', {
        options: [
          mockZod('ZodString'),
          mockZod('ZodNumber'),
        ],
      });
      const schema = fromZod(z);
      assert.strictEqual(schema.validate('hello').valid, true);
      assert.strictEqual(schema.validate(42).valid, true);
    });

    it('converts ZodAny', () => {
      const z = mockZod('ZodAny');
      const schema = fromZod(z);
      assert.strictEqual(schema.validate(null).valid, true);
      assert.strictEqual(schema.validate(42).valid, true);
    });

    it('converts ZodNativeEnum', () => {
      const z = mockZod('ZodNativeEnum', {
        values: { Red: 'red', Green: 'green' },
      });
      const schema = fromZod(z);
      assert.strictEqual(schema.validate('red').valid, true);
      assert.strictEqual(schema.validate('green').valid, true);
    });

    it('converts unknown type to any', () => {
      const z = mockZod('ZodSomethingNew');
      const schema = fromZod(z);
      assert.strictEqual(schema.validate('anything').valid, true);
    });
  });

  describe('description', () => {
    it('preserves description from Zod schema', () => {
      const z = mockZod('ZodString', { description: 'User name' });
      const schema = fromZod(z);
      const jsonSchema = schema.toJsonSchema();
      assert.strictEqual(jsonSchema.description, 'User name');
    });
  });

  describe('nested conversion', () => {
    it('converts a full nested Zod-like schema', () => {
      const z = mockZod('ZodObject', {
        shape: {
          name: mockZod('ZodString'),
          age: mockZod('ZodOptional', { innerType: mockZod('ZodNumber') }),
          roles: mockZod('ZodArray', {
            type: mockZod('ZodEnum', { values: ['admin', 'user'] }),
          }),
        },
      });

      const schema = fromZod(z);
      const result = schema.validate({
        name: 'Alice',
        roles: ['admin', 'User'], // case-insensitive
      });
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.value.name, 'Alice');
      assert.deepStrictEqual(result.value.roles, ['admin', 'user']);
    });
  });
});
