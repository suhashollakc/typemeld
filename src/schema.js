/**
 * typemeld — Schema Builder
 *
 * Lightweight, chainable schema definition.
 * Compatible with zod schemas via .fromZod() adapter.
 *
 * tm.string()          — string type
 * tm.number()          — number type
 * tm.boolean()         — boolean type
 * tm.array(itemSchema) — array of items
 * tm.object({ ... })   — object with shape
 * tm.enum([...])       — one of values
 * tm.nullable()        — allows null
 * tm.optional()        — allows undefined/missing
 * tm.default(val)      — default value if missing
 * tm.describe(str)     — description (used in LLM prompts)
 */

class Schema {
  constructor(type, opts = {}) {
    this._type = type;
    this._opts = { required: true, ...opts };
  }

  optional() { return new Schema(this._type, { ...this._opts, required: false }); }
  nullable() { return new Schema(this._type, { ...this._opts, nullable: true }); }
  default(val) { return new Schema(this._type, { ...this._opts, defaultValue: val, required: false }); }
  describe(desc) { return new Schema(this._type, { ...this._opts, description: desc }); }
  /** Object mode: include keys not defined in the schema (default: strip) */
  passthrough() { return new Schema(this._type, { ...this._opts, passthrough: true }); }
  /** Object mode: reject keys not defined in the schema */
  strict() { return new Schema(this._type, { ...this._opts, strict: true }); }
  /** Minimum value/length constraint */
  min(n) { return new Schema(this._type, { ...this._opts, min: n }); }
  /** Maximum value/length constraint */
  max(n) { return new Schema(this._type, { ...this._opts, max: n }); }

  validate(value, path = '') {
    const errors = [];

    // 'any' type accepts everything including null/undefined
    if (this._type === 'any') return { valid: true, value, errors: [] };

    // Handle missing/null
    if (value === undefined || value === null) {
      if (value === null && this._opts.nullable) return { valid: true, value: null, errors: [] };
      if (!this._opts.required) return { valid: true, value: this._opts.defaultValue ?? value, errors: [] };
      if ('defaultValue' in this._opts) return { valid: true, value: this._opts.defaultValue, errors: [] };
      return { valid: false, value, errors: [{ path: path || 'root', message: `Expected ${this._type}, got ${value === null ? 'null' : 'undefined'}`, expected: this._type }] };
    }

    switch (this._type) {
      case 'string': return this._validateString(value, path);
      case 'number': return this._validateNumber(value, path);
      case 'boolean': return this._validateBoolean(value, path);
      case 'array': return this._validateArray(value, path);
      case 'object': return this._validateObject(value, path);
      case 'enum': return this._validateEnum(value, path);
      case 'any': return { valid: true, value, errors: [] };
      default: return { valid: true, value, errors: [] };
    }
  }

  _validateString(value, path) {
    let v = value;
    if (typeof v !== 'string') {
      // Coerce numbers and booleans to strings
      if (typeof v === 'number' || typeof v === 'boolean') v = String(v);
      else return { valid: false, value, errors: [{ path, message: `Expected string, got ${typeof value}`, expected: 'string' }] };
    }
    if (this._opts.min !== undefined && v.length < this._opts.min) {
      return { valid: false, value: v, errors: [{ path, message: `String length ${v.length} is less than minimum ${this._opts.min}`, expected: 'string' }] };
    }
    if (this._opts.max !== undefined && v.length > this._opts.max) {
      return { valid: false, value: v, errors: [{ path, message: `String length ${v.length} exceeds maximum ${this._opts.max}`, expected: 'string' }] };
    }
    return { valid: true, value: v, errors: [] };
  }

  _validateNumber(value, path) {
    let v = value;
    if (typeof v === 'string') { const n = Number(v); if (!isNaN(n)) v = n; }
    if (typeof v !== 'number' || isNaN(v)) {
      return { valid: false, value, errors: [{ path, message: `Expected number, got ${typeof value}`, expected: 'number' }] };
    }
    if (this._opts.min !== undefined && v < this._opts.min) {
      return { valid: false, value: v, errors: [{ path, message: `Number ${v} is less than minimum ${this._opts.min}`, expected: 'number' }] };
    }
    if (this._opts.max !== undefined && v > this._opts.max) {
      return { valid: false, value: v, errors: [{ path, message: `Number ${v} exceeds maximum ${this._opts.max}`, expected: 'number' }] };
    }
    return { valid: true, value: v, errors: [] };
  }

  _validateBoolean(value, path) {
    if (typeof value === 'boolean') return { valid: true, value, errors: [] };
    // Coerce common string booleans
    if (value === 'true' || value === 1) return { valid: true, value: true, errors: [] };
    if (value === 'false' || value === 0) return { valid: true, value: false, errors: [] };
    return { valid: false, value, errors: [{ path, message: `Expected boolean, got ${typeof value}`, expected: 'boolean' }] };
  }

  _validateArray(value, path) {
    if (!Array.isArray(value)) {
      // Coerce single value to array
      if (this._opts.itemSchema) {
        const inner = this._opts.itemSchema.validate(value, `${path}[0]`);
        if (inner.valid) return this._checkArrayLength([inner.value], path);
      }
      return { valid: false, value, errors: [{ path, message: `Expected array, got ${typeof value}`, expected: 'array' }] };
    }
    if (!this._opts.itemSchema) return this._checkArrayLength(value, path);
    const results = value.map((item, i) => this._opts.itemSchema.validate(item, `${path}[${i}]`));
    const errors = results.flatMap(r => r.errors);
    const values = results.map(r => r.value);
    if (errors.length > 0) return { valid: false, value: values, errors };
    return this._checkArrayLength(values, path);
  }

  _checkArrayLength(arr, path) {
    if (this._opts.min !== undefined && arr.length < this._opts.min) {
      return { valid: false, value: arr, errors: [{ path, message: `Array length ${arr.length} is less than minimum ${this._opts.min}`, expected: 'array' }] };
    }
    if (this._opts.max !== undefined && arr.length > this._opts.max) {
      return { valid: false, value: arr, errors: [{ path, message: `Array length ${arr.length} exceeds maximum ${this._opts.max}`, expected: 'array' }] };
    }
    return { valid: true, value: arr, errors: [] };
  }

  _validateObject(value, path) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { valid: false, value, errors: [{ path, message: `Expected object, got ${Array.isArray(value) ? 'array' : typeof value}`, expected: 'object' }] };
    }
    if (!this._opts.shape) return { valid: true, value, errors: [] };
    const result = {};
    const errors = [];
    const shapeKeys = new Set(Object.keys(this._opts.shape));

    for (const [key, schema] of Object.entries(this._opts.shape)) {
      const p = path ? `${path}.${key}` : key;
      const r = schema.validate(value[key], p);
      if (!r.valid) errors.push(...r.errors);
      if (r.value !== undefined) result[key] = r.value;
    }

    // Handle extra keys based on mode
    if (this._opts.strict) {
      for (const key of Object.keys(value)) {
        if (!shapeKeys.has(key)) {
          errors.push({ path: path ? `${path}.${key}` : key, message: `Unexpected key "${key}"`, expected: 'never' });
        }
      }
    } else if (this._opts.passthrough) {
      for (const key of Object.keys(value)) {
        if (!shapeKeys.has(key)) result[key] = value[key];
      }
    }
    // Default: strip extra keys (current behavior)

    return { valid: errors.length === 0, value: result, errors };
  }

  _validateEnum(value, path) {
    if (this._opts.values && this._opts.values.includes(value)) {
      return { valid: true, value, errors: [] };
    }
    // Case-insensitive coercion for string enums
    if (typeof value === 'string' && this._opts.values) {
      const lower = value.toLowerCase();
      const match = this._opts.values.find(v => typeof v === 'string' && v.toLowerCase() === lower);
      if (match) return { valid: true, value: match, errors: [] };
    }
    return { valid: false, value, errors: [{ path, message: `Expected one of [${this._opts.values?.join(', ')}], got "${value}"`, expected: 'enum' }] };
  }

  /** Generate a JSON Schema representation (for LLM prompting) */
  toJsonSchema() {
    const base = {};
    if (this._opts.description) base.description = this._opts.description;

    switch (this._type) {
      case 'string': return { type: 'string', ...base };
      case 'number': return { type: 'number', ...base };
      case 'boolean': return { type: 'boolean', ...base };
      case 'enum': return { type: 'string', enum: this._opts.values, ...base };
      case 'array': return {
        type: 'array',
        items: this._opts.itemSchema?.toJsonSchema() || {},
        ...base,
      };
      case 'object': {
        const properties = {};
        const required = [];
        if (this._opts.shape) {
          for (const [k, v] of Object.entries(this._opts.shape)) {
            properties[k] = v.toJsonSchema();
            if (v._opts.required) required.push(k);
          }
        }
        return { type: 'object', properties, required, ...base };
      }
      default: return base;
    }
  }

  /** Generate a prompt-friendly description of expected output */
  toPrompt() {
    const schema = this.toJsonSchema();
    return JSON.stringify(schema, null, 2);
  }
}

// ── Builder API ──
export const tm = {
  string: () => new Schema('string'),
  number: () => new Schema('number'),
  boolean: () => new Schema('boolean'),
  any: () => new Schema('any'),
  array: (itemSchema) => new Schema('array', { itemSchema }),
  object: (shape) => new Schema('object', { shape }),
  enum: (values) => new Schema('enum', { values }),
};
