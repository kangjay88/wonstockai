import type { JdExtraction, ResumeSections, ReviewResult } from "@/lib/types";

import { scoreAts } from "./ats";
import { scoreImpact } from "./impact";
import { scoreKeywords } from "./keywords";
import { scoreLanguage } from "./language";
import { buildCategory, type CategoryReport, type ScoreReport } from "./types";

export interface ScoreOptions {
  /** Exact rendered page count; overrides the line-estimate in A7. */
  pageCount?: number;
  /** On-demand AI review enabling C2/C3 rubric + semantic JD coverage. */
  rubric?: ReviewResult | null;
}

/**
 * Scores a resume. With a JD, uses the full four-category weighting; without
 * one, the keyword category is dropped and weights renormalize per the spec:
 *
 *   score(JD)    = 0.20·A + 0.35·B + 0.25·C + 0.20·D
 *   score(no JD) = 0.30·A + 0.40·C + 0.30·D
 *
 * All checks here are deterministic and pure — safe to run live on every edit
 * client-side, and server-side for persisted snapshots. The C2/C3 LLM rubric is
 * layered in separately (Phase 4).
 */
export function scoreResume(
  sections: ResumeSections,
  jd?: JdExtraction | null,
  opts: ScoreOptions = {}
): ScoreReport {
  const hasJD = Boolean(jd);

  const ats = buildCategory(
    "ats",
    "ATS hygiene",
    hasJD ? 0.2 : 0.3,
    scoreAts(sections, opts.pageCount)
  );
  const impact = buildCategory(
    "impact",
    "Impact & quantification",
    hasJD ? 0.25 : 0.4,
    scoreImpact(sections, opts.rubric)
  );
  const language = buildCategory(
    "language",
    "Language & readability",
    hasJD ? 0.2 : 0.3,
    scoreLanguage(sections)
  );

  const categories: CategoryReport[] = [ats];
  if (hasJD && jd) {
    categories.push(
      buildCategory(
        "keywords",
        "Keyword & relevance match",
        0.35,
        scoreKeywords(sections, jd, opts.rubric?.skills_present ?? [])
      )
    );
  }
  categories.push(impact, language);

  const weightSum = categories.reduce((s, c) => s + c.weight, 0);
  const total = Math.round(
    categories.reduce((s, c) => s + c.score * c.weight, 0) / weightSum
  );

  return { total, hasJD, categories };
}

export type { ScoreReport, CategoryReport, CheckResult, Fix } from "./types";
