import type { ResumeSections, ReviewResult } from "@/lib/types";

import type { CheckResult, Fix } from "./types";
import {
  allBullets,
  firstWord,
  hasDigit,
  hasScopeSignal,
  STRONG_VERBS,
  wordCount,
} from "./util";

/** Deterministic proxy for bullet strength (stands in for the C2 LLM rubric). */
export function bulletStrength(text: string): number {
  let s = 0;
  if (hasDigit(text)) s += 2;
  if (STRONG_VERBS.has(firstWord(text))) s += 1;
  if (hasScopeSignal(text)) s += 1;
  const w = wordCount(text);
  if (w >= 8 && w <= 24) s += 1;
  return s;
}

// C1 — quantification rate (recent roles weighted 2×) ------------------------
function quantification(sections: ResumeSections): CheckResult {
  const bullets = allBullets(sections);
  if (!bullets.length) {
    return {
      id: "C1",
      label: "Quantification rate",
      kind: "subscore",
      score: 0,
      weight: 0.5,
      penalty: 0,
      fixes: [{ checkId: "C1", message: "Add achievement bullets with measurable outcomes.", cost: 25 }],
      detail: "No bullets to quantify",
    };
  }
  const weight = (b: { recent: boolean }) => (b.recent ? 2 : 1);
  const total = bullets.reduce((s, b) => s + weight(b), 0);
  const quantified = bullets.reduce((s, b) => s + (hasDigit(b.text) ? weight(b) : 0), 0);
  const rate = quantified / total;
  const score = Math.min(100, Math.round((rate / 0.6) * 100));

  const fixes: Fix[] = bullets
    .filter((b) => b.recent && !hasDigit(b.text))
    .slice(0, 4)
    .map((b) => ({
      checkId: "C1",
      message: "Add a number, %, $, or scale to this bullet (or flag it needs one).",
      item: b.text,
      cost: 8,
    }));

  return {
    id: "C1",
    label: "Quantification rate",
    kind: "subscore",
    score,
    weight: 0.5,
    penalty: 0,
    fixes,
    detail: `${Math.round(rate * 100)}% of bullets quantified (target ≥60%)`,
  };
}

// C4 — scope signals in recent roles -----------------------------------------
function scopeSignals(sections: ResumeSections): CheckResult {
  const recent = allBullets(sections).filter((b) => b.recent);
  const withScope = recent.filter((b) => hasScopeSignal(b.text)).length;
  const score = withScope >= 2 ? 100 : withScope === 1 ? 60 : 20;
  return {
    id: "C4",
    label: "Scope signals",
    kind: "subscore",
    score,
    weight: 0.25,
    penalty: 0,
    fixes:
      withScope >= 2
        ? []
        : [
            {
              checkId: "C4",
              message: "Add scale to recent bullets (team size, user/request counts, budget) in ≥2 bullets.",
              cost: 12,
            },
          ],
    detail: `${withScope} recent bullet(s) signal scope`,
  };
}

// C5 — front-loaded impact (strongest bullet first in each role) -------------
function frontLoaded(sections: ResumeSections): CheckResult {
  let rolesWithMulti = 0;
  let violations = 0;
  const fixes: Fix[] = [];
  sections.experience.forEach((role) => {
    const bullets = role.bullets.filter((b) => b.trim());
    if (bullets.length < 2) return;
    rolesWithMulti += 1;
    const strengths = bullets.map(bulletStrength);
    const max = Math.max(...strengths);
    if (strengths[0] < max) {
      violations += 1;
      fixes.push({
        checkId: "C5",
        message: `Lead "${role.title || role.company}" with its strongest bullet (recruiters skim the first line).`,
        cost: 10,
      });
    }
  });
  const score = rolesWithMulti
    ? Math.round(((rolesWithMulti - violations) / rolesWithMulti) * 100)
    : 100;
  return {
    id: "C5",
    label: "Front-loaded impact",
    kind: "subscore",
    score,
    weight: 0.25,
    penalty: 0,
    fixes,
    detail: rolesWithMulti
      ? `${rolesWithMulti - violations}/${rolesWithMulti} roles lead with their strongest bullet`
      : "No multi-bullet roles",
  };
}

function bulletTextAt(sections: ResumeSections, role: number, bullet: number): string {
  return sections.experience[role]?.bullets[bullet]?.trim() ?? "";
}

// C2 — outcome vs duty (LLM rubric, mean × 20) -------------------------------
function outcomeRubric(sections: ResumeSections, rubric: ReviewResult): CheckResult {
  const scored = rubric.bullets.filter((b) => b.role_index >= 0);
  const mean = scored.reduce((s, b) => s + b.outcome_score, 0) / scored.length;
  const fixes: Fix[] = scored
    .filter((b) => b.outcome_score <= 3)
    .sort((a, b) => a.outcome_score - b.outcome_score)
    .slice(0, 5)
    .map((b) => ({
      checkId: "C2",
      message: b.outcome_note || "Rewrite to show a measured outcome and clear ownership.",
      item: bulletTextAt(sections, b.role_index, b.bullet_index),
      cost: (5 - b.outcome_score) * 4,
    }));
  return {
    id: "C2",
    label: "Outcome vs duty (AI)",
    kind: "subscore",
    score: Math.round((mean / 5) * 100),
    weight: 0.3,
    penalty: 0,
    fixes,
    detail: `Mean bullet rating ${mean.toFixed(1)}/5`,
  };
}

// C3 — XYZ structure (LLM rubric, % passing) ---------------------------------
function xyzStructure(sections: ResumeSections, rubric: ReviewResult): CheckResult {
  const scored = rubric.bullets.filter((b) => b.role_index >= 0);
  const complete = scored.filter((b) => b.xyz_complete).length;
  const fixes: Fix[] = scored
    .filter((b) => !b.xyz_complete)
    .slice(0, 5)
    .map((b) => ({
      checkId: "C3",
      message: b.missing_element
        ? `Add the missing element (${b.missing_element}) — "Accomplished X, measured by Y, by doing Z".`
        : "Restructure as: Accomplished X, measured by Y, by doing Z.",
      item: bulletTextAt(sections, b.role_index, b.bullet_index),
      cost: 6,
    }));
  return {
    id: "C3",
    label: "XYZ structure (AI)",
    kind: "subscore",
    score: scored.length ? Math.round((complete / scored.length) * 100) : 100,
    weight: 0.2,
    penalty: 0,
    fixes,
    detail: `${complete}/${scored.length} bullets follow X-Y-Z`,
  };
}

/**
 * Impact checks. Without an AI review, only the deterministic C1/C4/C5 run
 * (weights 0.5/0.25/0.25). With a review, the C2/C3 LLM rubric is layered in
 * and all five reweight to 0.20/0.30/0.20/0.15/0.15 (C1/C2/C3/C4/C5).
 */
export function scoreImpact(
  sections: ResumeSections,
  rubric?: ReviewResult | null
): CheckResult[] {
  const c1 = quantification(sections);
  const c4 = scopeSignals(sections);
  const c5 = frontLoaded(sections);

  const hasRubric = Boolean(rubric && rubric.bullets.some((b) => b.role_index >= 0));
  if (!hasRubric || !rubric) {
    return [c1, c4, c5];
  }

  c1.weight = 0.2;
  c4.weight = 0.15;
  c5.weight = 0.15;
  return [c1, outcomeRubric(sections, rubric), xyzStructure(sections, rubric), c4, c5];
}
