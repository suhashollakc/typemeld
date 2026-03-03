<p align="center">
  <img src="https://img.shields.io/npm/v/typemeld?style=flat-square&color=blue&label=npm" alt="npm version">
  <img src="https://img.shields.io/npm/dm/typemeld?style=flat-square&color=green&label=downloads" alt="npm downloads">
  <img src="https://img.shields.io/github/stars/suhashollakc/typemeld?style=flat-square&color=yellow" alt="stars">
  <img src="https://img.shields.io/bundlephobia/minzip/typemeld?style=flat-square&color=orange&label=size" alt="bundle size">
  <img src="https://img.shields.io/github/license/suhashollakc/typemeld?style=flat-square" alt="license">
</p>

<h1 align="center">typemeld</h1>
<p align="center"><strong>Parse, validate, and repair messy LLM outputs into clean, typed data.</strong></p>
<p align="center"><sub>Like zod, but for AI. Zero dependencies. TypeScript-ready. ~3KB gzipped.</sub></p>

---

Every developer building with LLMs hits the same wall:

```
You: "Return JSON with name, age, and tags"

GPT/Claude: "Sure! Here's the data:

```json
{name: 'John', age: "30", tags: "developer",}  // trailing comma, unquoted keys, wrong types
```

Let me know if you need anything else!"
```

**typemeld** fixes this in one line:

```javascript
import { parse, tm } from 'typemeld';

const user = parse(llmOutput, tm.object({
  name: tm.string(),
  age: tm.number(),
  tags: tm.array(tm.string()),
}));
// => { name: "John", age: 30, tags: ["developer"] }
```

It strips the markdown fences, extracts the JSON from surrounding prose, fixes the trailing comma, quotes the keys, coerces `"30"` to `30`, wraps `"developer"` into `["developer"]`, and validates every field. One function call.

## Install

```bash
npm install typemeld
```

Zero dependencies. Works in Node.js 18+, Bun, Deno, and browsers.

## What it repairs

| LLM quirk | Example | typemeld handles it |
|---|---|---|
| Markdown fences | `` ```json { ... } ``` `` | &#x2705; Stripped |
| JSON in prose | `"Sure! Here's the data: { ... } Hope that helps!"` | &#x2705; Extracted |
| Trailing commas | `{ "a": 1, "b": 2, }` | &#x2705; Fixed |
| Unquoted keys | `{ name: "John" }` | &#x2705; Quoted |
| Single quotes | `{ 'name': 'John' }` | &#x2705; Converted |
| JS comments | `{ "a": 1 // comment }` | &#x2705; Stripped |
| Truncated JSON | `{ "items": ["one", "tw` | &#x2705; Auto-closed |
| NaN / undefined | `{ "value": NaN }` | &#x2705; &rarr; `null` |
| Infinity | `{ "n": Infinity }` | &#x2705; &rarr; `null` |
| Wrong types | `{ "age": "30" }` with number schema | &#x2705; Coerced to `30` |
| String &rarr; array | `{ "tags": "dev" }` with array schema | &#x2705; Wrapped to `["dev"]` |
| String booleans | `{ "ok": "true" }` with boolean schema | &#x2705; Coerced to `true` |
| Case mismatch | `{ "mood": "Positive" }` with `enum(['positive', ...])` | &#x2705; Coerced to `"positive"` |

## API

### `parse(input, schema?)`

Parse and validate. Throws `ParseError` on failure.

```javascript
import { parse, tm } from 'typemeld';

// Without schema — just repair JSON
const data = parse('```json\n{"key": "value",}\n```');
// => { key: "value" }

// With schema — repair + validate + coerce
const result = parse(messy_llm_output, tm.object({
  sentiment: tm.enum(['positive', 'negative', 'neutral']),
  confidence: tm.number(),
  summary: tm.string(),
}));
```

### `safeParse(input, schema?)`

Same as `parse` but never throws. Returns `{ success, data, errors }`.

```javascript
import { safeParse, tm } from 'typemeld';

const result = safeParse(llmOutput, schema);
if (result.success) {
  console.log(result.data);
} else {
  console.log(result.errors);
  // [{ path: "confidence", message: "Expected number, got undefined", expected: "number" }]
}
```

### `repairJson(input)`

Low-level JSON repair without schema validation.

```javascript
import { repairJson } from 'typemeld';

repairJson("{name: 'John', age: 30,}");
// => { name: "John", age: 30 }

repairJson('Sure! Here is the data:\n{"result": true}\nHope this helps!');
// => { result: true }

repairJson('{"items": ["one", "two", "thr');
// => { items: ["one", "two", "thr"] }
```

### `extractAll(input)`

Extract multiple JSON objects from a single LLM response.

```javascript
import { extractAll } from 'typemeld';

const objects = extractAll('First: {"a": 1} and then {"b": 2} finally {"c": 3}');
// => [{ a: 1 }, { b: 2 }, { c: 3 }]
```

### `promptFor(schema, options?)`

Generate a prompt fragment describing the expected output format.

```javascript
import { promptFor, tm } from 'typemeld';

const schema = tm.object({
  sentiment: tm.enum(['positive', 'negative', 'neutral']).describe('Overall sentiment'),
  confidence: tm.number().describe('Confidence score between 0 and 1'),
  summary: tm.string().describe('One sentence summary'),
});

const systemPrompt = `Analyze the following text.\n${promptFor(schema, { strict: true })}`;
// Generates JSON Schema instructions the LLM can follow
```

## Schema Builder

typemeld includes a lightweight, chainable schema builder. No zod dependency needed.

```javascript
import { tm } from 'typemeld';

// Primitives
tm.string()
tm.number()
tm.boolean()
tm.any()

// Complex
tm.array(tm.string())                    // string[]
tm.object({ name: tm.string() })         // { name: string }
tm.enum(['a', 'b', 'c'])                 // 'a' | 'b' | 'c'

// Modifiers (chainable)
tm.string().optional()                   // string | undefined
tm.string().nullable()                   // string | null
tm.string().default('hello')             // defaults to "hello" if missing
tm.number().describe('User age in years') // description for LLM prompts

// Constraints
tm.string().min(1).max(100)              // length between 1 and 100
tm.number().min(0).max(1)                // value between 0 and 1
tm.array(tm.string()).min(1).max(10)     // array length between 1 and 10

// Object modes
tm.object({ ... })                       // strips extra keys (default)
tm.object({ ... }).passthrough()         // keeps extra keys
tm.object({ ... }).strict()              // rejects extra keys

// Nested
tm.object({
  user: tm.object({
    name: tm.string(),
    email: tm.string().optional(),
  }),
  scores: tm.array(tm.number()),
  status: tm.enum(['active', 'inactive']).default('active'),
})
```

### Type coercion

The schema validator intelligently coerces values when possible:

```javascript
// String → Number
parse('{"age": "30"}', tm.object({ age: tm.number() }))
// => { age: 30 }

// String → Boolean
parse('{"ok": "true"}', tm.object({ ok: tm.boolean() }))
// => { ok: true }

// Single value → Array
parse('{"tags": "dev"}', tm.object({ tags: tm.array(tm.string()) }))
// => { tags: ["dev"] }

// Number → String
parse('{"id": 123}', tm.object({ id: tm.string() }))
// => { id: "123" }

// Case-insensitive enum
parse('{"mood": "Positive"}', tm.object({ mood: tm.enum(['positive', 'negative']) }))
// => { mood: "positive" }
```

## Real-world example

```javascript
import Anthropic from '@anthropic-ai/sdk';
import { parse, tm, promptFor } from 'typemeld';

const schema = tm.object({
  sentiment: tm.enum(['positive', 'negative', 'neutral']),
  confidence: tm.number(),
  topics: tm.array(tm.string()),
  summary: tm.string(),
});

const client = new Anthropic();
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: `You are a text analyzer.\n${promptFor(schema, { strict: true })}`,
  messages: [{ role: 'user', content: `Analyze: "${articleText}"` }],
});

// This just works — even if Claude wraps it in fences or adds commentary
const analysis = parse(response.content[0].text, schema);
console.log(analysis.sentiment);  // "positive"
console.log(analysis.confidence); // 0.92
console.log(analysis.topics);     // ["technology", "innovation"]
```

## Why not just use zod?

zod is excellent for general validation. typemeld is purpose-built for LLM outputs:

| Feature | zod | typemeld |
|---|---|---|
| JSON repair (fences, commas, quotes) | &#x274C; | &#x2705; |
| Extract JSON from prose | &#x274C; | &#x2705; |
| Fix truncated JSON | &#x274C; | &#x2705; |
| Smart type coercion | Partial | &#x2705; Full |
| Single value &rarr; array coercion | &#x274C; | &#x2705; |
| Case-insensitive enum matching | &#x274C; | &#x2705; |
| Multiple JSON extraction | &#x274C; | &#x2705; |
| LLM prompt generation | &#x274C; | &#x2705; |
| Min/max constraints | &#x2705; | &#x2705; |
| passthrough / strict modes | &#x2705; | &#x2705; |
| TypeScript types | &#x2705; Built-in | &#x2705; Built-in |
| Zero dependencies | &#x274C; (standalone) | &#x2705; |
| Bundle size | ~14KB | ~3KB |

Use zod for form validation. Use typemeld for LLM outputs. Or use both together.

## TypeScript

typemeld ships with built-in TypeScript declarations. Full autocomplete and type inference out of the box:

```typescript
import { parse, safeParse, tm } from 'typemeld';
import type { Infer, SafeParseResult } from 'typemeld';

const userSchema = tm.object({
  name: tm.string(),
  age: tm.number().optional(),
  roles: tm.array(tm.enum(['admin', 'user'])),
});

type User = Infer<typeof userSchema>;
// { name: string; age?: number; roles: ('admin' | 'user')[] }

const result: SafeParseResult<User> = safeParse(llmOutput, userSchema);
```

## Contributing

Contributions welcome! High-impact areas:

- More LLM output edge cases
- Streaming JSON support (parse partial chunks)
- zod adapter (`tm.fromZod(zodSchema)`)
- Retry wrapper (re-prompt LLM on validation failure)
- XML/YAML repair modes

```bash
git clone https://github.com/suhashollakc/typemeld.git
cd typemeld && npm install && npm test
```

## License

MIT &copy; [Suhas Holla](https://github.com/suhashollakc)
