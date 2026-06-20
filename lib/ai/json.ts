import type { ZodType } from "zod";

/**
 * Extracts a JSON object/array from a model's text response.
 *
 * Models occasionally wrap JSON in ```json fences or add a sentence before it,
 * despite instructions. We strip fences, then fall back to slicing from the
 * first brace/bracket to its matching last one before parsing.
 */
export function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to brace-slicing.
  }

  const start = cleaned.search(/[[{]/);
  if (start === -1) {
    throw new Error("No JSON object found in model response.");
  }
  const open = cleaned[start];
  const close = open === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(close);
  if (end <= start) {
    throw new Error("Unterminated JSON in model response.");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Parses model text into a typed, validated value via a Zod schema.
 * Throws if the text isn't JSON or doesn't satisfy the schema — callers retry.
 */
export function parseModelJson<T>(text: string, schema: ZodType<T>): T {
  return schema.parse(extractJson(text));
}
