"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  parsedResumeSchema,
  type CareerProfile,
  type ParsedResume,
  type ResumeSections,
} from "@/lib/types";

const MASTER_RESUME_NAME = "Master resume";
const MAX_VOICE_SAMPLES = 30;

/** Harvest the user's own bullets as voice ground-truth for tailoring. */
function harvestVoiceSamples(sections: ResumeSections): string[] {
  const bullets = [
    ...sections.experience.flatMap((e) => e.bullets),
    ...sections.projects.flatMap((p) => p.bullets),
  ]
    .map((b) => b.trim())
    .filter((b) => b.length >= 20); // skip fragments

  return Array.from(new Set(bullets)).slice(0, MAX_VOICE_SAMPLES);
}

/** Condense the structured resume into the career-memory profile. */
function deriveProfile(
  sections: ResumeSections,
  targetRoles: string[]
): CareerProfile {
  return {
    summary: sections.summary,
    roles: sections.experience.map((e) => ({
      company: e.company,
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
    })),
    skills: sections.skills,
    education: sections.education,
    target_roles: targetRoles,
  };
}

export type PersistResult = { ok: true } | { ok: false; error: string };

export async function persistCareerMemory(
  input: ParsedResume
): Promise<PersistResult> {
  const user = await requireUser();

  const validation = parsedResumeSchema.safeParse(input);
  if (!validation.success) {
    return { ok: false, error: "The submitted resume data was invalid." };
  }
  const { sections, target_roles } = validation.data;

  const supabase = await createSupabaseServerClient();
  const profile = deriveProfile(sections, target_roles);
  const voiceSamples = harvestVoiceSamples(sections);

  // --- career_memory: one row per user (insert or update) ------------------
  const { data: existingMemory } = await supabase
    .from("career_memory")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const memoryWrite = existingMemory
    ? await supabase
        .from("career_memory")
        .update({ profile, voice_samples: voiceSamples })
        .eq("id", existingMemory.id)
    : await supabase.from("career_memory").insert({
        user_id: user.id,
        profile,
        voice_samples: voiceSamples,
      });

  if (memoryWrite.error) {
    return { ok: false, error: "Could not save career memory." };
  }

  // --- base_resumes: seed/update the "Master resume" -----------------------
  const { data: existingResume } = await supabase
    .from("base_resumes")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", MASTER_RESUME_NAME)
    .maybeSingle();

  const resumeWrite = existingResume
    ? await supabase
        .from("base_resumes")
        .update({ sections })
        .eq("id", existingResume.id)
    : await supabase.from("base_resumes").insert({
        user_id: user.id,
        name: MASTER_RESUME_NAME,
        sections,
      });

  if (resumeWrite.error) {
    return { ok: false, error: "Could not seed the base resume." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  return { ok: true };
}
