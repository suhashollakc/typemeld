import { Schema } from './schema';

/**
 * Convert a Zod schema into a typemeld schema.
 * Supports: string, number, boolean, array, object, enum, optional, nullable, default, describe.
 *
 * @param zodSchema - A Zod schema instance
 * @returns Equivalent typemeld schema
 *
 * @example
 *   import { z } from 'zod';
 *   import { fromZod } from 'typemeld/adapter';
 *
 *   const zUser = z.object({ name: z.string(), age: z.number().optional() });
 *   const tmUser = fromZod(zUser);
 */
export function fromZod(zodSchema: any): Schema;
