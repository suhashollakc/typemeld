/**
 * typemeld — Schema Builder Type Declarations
 */

/** Validation result returned by Schema.validate() */
export interface ValidationResult<T = any> {
  valid: boolean;
  value: T;
  errors: ValidationError[];
}

/** Individual validation error */
export interface ValidationError {
  path: string;
  message: string;
  expected: string;
}

/** JSON Schema representation */
export interface JsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: any[];
  [key: string]: any;
}

/** Schema definition class with chainable modifiers */
export declare class Schema<T = any> {
  /** @internal */
  readonly _type: string;
  /** @internal */
  readonly _opts: Record<string, any>;

  /** Mark field as optional (allows undefined) */
  optional(): Schema<T | undefined>;

  /** Mark field as nullable (allows null) */
  nullable(): Schema<T | null>;

  /** Provide a default value when field is missing */
  default(val: T): Schema<T>;

  /** Add a description (used in LLM prompt generation) */
  describe(desc: string): Schema<T>;

  /** Object mode: include keys not defined in the schema */
  passthrough(): Schema<T>;

  /** Object mode: reject keys not defined in the schema */
  strict(): Schema<T>;

  /** Minimum value (number), length (string), or count (array) */
  min(n: number): Schema<T>;

  /** Maximum value (number), length (string), or count (array) */
  max(n: number): Schema<T>;

  /** Validate a value against this schema */
  validate(value: any, path?: string): ValidationResult<T>;

  /** Generate a JSON Schema representation (for LLM prompting) */
  toJsonSchema(): JsonSchema;

  /** Generate a prompt-friendly description of expected output */
  toPrompt(): string;
}

/** Shape definition for tm.object() */
export type ObjectShape = Record<string, Schema<any>>;

/** Infer the TypeScript type from a Schema */
export type Infer<S> =
  S extends Schema<infer T> ? T : never;

/** Schema builder namespace */
export declare const tm: {
  /** String schema — coerces numbers and booleans to strings */
  string(): Schema<string>;

  /** Number schema — coerces numeric strings to numbers */
  number(): Schema<number>;

  /** Boolean schema — coerces "true"/"false" and 0/1 */
  boolean(): Schema<boolean>;

  /** Any schema — accepts any value without validation */
  any(): Schema<any>;

  /** Array schema — coerces single values to arrays */
  array<T>(itemSchema: Schema<T>): Schema<T[]>;

  /** Object schema with defined shape */
  object<S extends ObjectShape>(shape: S): Schema<{
    [K in keyof S]: Infer<S[K]>;
  }>;

  /** Enum schema — case-insensitive matching for strings */
  enum<T extends readonly (string | number)[]>(values: [...T]): Schema<T[number]>;
};
