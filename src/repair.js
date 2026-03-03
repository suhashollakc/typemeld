/**
 * typemeld — JSON Repair Engine
 *
 * Fixes common LLM output issues:
 * - Strips markdown fences (```json ... ```)
 * - Removes trailing commas
 * - Fixes unquoted keys
 * - Handles single-quoted strings
 * - Strips JS-style comments (line and block)
 * - Repairs truncated JSON (auto-closes brackets)
 * - Extracts JSON from surrounding text/prose
 * - Handles escaped newlines in strings
 * - Fixes NaN, Infinity, undefined → null
 */

export function repairJson(input) {
  if (typeof input !== 'string') return input;
  let s = input.trim();

  // Step 1: Extract JSON from markdown fences
  s = stripFences(s);

  // Step 2: Extract JSON object/array from surrounding prose
  s = extractJsonBlock(s);

  // Step 3: Strip comments
  s = stripComments(s);

  // Step 4: Fix common issues
  s = fixQuotes(s);
  s = fixTrailingCommas(s);
  s = fixSpecialValues(s);
  s = fixUnquotedKeys(s);

  // Step 5: Try parsing
  try { return JSON.parse(s); } catch {}

  // Step 6: Try to repair truncated JSON
  const repaired = closeBrackets(s);
  try { return JSON.parse(repaired); } catch {}

  throw new RepairError('Could not repair JSON', input);
}

function stripFences(s) {
  // Match ```json ... ``` or ``` ... ```
  const fenceRe = /```(?:json|JSON|js|javascript|typescript)?\s*\n?([\s\S]*?)```/;
  const match = s.match(fenceRe);
  if (match) return match[1].trim();

  // Also handle single backtick wrapping
  if (s.startsWith('`') && s.endsWith('`') && !s.startsWith('```')) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function extractJsonBlock(s) {
  // If it already starts with { or [, return as is
  if (/^\s*[\[{]/.test(s)) return s;

  // Find the first { or [ and take everything from there
  const objStart = s.indexOf('{');
  const arrStart = s.indexOf('[');

  let start = -1;
  if (objStart >= 0 && arrStart >= 0) start = Math.min(objStart, arrStart);
  else if (objStart >= 0) start = objStart;
  else if (arrStart >= 0) start = arrStart;

  if (start >= 0) {
    const sub = s.slice(start);
    // Find matching end
    const opener = sub[0];
    const closer = opener === '{' ? '}' : ']';
    const lastClose = sub.lastIndexOf(closer);
    if (lastClose > 0) return sub.slice(0, lastClose + 1);
    return sub; // truncated — will be handled by closeBrackets
  }

  return s;
}

function stripComments(s) {
  let result = '';
  let inString = false;
  let stringChar = '';
  let i = 0;

  while (i < s.length) {
    if (inString) {
      if (s[i] === '\\') { result += s[i] + (s[i+1] || ''); i += 2; continue; }
      if (s[i] === stringChar) { inString = false; }
      result += s[i]; i++; continue;
    }

    if (s[i] === '"' || s[i] === "'") {
      inString = true; stringChar = s[i]; result += s[i]; i++; continue;
    }

    // Line comment
    if (s[i] === '/' && s[i+1] === '/') {
      while (i < s.length && s[i] !== '\n') i++;
      continue;
    }

    // Block comment
    if (s[i] === '/' && s[i+1] === '*') {
      i += 2;
      while (i < s.length - 1 && !(s[i] === '*' && s[i+1] === '/')) i++;
      i += 2; continue;
    }

    result += s[i]; i++;
  }
  return result;
}

function fixQuotes(s) {
  // Replace single-quoted strings with double-quoted
  // Only outside of already double-quoted strings
  let result = '';
  let inDouble = false;
  let inSingle = false;
  let i = 0;

  while (i < s.length) {
    if (s[i] === '\\') { result += s[i] + (s[i+1] || ''); i += 2; continue; }

    if (!inSingle && s[i] === '"') { inDouble = !inDouble; result += s[i]; i++; continue; }

    if (!inDouble && s[i] === "'") {
      if (!inSingle) { result += '"'; inSingle = true; }
      else { result += '"'; inSingle = false; }
      i++; continue;
    }

    // Escape double quotes inside single-quoted strings
    if (inSingle && s[i] === '"') { result += '\\"'; i++; continue; }

    result += s[i]; i++;
  }
  return result;
}

function fixTrailingCommas(s) {
  // Remove commas before } or ] — string-aware
  let result = '';
  let inString = false;
  let i = 0;

  while (i < s.length) {
    if (s[i] === '\\' && inString) { result += s[i] + (s[i + 1] || ''); i += 2; continue; }
    if (s[i] === '"') { inString = !inString; result += s[i]; i++; continue; }
    if (!inString && s[i] === ',') {
      // Look ahead past whitespace for ] or }
      let j = i + 1;
      while (j < s.length && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n' || s[j] === '\r')) j++;
      if (j < s.length && (s[j] === '}' || s[j] === ']')) {
        // Skip the trailing comma
        i++;
        continue;
      }
    }
    result += s[i]; i++;
  }
  return result;
}

function fixSpecialValues(s) {
  // Replace JS-specific values outside of strings
  let result = '';
  let inString = false;
  let i = 0;

  while (i < s.length) {
    if (s[i] === '\\' && inString) { result += s[i] + (s[i+1]||''); i+=2; continue; }
    if (s[i] === '"') { inString = !inString; result += s[i]; i++; continue; }
    if (!inString) {
      if (s.slice(i, i+9) === 'undefined') { result += 'null'; i += 9; continue; }
      if (s.slice(i, i+3) === 'NaN') { result += 'null'; i += 3; continue; }
      if (s.slice(i, i+8) === 'Infinity') { result += 'null'; i += 8; continue; }
      if (s.slice(i, i+9) === '-Infinity') { result += 'null'; i += 9; continue; }
    }
    result += s[i]; i++;
  }
  return result;
}

function fixUnquotedKeys(s) {
  // Quote unquoted keys — string-aware, supports hyphens
  let result = '';
  let inString = false;
  let i = 0;

  while (i < s.length) {
    if (s[i] === '\\' && inString) { result += s[i] + (s[i + 1] || ''); i += 2; continue; }
    if (s[i] === '"') { inString = !inString; result += s[i]; i++; continue; }
    if (inString) { result += s[i]; i++; continue; }

    // Detect unquoted key: identifier chars (including hyphens) followed by :
    if (/[a-zA-Z_$]/.test(s[i])) {
      let key = '';
      let j = i;
      while (j < s.length && /[\w$-]/.test(s[j])) { key += s[j]; j++; }
      // Skip whitespace after key
      let k = j;
      while (k < s.length && (s[k] === ' ' || s[k] === '\t')) k++;
      if (k < s.length && s[k] === ':') {
        // Check it's not already inside quotes (look back for context)
        result += '"' + key + '"';
        i = j;
        continue;
      }
    }
    result += s[i]; i++;
  }
  return result;
}

function closeBrackets(s) {
  const stack = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"' && !inString) { inString = true; continue; }
    if (c === '"' && inString) { inString = false; continue; }
    if (inString) continue;

    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      if (stack.length && stack[stack.length-1] === c) stack.pop();
    }
  }

  // If we're in a string, close it
  if (inString) s += '"';

  // Remove trailing comma
  s = s.replace(/,\s*$/, '');

  // Handle dangling key with colon but no value: "key": → "key": null
  s = s.replace(/:\s*$/, ': null');

  // Handle dangling key without colon inside object: , "key" } → remove it
  // If the innermost open bracket is }, remove a trailing bare string key
  if (stack.length && stack[stack.length - 1] === '}') {
    s = s.replace(/,\s*"[^"]*"\s*$/, '');
  }

  // Remove trailing comma (again after cleanup)
  s = s.replace(/,\s*$/, '');

  // Close all open brackets
  while (stack.length) s += stack.pop();

  return s;
}

export class RepairError extends Error {
  constructor(message, input) {
    super(message);
    this.name = 'RepairError';
    this.input = input;
  }
}
