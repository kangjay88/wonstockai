# Resume Scoring Engine — Criteria Spec

A hybrid scoring system: deterministic checks (TypeScript, free, run live on every edit) plus LLM rubric scoring (on demand, ~3–5¢ per run). Every check returns a 0–100 subscore **and** the list of offending items, so each deducted point maps to a clickable fix in the UI.

## One reality check before the criteria

Modern ATS platforms (Greenhouse, Lever, Workday, Ashby) are databases with search, not robot gatekeepers — they rarely auto-reject anyone. What actually happens: a recruiter keyword-searches the applicant pool, skims the top of page one for ~6–8 seconds, and decides whether to keep reading. So the system optimizes for three real-world outcomes:

1. **Parseability** — the ATS extracts your data into the right fields without mangling it.
2. **Searchability** — you surface when a recruiter searches the terms from their own job description.
3. **Skimmability** — the first third of page one survives a 7-second human scan.

Weights below reflect that ordering of what actually moves interviews.

---

## Category A — ATS hygiene (weight: 20%)

Mostly pass/fail checks. Since the app controls the PDF export template, several are guaranteed-by-construction; check them anyway so imported resumes get scored honestly.

| # | Check | How to compute | Scoring |
|---|-------|----------------|---------|
| A1 | Standard section headers | Headers match whitelist: Summary, Experience / Work Experience / Professional Experience, Education, Skills, Projects, Certifications | −15 per nonstandard header (e.g. "My Journey", "What I've Built") |
| A2 | Contact block complete | Regex: email, phone, LinkedIn URL; located in body (not header/footer region — some parsers skip those) | −20 each missing; −10 if only in header/footer |
| A3 | Parseable dates | Every role has `MMM YYYY – MMM YYYY` or `MMM YYYY – Present`; consistent format throughout | −10 per malformed/missing range; −5 for mixed formats |
| A4 | Reverse chronological | Role start dates strictly descending | −15 if violated |
| A5 | Single column, no tables/text boxes/images | Structural check on the template; for imported PDFs, detect multi-column via text x-coordinates | Fail = cap category at 40 |
| A6 | Standard fonts, 10.5–12pt body | Template-enforced; check on import | −10 |
| A7 | Length | 1 page if <10 yrs experience, hard max 2 pages | −15 over budget |
| A8 | No special glyphs in text | Icons, emoji, decorative bullets (▸ ✦) replaced with plain hyphens/standard bullets in export | −5 per occurrence type |
| A9 | File name | `FirstLast_Resume.pdf` (or `_CompanyName` suffix) — auto-set at export | informational only |

## Category B — Keyword & relevance match (weight: 35% with a JD; 0% without)

Run one cached Haiku call per application to extract from the JD: `required_skills[]`, `preferred_skills[]`, `title_variants[]`, `seniority_signals[]`, `domain_terms[]`. Everything below is then deterministic string/synonym matching against the resume.

| # | Check | How to compute | Scoring |
|---|-------|----------------|---------|
| B1 | Required-skill coverage | % of `required_skills` present anywhere in resume (synonym/acronym aware) | linear 0–100; this is the heaviest single subscore (50% of category) |
| B2 | Preferred-skill coverage | Same for `preferred_skills` | linear, 15% of category |
| B3 | Placement quality | Skills appearing inside experience bullets score 1.0; skills-section-only score 0.5 (recruiters discount bare lists) | ratio-based, 15% of category |
| B4 | Title alignment | Target title or close variant appears in headline/summary (e.g. JD says "Senior Software Engineer", resume headline says it too) | pass/fail, 10% of category |
| B5 | Acronym duality | Terms with known acronym pairs appear in both forms at least once ("CI/CD" + "continuous integration"; "AWS" + "Amazon Web Services") — covers both search behaviors | per-pair, 5% of category |
| B6 | Seniority verb match | Senior JDs expect led/architected/owned/mentored in recent roles; count matches in most recent 2 roles | 5% of category |
| B7 | Stuffing guard | Any single keyword >5 occurrences, or skills section >25 items | −10 per violation (prevents gaming B1) |

Synonym table is a maintained JSON map (`react ↔ react.js ↔ reactjs`, `postgres ↔ postgresql`, etc.). Start with ~100 pairs for software roles; grow it when B1 misses something you know is on the resume.

## Category C — Impact & quantification (weight: 25%)

The category recruiters actually feel. Half deterministic, half LLM rubric.

| # | Check | How to compute | Scoring |
|---|-------|----------------|---------|
| C1 | Quantification rate | % of bullets containing a number, %, $, time span, or scale word with digits ("600+ forms", "$10M", "32%") | 100 at ≥60% of bullets, linear below; recent roles weighted 2× |
| C2 | Outcome vs duty (LLM rubric) | Per bullet, 1–5 anchored scale: 5 = quantified outcome + clear ownership; 3 = outcome implied, not measured; 1 = duty description ("responsible for maintaining…") | mean × 20 |
| C3 | XYZ structure (LLM rubric) | Accomplished X, measured by Y, by doing Z — detected per bullet, returned as boolean + missing element | % of bullets passing |
| C4 | Scope signals | Regex/NER for team size, user counts, request volume, budget ("team of 6", "2M users") in at least 2 recent bullets | stepwise |
| C5 | Front-loaded impact | The strongest bullet (highest C2) is the FIRST bullet of each role — matches skim behavior | −10 per role where it isn't (and the fix is a one-click reorder) |

LLM rubric calls return per-bullet integer scores + one-line justification (the UI explanation) + which element is missing (drives the suggestion).

## Category D — Language & readability (weight: 20%)

All deterministic. This is also your anti-"bland AI tone" enforcement layer.

| # | Check | How to compute | Scoring |
|---|-------|----------------|---------|
| D1 | Action-verb starts | First token of each bullet ∈ strong-verb list (led, built, architected, migrated, shipped, reduced, designed…) | % of bullets passing |
| D2 | Weak-opener blacklist | "Responsible for", "Helped", "Worked on", "Assisted with", "Duties included", "Tasked with" | −8 per occurrence |
| D3 | Verb diversity | No verb opens more than 2 bullets resume-wide | −5 per excess repeat |
| D4 | Cliché & buzzword filter | "Results-driven", "team player", "go-getter", "synergy", "passionate about", "detail-oriented" | −5 each |
| D5 | AI-tell filter | Over-represented LLM vocabulary: "spearheaded" (>1), "leveraged" (>2), "delve", "utilize", "honed", "showcasing" — recruiters increasingly pattern-match these as AI-written | −5 per threshold breach; also a hard constraint in the tailoring prompt |
| D6 | Bullet length | 8–24 words, ≤2 rendered lines | −5 per violation |
| D7 | Bullet count per role | Most recent role 4–6; older roles 2–4; >8 anywhere is a flag | −5 per violation |
| D8 | Tense consistency | Past-tense verbs for ended roles, present for current | −5 per violation |
| D9 | No first person | "I", "my", "me" absent | −5 each |
| D10 | Spelling/grammar | Standard checker pass | −3 per error, cap −20 |

## Aggregate

```
score(JD)    = 0.20·A + 0.35·B + 0.25·C + 0.20·D
score(no JD) = 0.30·A + 0.40·C + 0.30·D
```

- Always display the four category subscores with their top 3 fixes — the breakdown is what makes the number credible and actionable.
- Recompute A, B, D live on every edit (pure functions, zero cost). C's LLM portions refresh on demand or after accepting suggestions.
- Maintain a per-bullet composite (C2 + relevant B/D checks) — that ranking decides which bullets the tailoring pass rewrites first and powers the suggestion cards.

## Calibration

Before trusting the weights, run the engine against 3 versions of your own resume (your real one, a deliberately weakened one, a hand-tailored one for a specific JD) and confirm the ordering and gaps feel right. Tune weights until they do — the formula serves your judgment, not the reverse.
