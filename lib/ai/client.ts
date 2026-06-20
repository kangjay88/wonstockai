import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared Anthropic client. Instantiated lazily so importing this module in a
 * context without the API key (e.g. a build step) doesn't throw.
 */
let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set.");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** Cost/quality routing per the plan: Haiku for extraction, Sonnet for tailoring. */
export const MODELS = {
  /** JD extraction + resume parsing. */
  haiku: "claude-haiku-4-5-20251001",
  /** Tailoring, rubric scoring, cover letters. */
  sonnet: "claude-sonnet-4-6",
} as const;

/**
 * Maps an Anthropic SDK error to a user-facing message + HTTP status, or null
 * if the error isn't from the API (e.g. a JSON-parse failure the caller should
 * retry). Shared by every AI route.
 */
export function describeAnthropicError(
  error: unknown
): { status: number; message: string } | null {
  if (!(error instanceof Anthropic.APIError)) {
    return null;
  }
  const status = error.status ?? 502;

  if (status === 401) {
    return {
      status: 500,
      message: "AI service authentication failed. Check ANTHROPIC_API_KEY.",
    };
  }
  if (status === 400 && /credit balance/i.test(error.message)) {
    return {
      status: 402,
      message:
        "The Anthropic account is out of credits. Add credits in Plans & Billing, then try again.",
    };
  }
  if (status === 429) {
    return {
      status: 429,
      message: "AI service rate limit reached. Wait a moment and try again.",
    };
  }
  if (status === 529) {
    return {
      status: 503,
      message: "The AI service is temporarily overloaded. Try again shortly.",
    };
  }
  return { status: 502, message: "The AI service returned an error." };
}
