# Resume Tailor

Personal AI resume tailoring app. Paste a job description → get an ATS-scored,
voice-preserving tailored resume + cover letter with editable per-bullet
suggestions, versioned per application.

Single user. See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and
[`docs/resume-scoring-spec.md`](docs/resume-scoring-spec.md) for the scoring
criteria.

## Stack

- Next.js 16 (App Router, TypeScript) + Tailwind v4
- Supabase (Postgres + Auth) via `@supabase/ssr`, RLS on every table
- Anthropic API (`@anthropic-ai/sdk`) — Haiku for extraction, Sonnet for tailoring
- Deploy target: Vercel Hobby

> Note: Next 16 renamed the `middleware` file convention to `proxy`. The auth
> session refresh + route gate lives in [`proxy.ts`](proxy.ts).

## Setup

One-time manual steps (the app spends real API money — gate everything):

1. **Supabase project** — create one at supabase.com.
   - Run the migration: paste `supabase/migrations/0001_init.sql` into the SQL
     editor (or `supabase db push` with the CLI).
   - Auth → Providers → enable Email. For a frictionless single-user setup you
     may disable email confirmation.
   - Create your single user (sign up via the app, or Auth → Users → Add user).
2. **Anthropic** — create an API key at console.anthropic.com and **set a
   monthly spend limit** (e.g. $20).
3. **Env** — copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - `ANTHROPIC_API_KEY` (server only)
4. **Regenerate DB types** (optional but recommended once the project exists):
   ```bash
   npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
   ```

## Develop

```bash
npm run dev      # http://localhost:3000
npm run build    # production build / typecheck
npm run lint
```

## Deploy (Vercel)

Import the repo, add the four env vars above (mark the service role and
Anthropic keys as server-only), deploy.

## Phase status

Building in phases per `docs/PLAN.md`; each phase ends deployable.

- [x] **Phase 0 — Scaffold**: Next.js + Tailwind, Supabase clients, schema +
  RLS migration, email/password auth, protected layout, proxy session gate.
- [x] **Phase 1 — Career memory**: PDF upload → unpdf text extraction → Haiku
  parse → editable confirmation UI → persist `career_memory` + seed
  `base_resumes` "Master resume" + harvest `voice_samples`.
- [ ] Phase 2 — Resume builder + PDF export
- [ ] Phase 3 — Scoring engine
- [ ] Phase 4 — Applications + tailoring
- [ ] Phase 5 — Cover letters + dashboard
