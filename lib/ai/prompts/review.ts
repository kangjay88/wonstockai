import type { JdExtraction, ResumeSections } from "@/lib/types";

/**
 * Prompt for the on-demand AI review (Sonnet): the C2/C3 per-bullet rubric plus
 * semantic coverage of required skills. The system block is static (cacheable).
 */

export const REVIEW_SYSTEM_V1 = `You are a strict, fair resume reviewer. You receive a resume's experience bullets (each tagged with role and bullet indices), the candidate's skills and summary, and a list of required skills from a target job.

For EACH bullet provided, score two things:
- outcome_score (integer 1–5):
  5 = quantified outcome + clear ownership ("Cut p95 latency 32% by adding caching")
  4 = clear outcome and ownership, weak or missing metric
  3 = outcome implied but not measured
  2 = mostly activity, vague outcome
  1 = pure duty description ("Responsible for maintaining the service")
- xyz_complete (boolean): true ONLY if the bullet has all three of: Accomplished X (a concrete achievement), measured by Y (a metric or tangible result), by doing Z (the method/how). If false, set missing_element to the single most important missing piece: "metric", "method", or "outcome". If nothing is missing, set missing_element to "" (an empty string, never null).
- outcome_note: one short sentence — the specific reason for the score and what to add. This is shown to the user.

Then for skills_present: list which of the provided required skills the resume genuinely demonstrates anywhere (bullets, skills, summary), EVEN IF the wording differs (e.g. "built deployment pipelines with GitHub Actions" demonstrates "CI/CD"). Be conservative — include a skill only when the evidence is real, not aspirational. Return each using the EXACT string from the required-skills list.

Return ONLY a JSON object (no prose, no code fences):
{"bullets":[{"role_index":0,"bullet_index":0,"outcome_score":3,"outcome_note":"","xyz_complete":false,"missing_element":"metric"}],"skills_present":["..."]}

Score exactly the bullets provided — do not invent, merge, or skip any.`;

export function buildReviewUserPrompt(
  sections: ResumeSections,
  jd: JdExtraction
): string {
  const lines: string[] = [];
  sections.experience.forEach((role, r) => {
    role.bullets.forEach((b, i) => {
      if (b.trim()) lines.push(`[role ${r} bullet ${i}] ${b.trim()}`);
    });
  });

  return [
    `Summary: ${sections.summary || "(none)"}`,
    `Skills: ${sections.skills.join(", ") || "(none)"}`,
    "",
    "Experience bullets to score:",
    lines.join("\n") || "(none)",
    "",
    `Required skills to check coverage for: ${jd.required_skills.join(", ") || "(none)"}`,
    "",
    "Return the JSON now.",
  ].join("\n");
}
