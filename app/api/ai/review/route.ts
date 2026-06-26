import { NextResponse } from "next/server";

import { describeAnthropicError, getAnthropic, MODELS } from "@/lib/ai/client";
import { parseModelJson } from "@/lib/ai/json";
import { REVIEW_SYSTEM_V1, buildReviewUserPrompt } from "@/lib/ai/prompts/review";
import { getOptionalUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  jdExtractionSchema,
  resumeSectionsSchema,
  reviewResultSchema,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let applicationId: string;
  try {
    const body = await request.json();
    applicationId = String(body.applicationId ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!applicationId) {
    return NextResponse.json({ error: "Missing applicationId." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: app }, { data: resume }] = await Promise.all([
    supabase
      .from("applications")
      .select("jd_extraction")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("base_resumes")
      .select("sections")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!app) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  if (!resume) {
    return NextResponse.json({ error: "No base resume to review." }, { status: 400 });
  }

  const sections = resumeSectionsSchema.safeParse(resume.sections);
  const jd = jdExtractionSchema.safeParse(app.jd_extraction ?? {});
  if (!sections.success) {
    return NextResponse.json({ error: "Base resume is malformed." }, { status: 422 });
  }

  const anthropic = getAnthropic();
  const userPrompt = buildReviewUserPrompt(
    sections.data,
    jd.success ? jd.data : jdExtractionSchema.parse({})
  );

  const call = async () => {
    const message = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 3000,
      system: [
        { type: "text", text: REVIEW_SYSTEM_V1, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = message.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : "";
  };

  try {
    return NextResponse.json(parseModelJson(await call(), reviewResultSchema));
  } catch (firstError) {
    const apiError = describeAnthropicError(firstError);
    if (apiError) {
      return NextResponse.json({ error: apiError.message }, { status: apiError.status });
    }
    try {
      return NextResponse.json(parseModelJson(await call(), reviewResultSchema));
    } catch (secondError) {
      const retryApiError = describeAnthropicError(secondError);
      if (retryApiError) {
        return NextResponse.json({ error: retryApiError.message }, { status: retryApiError.status });
      }
      return NextResponse.json({ error: "AI review failed. Please try again." }, { status: 502 });
    }
  }
}
