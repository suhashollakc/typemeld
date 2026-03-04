/**
 * typemeld — Schema Adapters
 *
 * Convert schemas from popular validation libraries into typemeld schemas.
 * Currently supports Zod.
 *
 * Usage:
 *   import { z } from 'zod';
 *   import { fromZod } from 'typemeld/adapter';
 *
 *   const zodSchema = z.object({ name: z.string(), age: z.number() });
 *   const tmSchema = fromZod(zodSchema);
 *   const result = parse(llmOutput, tmSchema);
 */

import { tm } from './schema.js';

/**
 * Convert a Zod schema into a typemeld schema.
 * Supports: string, number, boolean, array, object, enum, optional, nullable, default, describe.
 *
 * @param {import('zod').ZodType} zodSchema - A Zod schema
 * @returns {import('./schema.js').Schema} Equivalent typemeld schema
 *
 * @example
 *   import { z } from 'zod';
 *   import { fromZod } from 'typemeld/adapter';
 *
 *   const zUser = z.object({
 *     name: z.string(),
 *     age: z.number().optional(),
 *     roles: z.array(z.enum(['admin', 'user'])),
 *   });
 *
 *   const tmUser = fromZod(zUser);
 *   parse(llmOutput, tmUser); // repair + validate using your existing Zod schema
 */
export function fromZod(zodSchema) {
  return _convertZod(zodSchema);
}

function _convertZod(z) {
  // Unwrap effects (transform, refine, preprocess, etc.)
  if (z._def?.typeName === 'ZodEffects') {
    return _convertZod(z._def.schema);
  }

  // Unwrap ZodOptional
  if (z._def?.typeName === 'ZodOptional') {
    return _convertZod(z._def.innerType).optional();
  }

  // Unwrap ZodNullable
  if (z._def?.typeName === 'ZodNullable') {
    return _convertZod(z._def.innerType).nullable();
  }

  // Unwrap ZodDefault
  if (z._def?.typeName === 'ZodDefault') {
    const defaultValue = typeof z._def.defaultValue === 'function' ? z._def.defaultValue() : z._def.defaultValue;
    return _convertZod(z._def.innerType).default(defaultValue);
  }

  // Unwrap ZodBranded / ZodPipeline / ZodLazy
  if (z._def?.typeName === 'ZodBranded') return _convertZod(z._def.type);
  if (z._def?.typeName === 'ZodPipeline') return _convertZod(z._def.in);
  if (z._def?.typeName === 'ZodLazy') return _convertZod(z._def.getter());

  const typeName = z._def?.typeName;
  let schema;

  switch (typeName) {
    case 'ZodString': {
      schema = tm.string();
      // Extract min/max checks from Zod checks array
      if (z._def.checks) {
        for (const check of z._def.checks) {
          if (check.kind === 'min') schema = schema.min(check.value);
          if (check.kind === 'max') schema = schema.max(check.value);
        }
      }
      break;
    }

    case 'ZodNumber': {
      schema = tm.number();
      if (z._def.checks) {
        for (const check of z._def.checks) {
          if (check.kind === 'min') schema = schema.min(check.value);
          if (check.kind === 'max') schema = schema.max(check.value);
        }
      }
      break;
    }

    case 'ZodBoolean':
      schema = tm.boolean();
      break;

    case 'ZodArray': {
      const itemSchema = z._def.type ? _convertZod(z._def.type) : undefined;
      schema = tm.array(itemSchema);
      if (z._def.minLength !== null && z._def.minLength !== undefined) schema = schema.min(z._def.minLength.value);
      if (z._def.maxLength !== null && z._def.maxLength !== undefined) schema = schema.max(z._def.maxLength.value);
      break;
    }

    case 'ZodObject': {
      const shape = {};
      const zodShape = z._def.shape ? (typeof z._def.shape === 'function' ? z._def.shape() : z._def.shape) : {};
      for (const [key, val] of Object.entries(zodShape)) {
        shape[key] = _convertZod(val);
      }
      schema = tm.object(shape);

      // Map Zod unknownKeys to typemeld modes
      if (z._def.unknownKeys === 'passthrough') schema = schema.passthrough();
      else if (z._def.unknownKeys === 'strict') schema = schema.strict();
      break;
    }

    case 'ZodEnum': {
      schema = tm.enum(z._def.values);
      break;
    }

    case 'ZodNativeEnum': {
      const values = Object.values(z._def.values);
      schema = tm.enum(values);
      break;
    }

    case 'ZodLiteral':
      schema = tm.enum([z._def.value]);
      break;

    case 'ZodUnion': {
      // Best-effort: if all options are literals/enums, convert to enum
      const options = z._def.options || [];
      const literals = [];
      let allLiterals = true;
      for (const opt of options) {
        if (opt._def?.typeName === 'ZodLiteral') {
          literals.push(opt._def.value);
        } else {
          allLiterals = false;
          break;
        }
      }
      if (allLiterals && literals.length > 0) {
        schema = tm.enum(literals);
      } else {
        // Fallback: use tm.any() for complex unions
        schema = tm.any();
      }
      break;
    }

    case 'ZodTuple': {
      // Convert tuple to array of any (best-effort)
      schema = tm.array(tm.any());
      break;
    }

    case 'ZodRecord': {
      schema = tm.object();
      break;
    }

    case 'ZodAny':
    case 'ZodUnknown':
      schema = tm.any();
      break;

    default:
      // Unknown Zod type — fallback to any
      schema = tm.any();
  }

  // Apply description if present
  if (z._def?.description) {
    schema = schema.describe(z._def.description);
  }

  return schema;
}
