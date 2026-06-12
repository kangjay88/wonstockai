# Resume Tailor — Project Plan

Personal AI resume tailoring app. Paste a job description → get an ATS-scored, voice-preserving tailored resume + cover letter with editable per-bullet suggestions → every iteration stored per application so any version can be retrieved when an offer or interview comes in.

Single user (the owner). No multi-tenant features, no payments, no job-board ingestion.

Companion doc: `docs/resume-scoring-spec.md` — the full 31-check scoring criteria with formulas. The scoring engine in Phase 3 implements that spec verbatim.

---

## 1. Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | One app for UI + API routes |
| Hosting | Vercel Hobby plan | Free, zero ops |
| Database | Supabase (Postgres) | Free tier; auth + storage + DB in one |
| ORM | Prisma (or Supabase client + generated types — pick one early, don't mix) | Type safety |
| Auth | Supabase Auth, email/password, single account | App is on a public URL spending real API money — every API route must be gated |
| AI | Anthropic API. Haiku for extraction/parsing, Sonnet for tailoring/rewrites and rubric scoring | Cost/quality routing |
| PDF export | @react-pdf/renderer | Pure JS, serverless-safe; no Puppeteer/Chromium |
| Job data | None. User pastes job descriptions manually | Deliberate scope cut |
| Background jobs | None needed | Everything is request/response |

Constraints to respect throughout:
- Vercel Hobby function limits are short — keep Claude calls streaming or under the configured `maxDuration`; split multi-step AI work into separate route calls if needed.
- Never expose `ANTHROPIC_API_KEY` to the client. All Claude calls happen in route handlers.
- Set a monthly spend limit in the Anthropic console (manual step, see §8).

## 2. Architecture

```
Browser (Next.js UI)
   │  authenticated requests (Supabase session)
   ▼
Next.js API routes (Vercel)
   ├── Supabase Postgres  (career memory, resumes, applications, documents, edit history)
   ├── Supabase Storage   (optional: exported PDFs, original uploaded resume)
   └── Anthropic API      (parse, extract, tailor, rubric-score, cover letter)
```

Scoring engine = pure TypeScript in `lib/scoring/` — no I/O, runs client-side live during editing AND server-side for persisted scores. Share the code.

## 3. Database schema

Run as a Supabase migration. RLS on every table; single-user, so policies are simply `auth.uid() = user_id`.

```sql
create table career_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  profile jsonb not null,            -- roles[], skills[], education[], summary, target_roles[]
  voice_samples text[] default '{}', -- user's real bullets/writing, injected into every tailoring call
  updated_at timestamptz default now()
);

create table base_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,                -- e.g. "Master resume"
  sections jsonb not null,           -- structured: contact, summary, experience[{company, title, dates, bullets[]}], education, skills, projects
  updated_at timestamptz default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  company text not null,
  role_title text not null,
  job_description text not null,
  jd_extraction jsonb,               -- cached Haiku output: required_skills, preferred_skills, title_variants, seniority_signals, domain_terms
  status text not null default 'saved'
    check (status in ('saved','applied','interviewing','offer','rejected','accepted')),
  applied_at timestamptz,
  created_at timestamptz default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  application_id uuid not null references applications(id) on delete cascade,
  base_resume_id uuid references base_resumes(id),
  doc_type text not null check (doc_type in ('resume','cover_letter')),
  version int not null,              -- unique (application_id, doc_type, version)
  content jsonb not null,            -- same sections shape as base_resumes (resume) or paragraphs[] (cover letter)
  score jsonb,                       -- snapshot: {total, categories: {ats, keywords, impact, language}, per_bullet[]}
  created_at timestamptz default now(),
  unique (application_id, doc_type, version)
);

create table suggestion_edits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  application_id uuid references applications(id) on delete set null,
  ai_suggested text not null,
  user_final text not null,          -- what the user actually accepted after editing
  created_at timestamptz default now()
);
```

`suggestion_edits` is the voice-learning loop: whenever the user edits an AI suggestion before accepting, store the pair. Recent pairs (last ~10) get injected into future tailoring prompts as "the user rewrote my suggestion this way — match this style."

Documents are immutable. Edits/regenerations create a new version row; never update `content` in place.

## 4. Modules

### 4.1 Career memory (onboarding)
- Upload resume PDF → extract text server-side (pdf-parse or pdfjs) → one Haiku call returns structured JSON → save to `career_memory.profile` and seed a `base_resumes` row.
- Show parsed result for confirmation/editing (the "Your career memory, assembled" screen): roles read, skills mapped, education, suggested target roles as removable chips.
- Harvest the resume's existing bullets into `voice_samples`.

### 4.2 Resume builder
- Section-based editor over `base_resumes.sections`: contact, summary, experience (roles with bullets), education, skills, projects.
- Live preview pane rendering the same React components used by the PDF export (single source of truth for layout).
- Live score panel: categories A + D from the scoring spec recompute on every keystroke (debounced); no API calls.
- "Download PDF" → @react-pdf/renderer, single column, standard fonts, file named `FirstLast_Resume.pdf`.

### 4.3 Application + tailoring flow (the core)
1. "New application": paste JD, enter company + role title → creates `applications` row.
2. Server: Haiku extraction call → cache in `jd_extraction`.
3. Score current base resume against the JD (full spec, categories A–D) → show breakdown with top fixes per category.
4. "Tailor": one Sonnet call (streaming) with career memory + base resume + jd_extraction + voice_samples + recent suggestion_edits. Returns strict JSON:
   ```json
   {
     "summary": {"original": "...", "suggested": "...", "reasoning": "..."},
     "bullets": [{"role_index": 0, "bullet_index": 1, "original": "...",
                  "suggested": "...", "reasoning": "...",
                  "keywords_addressed": ["..."], "score_delta": 7}],
     "skills_to_add": ["..."], "skills_to_remove": ["..."]
   }
   ```
5. Suggestion cards UI: original vs suggested side by side; actions = accept / edit inline / reject. Edited acceptances also insert into `suggestion_edits`.
6. "Save version" composes accepted changes into a new `documents` row (resume, version N+1) with a score snapshot. Score panel updates live as suggestions are accepted.
7. Cover letter: separate Sonnet call using the saved tailored resume + JD + voice samples → paragraphs as suggestion cards → saved as `documents` row (cover_letter).
8. Export both to PDF.

### 4.4 Applications dashboard (history)
- List/board of applications filterable by `status` (saved / applied / interviewing / offer / rejected / accepted).
- Application detail: JD, score history, all document versions for both doc types, one-click re-export of any version, status updates with `applied_at` stamping.

### 4.5 Scoring engine (`lib/scoring/`)
- Implement `docs/resume-scoring-spec.md` exactly: 31 checks, categories A (ATS, 20%), B (keywords, 35% with JD), C (impact, 25%), D (language, 20%).
- Pure functions: `scoreResume(sections, jdExtraction?) → ScoreReport` where every deduction includes the offending item + suggested fix string.
- C2/C3 (LLM rubric checks) are a separate server call: Sonnet scores each bullet 1–5 against the anchored rubric, returns integer + one-line justification + missing element. Persisted in the document's score snapshot; deterministic checks recompute live.
- Synonym map for B1 lives in `lib/scoring/synonyms.json` (~100 software-role pairs to start).
- Calibration harness: a script that scores 3 fixture resumes (real / weakened / hand-tailored) and prints the ranking — run before trusting weights.

## 5. Claude API integration

- SDK: `@anthropic-ai/sdk`. Models: `claude-haiku-4-5-20251001` for JD extraction + resume parsing; `claude-sonnet-4-6` for tailoring, rubric scoring, cover letters.
- All AI routes: require auth session, validate input size (cap JD at ~15k chars), stream where output is long.
- Strict JSON outputs: instruct JSON-only responses, parse defensively (strip code fences), retry once on parse failure.
- Prompt caching: career memory + voice samples + system instructions are identical across calls within a session — structure prompts with the stable blocks first and enable caching to cut input cost ~90%.
- Voice preservation, enforced in the tailoring system prompt:
  - Include 5–10 `voice_samples` and recent `suggestion_edits` pairs as style ground truth.
  - Hard ban list (mirrors spec check D5): spearheaded (max 1), leveraged (max 2), delve, utilize, honed, showcasing, synergy.
  - Instruction: preserve the user's sentence rhythm and vocabulary; only change what the JD requires; never inflate or fabricate metrics — flag bullets that *could* take a metric and ask, don't invent.
- The no-fabrication rule is a product feature: suggestions may add `"needs_input": "What was the % improvement?"` so the user supplies real numbers via the edit field.

## 6. Build phases

Each phase ends deployable. Don't start a phase until the previous one's acceptance check passes.

**Phase 0 — Scaffold (half a day)**
Next.js + TS + Tailwind; Supabase project; schema migration + RLS; Supabase Auth with single account; protected layout; deploy to Vercel with env vars.
✓ Accept: can log in on the production URL; all tables exist; unauthenticated API calls return 401.

**Phase 1 — Career memory (1–2 days)**
PDF upload → text extraction → Haiku parse → confirmation UI → persist memory + seeded base resume + voice samples.
✓ Accept: upload real resume, parsed profile is accurate after at most light edits.

**Phase 2 — Resume builder + PDF export (2–3 days)**
Section editor, live preview, @react-pdf export sharing the preview components.
✓ Accept: exported PDF is clean single-column, correct fonts/dates, opens properly.

**Phase 3 — Scoring engine (2–3 days)**
`lib/scoring/` per the spec; live score panel in the builder (A + D); calibration harness with 3 fixtures.
✓ Accept: calibration ranks real > weakened, hand-tailored > real (with its JD); every deduction shows a concrete fix.

**Phase 4 — Applications + tailoring (3–4 days)**
New-application flow, JD extraction, full scoring vs JD, tailoring call, suggestion cards (accept/edit/reject), versioned saves, suggestion_edits capture.
✓ Accept: paste a real JD → review suggestions → save v1 → tweak → save v2 → both versions retrievable with scores.

**Phase 5 — Cover letters + dashboard (2 days)**
Cover letter generation flow; applications dashboard with status pipeline and version history.
✓ Accept: full loop — paste JD → tailored resume + cover letter PDFs → mark applied → find it later and re-open the exact documents.

**Phase 6 — Polish (ongoing)**
Diff view between versions, rubric-score refresh button, voice-sample management UI, prompt tuning from real usage.

## 7. Repo structure

```
app/
  (auth)/login/
  (app)/dashboard/        applications list + status board
  (app)/applications/[id]/  detail: JD, score, suggestions, versions
  (app)/resume/[id]/      builder + live preview + score panel
  (app)/onboarding/       career memory flow
  api/ai/parse-resume/    Haiku
  api/ai/extract-jd/      Haiku
  api/ai/tailor/          Sonnet, streaming
  api/ai/cover-letter/    Sonnet, streaming
  api/ai/rubric-score/    Sonnet
  api/export/pdf/
lib/
  scoring/   index.ts, ats.ts, keywords.ts, impact.ts, language.ts, synonyms.json, types.ts
  ai/        client.ts, prompts/ (one file per prompt, versioned constants)
  pdf/       templates (shared with preview)
  supabase/  server + browser clients
docs/
  PLAN.md (this file)
  resume-scoring-spec.md
scripts/
  calibrate.ts
```

## 8. Setup checklist (manual, one-time)

1. Create Supabase project → run migration → enable email auth → create your single user.
2. Anthropic console: create API key → **set a monthly spend limit (e.g. $20)**.
3. Vercel: import repo → env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `ANTHROPIC_API_KEY` (server only).
4. Note: Vercel Hobby is licensed for personal/non-commercial use — fine for this; revisit if the app ever gets other users.

## 9. Expected running costs

| Item | Cost |
|---|---|
| Vercel Hobby, Supabase free tier | $0 |
| JD extraction (Haiku, cached) | <1¢ / application |
| Tailoring + cover letter (Sonnet, with prompt caching) | ~10–20¢ / application |
| Rubric scoring pass | ~3–5¢ / run |
| Active month (~40 applications) | **~$6–10 total** |
| Idle month | $0 |
