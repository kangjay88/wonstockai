/**
 * Shared domain types for resume data.
 *
 * The same `ResumeSections` shape is the single source of truth for:
 *   - base_resumes.sections
 *   - documents.content (for doc_type = 'resume')
 *   - the resume builder editor + PDF template (Phase 2)
 *   - the scoring engine input (Phase 3)
 *
 * Dates are normalized to "MMM YYYY" (e.g. "Jan 2024") or the literal
 * "Present" for current roles, so the A3 (parseable dates) scoring check and
 * the PDF renderer can rely on one format.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod schemas — used to validate LLM output and persisted input at the edges.
// Types below are inferred from these so the schema is the single definition.
// ---------------------------------------------------------------------------

export const contactSchema = z.object({
  name: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  linkedin: z.string().default(""),
  website: z.string().default(""),
});

export const experienceEntrySchema = z.object({
  company: z.string().default(""),
  title: z.string().default(""),
  location: z.string().default(""),
  startDate: z.string().default(""), // "MMM YYYY"
  endDate: z.string().default(""), // "MMM YYYY" | "Present"
  bullets: z.array(z.string()).default([]),
});

export const educationEntrySchema = z.object({
  school: z.string().default(""),
  degree: z.string().default(""),
  field: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  details: z.string().default(""),
});

export const projectEntrySchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  link: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

export const resumeSectionsSchema = z.object({
  contact: contactSchema,
  summary: z.string().default(""),
  experience: z.array(experienceEntrySchema).default([]),
  education: z.array(educationEntrySchema).default([]),
  skills: z.array(z.string()).default([]),
  projects: z.array(projectEntrySchema).default([]),
});

export type Contact = z.infer<typeof contactSchema>;
export type ExperienceEntry = z.infer<typeof experienceEntrySchema>;
export type EducationEntry = z.infer<typeof educationEntrySchema>;
export type ProjectEntry = z.infer<typeof projectEntrySchema>;
export type ResumeSections = z.infer<typeof resumeSectionsSchema>;

// ---------------------------------------------------------------------------
// Career memory profile (career_memory.profile). Derived from a base resume;
// `roles` is a condensed view of experience used for prompt context.
// ---------------------------------------------------------------------------

export const profileRoleSchema = z.object({
  company: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});

export const careerProfileSchema = z.object({
  summary: z.string().default(""),
  roles: z.array(profileRoleSchema).default([]),
  skills: z.array(z.string()).default([]),
  education: z.array(educationEntrySchema).default([]),
  target_roles: z.array(z.string()).default([]),
});

export type ProfileRole = z.infer<typeof profileRoleSchema>;
export type CareerProfile = z.infer<typeof careerProfileSchema>;

// ---------------------------------------------------------------------------
// parse-resume route contract: what one Haiku call returns from a resume PDF.
// We ask only for the structured resume + suggested target roles; the profile
// and voice samples are derived server-side from these.
// ---------------------------------------------------------------------------

export const parsedResumeSchema = z.object({
  sections: resumeSectionsSchema,
  target_roles: z.array(z.string()).default([]),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;

/** An empty resume — the starting point for a from-scratch builder. */
export function emptyResumeSections(): ResumeSections {
  return resumeSectionsSchema.parse({ contact: {} });
}
