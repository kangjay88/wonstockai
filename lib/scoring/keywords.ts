import type { JdExtraction, ResumeSections } from "@/lib/types";

import type { CheckResult, Fix } from "./types";
import {
  ACRONYM_PAIRS,
  bulletCorpus,
  countOccurrences,
  normalize,
  resumeCorpus,
  skillPresent,
  termPresent,
} from "./util";

const SENIORITY_WORDS = [
  "senior", "lead", "staff", "principal", "manager", "head", "director", "architect",
];
const SENIORITY_VERBS = [
  "led", "architected", "owned", "mentored", "managed", "directed", "drove", "spearheaded",
];

// B1 — required-skill coverage (50% of category) ------------------------------
function requiredCoverage(
  jd: JdExtraction,
  corpus: string,
  semanticPresent: Set<string>
): CheckResult {
  const req = jd.required_skills;
  // A skill counts if it matches literally/by synonym, or the AI review judged
  // the resume demonstrates it semantically.
  const isPresent = (s: string) =>
    skillPresent(s, corpus) || semanticPresent.has(s.toLowerCase());
  const missing = req.filter((s) => !isPresent(s));
  const present = req.length - missing.length;
  const score = req.length ? (present / req.length) * 100 : 100;
  const each = req.length ? (100 / req.length) * 0.5 : 0;
  const fixes: Fix[] = missing.map((s) => ({
    checkId: "B1",
    message: `Add the required skill "${s}" where you genuinely have it (ideally inside a bullet).`,
    item: s,
    cost: each,
  }));
  return {
    id: "B1",
    label: "Required-skill coverage",
    kind: "subscore",
    score,
    weight: 0.5,
    penalty: 0,
    fixes,
    detail: `${present}/${req.length} required skills present`,
  };
}

// B2 — preferred-skill coverage (15%) ----------------------------------------
function preferredCoverage(jd: JdExtraction, corpus: string): CheckResult {
  const pref = jd.preferred_skills;
  const missing = pref.filter((s) => !skillPresent(s, corpus));
  const present = pref.length - missing.length;
  const score = pref.length ? (present / pref.length) * 100 : 100;
  const fixes: Fix[] = missing.slice(0, 5).map((s) => ({
    checkId: "B2",
    message: `Consider adding the preferred skill "${s}" if you have it.`,
    item: s,
    cost: pref.length ? (100 / pref.length) * 0.15 : 0,
  }));
  return {
    id: "B2",
    label: "Preferred-skill coverage",
    kind: "subscore",
    score,
    weight: 0.15,
    penalty: 0,
    fixes,
    detail: `${present}/${pref.length} preferred skills present`,
  };
}

// B3 — placement quality (15%) -----------------------------------------------
function placementQuality(jd: JdExtraction, corpus: string, bullets: string): CheckResult {
  const present = jd.required_skills.filter((s) => skillPresent(s, corpus));
  if (!present.length) {
    return {
      id: "B3",
      label: "Skill placement quality",
      kind: "subscore",
      score: jd.required_skills.length ? 0 : 100,
      weight: 0.15,
      penalty: 0,
      fixes: [],
      detail: "No required skills present to place",
    };
  }
  const inBullets = present.filter((s) => skillPresent(s, bullets));
  const placement =
    present.reduce((sum, s) => sum + (skillPresent(s, bullets) ? 1 : 0.5), 0) /
    present.length;
  const skillsOnly = present.filter((s) => !skillPresent(s, bullets));
  const fixes: Fix[] = skillsOnly.slice(0, 4).map((s) => ({
    checkId: "B3",
    message: `Move "${s}" from the skills list into an achievement bullet — recruiters discount bare lists.`,
    item: s,
    cost: 6,
  }));
  return {
    id: "B3",
    label: "Skill placement quality",
    kind: "subscore",
    score: Math.round(placement * 100),
    weight: 0.15,
    penalty: 0,
    fixes,
    detail: `${inBullets.length}/${present.length} matched skills appear inside bullets`,
  };
}

// B4 — title alignment (10%) --------------------------------------------------
function titleAlignment(jd: JdExtraction, sections: ResumeSections): CheckResult {
  const variants = jd.title_variants;
  const headline = normalize(
    [sections.summary, ...sections.experience.map((r) => r.title)].join(" \n ")
  );
  const aligned = !variants.length || variants.some((t) => termPresent(t, headline));
  return {
    id: "B4",
    label: "Title alignment",
    kind: "subscore",
    score: aligned ? 100 : 0,
    weight: 0.1,
    penalty: 0,
    fixes: aligned
      ? []
      : [
          {
            checkId: "B4",
            message: `Reflect the target title (e.g. "${variants[0]}") in your summary or a recent role title.`,
            cost: 10,
          },
        ],
    detail: aligned ? "Target title present in headline" : "Target title missing from headline",
  };
}

// B5 — acronym duality (5%) ---------------------------------------------------
function acronymDuality(corpus: string): CheckResult {
  const relevant = ACRONYM_PAIRS.filter(
    ([a, b]) => termPresent(a, corpus) || termPresent(b, corpus)
  );
  if (!relevant.length) {
    return {
      id: "B5",
      label: "Acronym duality",
      kind: "subscore",
      score: 100,
      weight: 0.05,
      penalty: 0,
      fixes: [],
      detail: "No acronym pairs in use",
    };
  }
  const both = relevant.filter(([a, b]) => termPresent(a, corpus) && termPresent(b, corpus));
  const fixes: Fix[] = relevant
    .filter(([a, b]) => !(termPresent(a, corpus) && termPresent(b, corpus)))
    .slice(0, 3)
    .map(([a, b]) => ({
      checkId: "B5",
      message: `Spell out both forms at least once: "${a}" and "${b}".`,
      item: `${a} / ${b}`,
      cost: 2,
    }));
  return {
    id: "B5",
    label: "Acronym duality",
    kind: "subscore",
    score: Math.round((both.length / relevant.length) * 100),
    weight: 0.05,
    penalty: 0,
    fixes,
    detail: `${both.length}/${relevant.length} acronym pairs in both forms`,
  };
}

// B6 — seniority verb match (5%) ---------------------------------------------
function seniorityMatch(jd: JdExtraction, sections: ResumeSections): CheckResult {
  const signal = normalize([...jd.seniority_signals, ...jd.title_variants].join(" "));
  const isSenior = SENIORITY_WORDS.some((w) => signal.includes(w));
  if (!isSenior) {
    return {
      id: "B6",
      label: "Seniority verb match",
      kind: "subscore",
      score: 100,
      weight: 0.05,
      penalty: 0,
      fixes: [],
      detail: "Not a senior-level JD",
    };
  }
  const recent = normalize(
    sections.experience.slice(0, 2).flatMap((r) => r.bullets).join(" \n ")
  );
  const matches = SENIORITY_VERBS.filter((v) => termPresent(v, recent)).length;
  const score = matches >= 2 ? 100 : matches === 1 ? 60 : 20;
  return {
    id: "B6",
    label: "Seniority verb match",
    kind: "subscore",
    score,
    weight: 0.05,
    penalty: 0,
    fixes:
      matches >= 2
        ? []
        : [
            {
              checkId: "B6",
              message: "Use ownership verbs (led, architected, owned, mentored) in your two most recent roles.",
              cost: 5,
            },
          ],
    detail: `${matches} leadership verb(s) in recent roles`,
  };
}

// B7 — stuffing guard (penalty) ----------------------------------------------
function stuffingGuard(jd: JdExtraction, sections: ResumeSections, corpus: string): CheckResult {
  const fixes: Fix[] = [];
  let violations = 0;
  const watched = [...new Set([...jd.required_skills, ...jd.preferred_skills])];
  for (const s of watched) {
    if (countOccurrences(s, corpus) > 5) {
      violations += 1;
      fixes.push({
        checkId: "B7",
        message: `"${s}" appears more than 5 times — reads as keyword stuffing. Trim repeats.`,
        item: s,
        cost: 10,
      });
    }
  }
  if (sections.skills.length > 25) {
    violations += 1;
    fixes.push({
      checkId: "B7",
      message: `Skills list has ${sections.skills.length} items (>25). Cut to the most relevant.`,
      cost: 10,
    });
  }
  return {
    id: "B7",
    label: "Stuffing guard",
    kind: "penalty",
    score: 0,
    weight: 0,
    penalty: violations * 10,
    fixes,
    detail: violations ? `${violations} stuffing violation(s)` : "No stuffing detected",
  };
}

export function scoreKeywords(
  sections: ResumeSections,
  jd: JdExtraction,
  semanticPresent: string[] = []
): CheckResult[] {
  const corpus = resumeCorpus(sections);
  const bullets = bulletCorpus(sections);
  const semantic = new Set(semanticPresent.map((s) => s.toLowerCase()));
  return [
    requiredCoverage(jd, corpus, semantic),
    preferredCoverage(jd, corpus),
    placementQuality(jd, corpus, bullets),
    titleAlignment(jd, sections),
    acronymDuality(corpus),
    seniorityMatch(jd, sections),
    stuffingGuard(jd, sections, corpus),
  ];
}
