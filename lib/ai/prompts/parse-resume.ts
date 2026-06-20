/**
 * Prompt for parsing raw resume text (extracted from a PDF) into the
 * structured `ParsedResume` shape. Run with Haiku.
 *
 * The system prompt is static across all calls, so it's marked cacheable by the
 * route. Version the constant name when changing the prompt materially.
 */

export const PARSE_RESUME_SYSTEM_V1 = `You convert raw resume text into structured JSON. The text was extracted from a PDF, so spacing, column order, and line breaks may be imperfect — reconstruct the intended structure.

Return ONLY a JSON object (no prose, no code fences) with this exact shape:
{
  "sections": {
    "contact": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "website": "" },
    "summary": "",
    "experience": [
      { "company": "", "title": "", "location": "", "startDate": "", "endDate": "", "bullets": ["", ""] }
    ],
    "education": [
      { "school": "", "degree": "", "field": "", "startDate": "", "endDate": "", "details": "" }
    ],
    "skills": ["", ""],
    "projects": [
      { "name": "", "description": "", "link": "", "bullets": ["", ""] }
    ]
  },
  "target_roles": ["", ""]
}

Rules:
- Dates: normalize every date to "MMM YYYY" (e.g. "Jan 2024"). For a current role use the literal "Present" as endDate. If a date is genuinely absent, use "".
- experience: list roles in reverse chronological order (most recent first). Keep each bullet's wording verbatim from the resume — do NOT rewrite, embellish, or invent content. Only fix obvious extraction artifacts (e.g. a hyphenated word split across lines, a bullet glyph stuck to the first word).
- summary: use the resume's own summary/objective text if present; otherwise "".
- skills: a flat list of individual skills/technologies. Split comma- or pipe-separated lists into separate entries. Do not duplicate.
- contact.linkedin: the LinkedIn URL or handle if present, else "".
- projects: only if the resume has a distinct projects section; otherwise [].
- target_roles: infer 3–5 job titles this person is well-suited to apply for, based on their most recent titles and skills. These are suggestions for the user to edit.
- Never fabricate contact details, employers, dates, or metrics. If unsure, leave the field empty.
- Omit no top-level key; use "" or [] for anything missing.`;

export function buildParseResumeUserPrompt(resumeText: string): string {
  return `Here is the raw resume text:\n\n<resume>\n${resumeText}\n</resume>\n\nReturn the structured JSON now.`;
}
