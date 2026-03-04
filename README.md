<p align="center">
  <img src="https://img.shields.io/npm/v/typemeld?style=flat-square&color=blue&label=npm" alt="npm version">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="license">
  <img src="https://img.shields.io/github/stars/suhashollakc/typemeld?style=flat-square&color=yellow" alt="stars">
  <img src="https://img.shields.io/badge/dependencies-0-green?style=flat-square" alt="dependencies">
  <img src="https://img.shields.io/badge/size-~3KB-orange?style=flat-square" alt="size">
  <img src="https://img.shields.io/badge/tests-222%20passing-brightgreen?style=flat-square" alt="tests">
</p>

<h1 align="center">typemeld</h1>
<p align="center"><strong>Parse, validate, and repair messy LLM outputs into clean, typed data.</strong></p>
<p align="center"><sub>Like zod, but for AI. Zero dependencies. TypeScript-ready. Streaming support. ~3KB gzipped.</sub></p>

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

// Transforms & refinements
tm.string().transform(s => s.trim().toLowerCase())
tm.number().refine(n => n > 0, 'Must be positive')
tm.string().preprocess(v => v ?? '')     // runs before validation
tm.string().message('Name is required')  // custom error messages

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

## Streaming

Parse JSON as it streams from an LLM. Works with OpenAI, Anthropic, Google, and any SSE-based API.

### `JsonStream` — Incremental parser

```javascript
import { JsonStream, tm } from 'typemeld';

const schema = tm.object({
  sentiment: tm.enum(['positive', 'negative', 'neutral']),
  confidence: tm.number(),
});

const stream = new JsonStream(schema);

// Push chunks as they arrive from the LLM
stream.push('{"sentiment":');
stream.push(' "positive",');
stream.push(' "confidence": 0.95}');

console.log(stream.value); // partial result available at any time
const final = stream.complete(); // validates against schema
// => { sentiment: "positive", confidence: 0.95 }
```

### `streamParse()` — Process async iterables

```javascript
import { streamParse, tm } from 'typemeld';

// With OpenAI
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  stream: true,
  messages: [{ role: 'user', content: 'Analyze this text...' }],
});

const schema = tm.object({
  sentiment: tm.enum(['positive', 'negative', 'neutral']),
  topics: tm.array(tm.string()),
});

for await (const { partial, done } of streamParse(
  (async function*() {
    for await (const chunk of completion) {
      yield chunk.choices[0]?.delta?.content ?? '';
    }
  })(),
  schema
)) {
  console.log(partial); // progressively more complete object
  if (done) console.log('Final validated result:', partial);
}
```

### `parseStream()` — Simple async completion

```javascript
import { parseStream, tm } from 'typemeld';

// Buffer all chunks and return final validated result
const result = await parseStream(
  (async function*() {
    for await (const chunk of anthropicStream) {
      yield chunk.delta?.text ?? '';
    }
  })(),
  schema
);
```

## Zod Adapter

Already using Zod? Use your existing schemas with typemeld's repair engine:

```javascript
import { z } from 'zod';
import { fromZod, parse } from 'typemeld';

// Your existing Zod schema
const zodSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(0).max(150),
  role: z.enum(['admin', 'user', 'guest']),
  tags: z.array(z.string()).optional(),
});

// Convert to typemeld and parse messy LLM output
const tmSchema = fromZod(zodSchema);
const result = parse(messyLlmOutput, tmSchema);
// typemeld repairs the JSON, then validates with your Zod-equivalent schema
```

The adapter supports: `string`, `number`, `boolean`, `array`, `object`, `enum`, `literal`, `union`, `optional`, `nullable`, `default`, `describe`, `min/max`, `passthrough`, `strict`, and more.

## Retry Wrapper

Automatically re-prompt the LLM when validation fails:

```javascript
import { withRetry, tm } from 'typemeld';
import OpenAI from 'openai';

const openai = new OpenAI();
const schema = tm.object({
  entities: tm.array(tm.object({
    name: tm.string(),
    type: tm.enum(['person', 'org', 'location']),
    confidence: tm.number().min(0).max(1),
  })).min(1),
});

const result = await withRetry({
  schema,
  maxRetries: 3,
  call: (messages) => openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
  }),
  extract: (res) => res.choices[0].message.content,
  prompt: 'Extract all entities from: "Tim Cook announced Apple\'s new product in Cupertino"',
  onRetry: (attempt, errors) => console.log(`Retry ${attempt}:`, errors),
});
// If the LLM returns invalid output, typemeld re-prompts with error details
// => { entities: [{ name: "Tim Cook", type: "person", confidence: 0.98 }, ...] }
```

### With Anthropic

```javascript
import Anthropic from '@anthropic-ai/sdk';
import { withRetry, tm } from 'typemeld';

const anthropic = new Anthropic();

const result = await withRetry({
  schema: tm.object({
    summary: tm.string().min(10).max(200),
    keywords: tm.array(tm.string()).min(3),
    sentiment: tm.enum(['positive', 'negative', 'neutral']),
  }),
  call: (messages) => anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: messages.find(m => m.role === 'system')?.content,
    messages: messages.filter(m => m.role !== 'system'),
  }),
  extract: (res) => res.content[0].text,
  prompt: `Summarize and analyze this article: "${articleText}"`,
});
```

## Real-world examples

### Sentiment analysis

```javascript
const sentiment = parse(llmOutput, tm.object({
  sentiment: tm.enum(['positive', 'negative', 'neutral', 'mixed']),
  confidence: tm.number().min(0).max(1),
  reasoning: tm.string().optional(),
}));
```

### Entity extraction

```javascript
const entities = parse(llmOutput, tm.object({
  entities: tm.array(tm.object({
    text: tm.string(),
    type: tm.enum(['person', 'organization', 'location', 'date', 'money']),
    start: tm.number().optional(),
    end: tm.number().optional(),
  })),
}));
```

### Product listing

```javascript
const product = parse(llmOutput, tm.object({
  name: tm.string().min(1),
  price: tm.number().min(0),
  currency: tm.enum(['USD', 'EUR', 'GBP']).default('USD'),
  inStock: tm.boolean().default(true),
  tags: tm.array(tm.string()),
  description: tm.string().max(500),
}));
```

### Code review

```javascript
const review = parse(llmOutput, tm.object({
  issues: tm.array(tm.object({
    severity: tm.enum(['critical', 'warning', 'info']),
    line: tm.number().optional(),
    message: tm.string(),
    suggestion: tm.string().optional(),
  })),
  overall: tm.enum(['approve', 'request_changes', 'comment']),
  summary: tm.string(),
}));
```

### Translation

```javascript
const translation = parse(llmOutput, tm.object({
  original: tm.string(),
  translated: tm.string(),
  language: tm.string(),
  confidence: tm.number().min(0).max(1),
  alternatives: tm.array(tm.string()).optional(),
}));
```

### Classification

```javascript
const classification = parse(llmOutput, tm.object({
  category: tm.enum(['bug', 'feature', 'question', 'docs']),
  priority: tm.enum(['low', 'medium', 'high', 'critical']),
  labels: tm.array(tm.string()),
  assignee: tm.string().optional(),
}));
```

### Structured data extraction from documents

```javascript
const invoice = parse(llmOutput, tm.object({
  vendor: tm.string(),
  invoiceNumber: tm.string(),
  date: tm.string().transform(s => new Date(s)),
  items: tm.array(tm.object({
    description: tm.string(),
    quantity: tm.number().min(1),
    unitPrice: tm.number().min(0),
  })),
  total: tm.number().min(0),
  currency: tm.enum(['USD', 'EUR', 'GBP', 'JPY']).default('USD'),
}));
```

### Multi-step agent output

```javascript
const agentStep = parse(llmOutput, tm.object({
  thought: tm.string(),
  action: tm.enum(['search', 'calculate', 'respond', 'ask_user']),
  actionInput: tm.string().optional(),
  observation: tm.string().optional(),
  finalAnswer: tm.string().optional(),
}).passthrough()); // keep any extra fields the LLM adds
```

### With transforms and refinements

```javascript
const userProfile = parse(llmOutput, tm.object({
  email: tm.string()
    .transform(s => s.trim().toLowerCase())
    .refine(s => s.includes('@'), 'Must be a valid email'),
  age: tm.number()
    .min(0).max(150)
    .refine(n => Number.isInteger(n), 'Age must be a whole number'),
  bio: tm.string()
    .transform(s => s.trim())
    .refine(s => s.length > 0, 'Bio cannot be empty'),
  website: tm.string().optional()
    .transform(s => s?.startsWith('http') ? s : `https://${s}`),
}));
```

### With preprocessing

```javascript
const config = parse(llmOutput, tm.object({
  temperature: tm.number()
    .preprocess(v => typeof v === 'string' ? parseFloat(v) : v)
    .min(0).max(2),
  model: tm.string()
    .preprocess(v => typeof v === 'string' ? v.trim() : String(v)),
}));
```

## Why not just use zod?

zod is excellent for general validation. typemeld is purpose-built for LLM outputs:

| Feature | zod | typemeld |
|---|---|---|
| JSON repair (fences, commas, quotes) | &#x274C; | &#x2705; |
| Extract JSON from prose | &#x274C; | &#x2705; |
| Fix truncated JSON | &#x274C; | &#x2705; |
| Streaming JSON parser | &#x274C; | &#x2705; |
| LLM retry wrapper | &#x274C; | &#x2705; |
| Zod schema adapter | N/A | &#x2705; |
| Smart type coercion | Partial | &#x2705; Full |
| Single value &rarr; array coercion | &#x274C; | &#x2705; |
| Case-insensitive enum matching | &#x274C; | &#x2705; |
| Multiple JSON extraction | &#x274C; | &#x2705; |
| LLM prompt generation | &#x274C; | &#x2705; |
| Transform / refine / preprocess | &#x2705; | &#x2705; |
| Custom error messages | &#x2705; | &#x2705; |
| Min/max constraints | &#x2705; | &#x2705; |
| passthrough / strict modes | &#x2705; | &#x2705; |
| TypeScript types | &#x2705; Built-in | &#x2705; Built-in |
| Zero dependencies | &#x274C; (standalone) | &#x2705; |
| Bundle size | ~14KB | ~3KB |

Use zod for form validation. Use typemeld for LLM outputs. Or use both together with `fromZod()`.

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

- More LLM output edge cases and repair strategies
- Integration guides for popular frameworks (LangChain, Vercel AI SDK, AutoGPT)
- XML/YAML repair modes
- Performance benchmarks

```bash
git clone https://github.com/suhashollakc/typemeld.git
cd typemeld && npm install && npm test
```

## License

MIT &copy; [Suhas Holla](https://github.com/suhashollakc)
