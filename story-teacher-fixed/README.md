# Story Teacher

An AI-powered learning app that turns school curriculum into personalised, interactive story adventures
(Classes 3–10), with adaptive feedback and a guardian progress report.

## Run locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local      # then set GEMINI_API_KEY
npm run dev                     # http://localhost:3000
```

The app works without a Gemini key (offline practice stories + rule-based feedback), but AI story generation,
AI answer evaluation and AI cover images need `GEMINI_API_KEY`.

Open `http://localhost:3000/?demo=1` to see the app with sample progress data (never saved).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Express + Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serves `dist/` with `NODE_ENV=production` (run `npm run build` first) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Vitest unit tests |

## Configuration

See `.env.example`. Models are configurable (`GEMINI_MODEL`, `GEMINI_IMAGE_MODEL`); verify they are available
to your API key. `.env.local` overrides `.env`.

## Architecture

- `src/` — React 19 + Tailwind 4 client. State is persisted to `localStorage` (`story_teacher_state_v2`).
- `server.ts` — Express API: `/api/ai/generate-story`, `/api/ai/evaluate-answer`, `/api/health`. Input is validated,
  rate-limited per IP, and size-limited.
- `server/AdaptiveLearningService.ts` — Gemini calls with JSON schemas, strict validation of model output,
  and deterministic fallbacks.
- `server/StoryImageCacheService.ts` — LRU memory cache in front of Supabase Storage/Postgres for cover images.
- `server/SupabaseServiceLayerSpec.ts` — SQL schema (with RLS) for the planned Supabase persistence.
- `src/utils/` — logic shared by client and server (topic ids, answer analysis, offline story).

## Known gaps

Not implemented yet: user accounts and server-side persistence, parental consent / privacy compliance,
real content moderation, content coverage beyond six topics and Classes 3–10, translations, and CI.
See `REVIEW.md` for the full list.
