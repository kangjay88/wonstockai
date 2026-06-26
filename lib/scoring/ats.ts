import type { ResumeSections } from "@/lib/types";

import type { CheckResult, Fix } from "./types";
import { isValidDateToken, parseMonthYear, wordCount } from "./util";

/** Decorative glyphs / emoji that mangle ATS parsing (the standard bullet is fine). */
const DECORATIVE_GLYPHS =
  /[\p{Extended_Pictographic}←-⇿⌀-➿⬀-⯿⤀-⥿]/u;

function info(id: string, label: string, detail: string): CheckResult {
  return { id, label, kind: "info", score: 100, weight: 0, penalty: 0, fixes: [], detail };
}

// A2 — contact block complete -------------------------------------------------
function contactComplete(sections: ResumeSections): CheckResult {
  const c = sections.contact;
  const required: [string, string][] = [
    ["email", c.email],
    ["phone", c.phone],
    ["LinkedIn", c.linkedin],
  ];
  const missing = required.filter(([, v]) => !v.trim());
  const fixes: Fix[] = missing.map(([name]) => ({
    checkId: "A2",
    message: `Add your ${name} to the contact block.`,
    cost: 20 * 0.3,
  }));
  return {
    id: "A2",
    label: "Contact block complete",
    kind: "subscore",
    score: Math.max(0, 100 - 20 * missing.length),
    weight: 0.3,
    penalty: 0,
    fixes,
    detail: missing.length
      ? `Missing: ${missing.map((m) => m[0]).join(", ")}`
      : "Email, phone, LinkedIn present",
  };
}

// A3 — parseable, consistent dates -------------------------------------------
function parseableDates(sections: ResumeSections): CheckResult {
  const fixes: Fix[] = [];
  let malformed = 0;
  for (const role of sections.experience) {
    const label = `${role.title || role.company || "role"}`;
    if (!isValidDateToken(role.startDate) || !isValidDateToken(role.endDate)) {
      malformed += 1;
      fixes.push({
        checkId: "A3",
        message: `Use "MMM YYYY" dates (e.g. "Jan 2024" / "Present") for ${label}.`,
        item: `${role.startDate || "?"} – ${role.endDate || "?"}`,
        cost: 10 * 0.25,
      });
    }
  }
  return {
    id: "A3",
    label: "Parseable dates",
    kind: "subscore",
    score: Math.max(0, 100 - 10 * malformed),
    weight: 0.25,
    penalty: 0,
    fixes,
    detail: malformed
      ? `${malformed} role(s) with malformed dates`
      : "All date ranges parse cleanly",
  };
}

// A4 — reverse chronological --------------------------------------------------
function reverseChronological(sections: ResumeSections): CheckResult {
  const starts = sections.experience
    .map((r) => parseMonthYear(r.startDate))
    .filter((n): n is number => n !== null);
  let violated = false;
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] > starts[i - 1]) {
      violated = true;
      break;
    }
  }
  return {
    id: "A4",
    label: "Reverse chronological order",
    kind: "subscore",
    score: violated ? 40 : 100,
    weight: 0.15,
    penalty: 0,
    fixes: violated
      ? [{ checkId: "A4", message: "Order roles newest-first by start date.", cost: 15 }]
      : [],
    detail: violated ? "Roles are out of order" : "Newest role first",
  };
}

// A7 — length within budget ---------------------------------------------------
function lengthBudget(sections: ResumeSections, measuredPages?: number): CheckResult {
  // Rough line estimate at ~14 words/line, ~46 content lines per page.
  let lines = 5; // header + contact
  if (sections.summary.trim())
    lines += 2 + Math.ceil(wordCount(sections.summary) / 14);
  for (const role of sections.experience) {
    lines += 2;
    for (const b of role.bullets)
      if (b.trim()) lines += Math.max(1, Math.ceil(wordCount(b) / 14));
  }
  for (const proj of sections.projects) {
    lines += 1;
    for (const b of proj.bullets)
      if (b.trim()) lines += Math.max(1, Math.ceil(wordCount(b) / 14));
  }
  lines += 2 + sections.education.length;
  if (sections.skills.length)
    lines += 2 + Math.ceil(sections.skills.join(", ").length / 90);

  // Prefer the exact rendered page count when supplied; else estimate.
  const pages = measuredPages && measuredPages > 0 ? measuredPages : Math.max(1, Math.ceil(lines / 46));
  const measured = Boolean(measuredPages && measuredPages > 0);

  // Budget: 1 page under ~10 yrs experience, hard max 2.
  const nowOrdinal = new Date().getFullYear() * 12 + new Date().getMonth();
  const starts = sections.experience
    .map((r) => parseMonthYear(r.startDate))
    .filter((n): n is number => n !== null && isFinite(n));
  const ends = sections.experience
    .map((r) => parseMonthYear(r.endDate))
    .map((n) => (n === Infinity ? nowOrdinal : n))
    .filter((n): n is number => n !== null);
  const years =
    starts.length && ends.length
      ? (Math.max(...ends) - Math.min(...starts)) / 12
      : 0;
  const budget = years >= 10 ? 2 : 1;
  const over = pages > budget;

  return {
    id: "A7",
    label: "Length",
    kind: "subscore",
    score: over ? 65 : 100,
    weight: 0.1,
    penalty: 0,
    fixes: over
      ? [
          {
            checkId: "A7",
            message: `${measured ? "" : "Estimated "}${pages} pages; trim to ${budget} (≈${years >= 10 ? "10+" : "<10"} yrs experience).`,
            cost: 15,
          },
        ]
      : [],
    detail: `${measured ? "" : "≈"}${pages} page(s), budget ${budget}`,
  };
}

// A8 — no special glyphs ------------------------------------------------------
function noSpecialGlyphs(sections: ResumeSections): CheckResult {
  const texts: string[] = [
    sections.summary,
    ...sections.experience.flatMap((r) => [r.title, r.company, ...r.bullets]),
    ...sections.projects.flatMap((p) => [p.name, p.description, ...p.bullets]),
    ...sections.skills,
  ];
  const offenders = new Set<string>();
  for (const t of texts) {
    for (const ch of t) {
      if (DECORATIVE_GLYPHS.test(ch)) offenders.add(ch);
    }
  }
  const types = offenders.size;
  return {
    id: "A8",
    label: "No special glyphs",
    kind: "subscore",
    score: Math.max(0, 100 - 15 * types),
    weight: 0.1,
    penalty: 0,
    fixes: types
      ? [
          {
            checkId: "A8",
            message: `Remove decorative glyphs/emoji (${[...offenders].join(" ")}); use plain text.`,
            cost: 10,
          },
        ]
      : [],
    detail: types ? `${types} decorative glyph type(s)` : "Plain text only",
  };
}

export function scoreAts(
  sections: ResumeSections,
  measuredPages?: number
): CheckResult[] {
  return [
    info("A1", "Standard section headers", "Standard headers (guaranteed by the editor)"),
    contactComplete(sections),
    parseableDates(sections),
    reverseChronological(sections),
    info("A5", "Single column, no tables/images", "Single-column template"),
    info("A6", "Standard fonts", "Helvetica 10.5pt (template-enforced)"),
    lengthBudget(sections, measuredPages),
    noSpecialGlyphs(sections),
  ];
}
