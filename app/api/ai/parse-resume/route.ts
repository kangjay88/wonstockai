import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

import { describeAnthropicError, getAnthropic, MODELS } from "@/lib/ai/client";
import { parseModelJson } from "@/lib/ai/json";
import {
  PARSE_RESUME_SYSTEM_V1,
  buildParseResumeUserPrompt,
} from "@/lib/ai/prompts/parse-resume";
import { getOptionalUser } from "@/lib/supabase/auth";
import { parsedResumeSchema } from "@/lib/types";

// pdf.js (via unpdf) and the Anthropic SDK need the Node runtime, not edge.
export const runtime = "nodejs";
// Resume parse = PDF extraction + one Haiku call; comfortably under a minute.
export const maxDuration = 60;

const MAX_FILE_BYTES = 6 * 1024 * 1024; // 6 MB
const MAX_TEXT_CHARS = 30_000; // bound token usage on the Haiku call

export async function POST(request: Request) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' field." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "File must be a PDF." },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "PDF is too large (max 6 MB)." },
      { status: 413 }
    );
  }

  // --- Extract text from the PDF -------------------------------------------
  let text: string;
  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const extracted = await extractText(pdf, { mergePages: true });
    text = (Array.isArray(extracted.text)
      ? extracted.text.join("\n")
      : extracted.text
    ).trim();
  } catch {
    return NextResponse.json(
      { error: "Could not read this PDF. Is it a valid, text-based PDF?" },
      { status: 422 }
    );
  }

  if (text.length < 30) {
    return NextResponse.json(
      {
        error:
          "Almost no text found. If your resume is a scanned image, export a text-based PDF and retry.",
      },
      { status: 422 }
    );
  }
  text = text.slice(0, MAX_TEXT_CHARS);

  // --- Haiku parse, with one retry on bad JSON -----------------------------
  const anthropic = getAnthropic();
  const userPrompt = buildParseResumeUserPrompt(text);

  async function callHaiku() {
    const message = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: PARSE_RESUME_SYSTEM_V1,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = message.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : "";
  }

  try {
    const parsed = parseModelJson(await callHaiku(), parsedResumeSchema);
    return NextResponse.json(parsed);
  } catch (firstError) {
    // Hard API errors (billing, auth, rate limit) won't fix on retry — surface
    // them. Only JSON/validation failures are worth a second attempt.
    const apiError = describeAnthropicError(firstError);
    if (apiError) {
      return NextResponse.json(
        { error: apiError.message },
        { status: apiError.status }
      );
    }
    try {
      const parsed = parseModelJson(await callHaiku(), parsedResumeSchema);
      return NextResponse.json(parsed);
    } catch (secondError) {
      const retryApiError = describeAnthropicError(secondError);
      if (retryApiError) {
        return NextResponse.json(
          { error: retryApiError.message },
          { status: retryApiError.status }
        );
      }
      return NextResponse.json(
        { error: "Failed to parse the resume. Please try again." },
        { status: 502 }
      );
    }
  }
}
