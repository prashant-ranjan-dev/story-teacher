# Story Teacher — Code Review

Scope: all 28 files in `story-teacher.zip`. Every item marked **(verified)** was reproduced by running the
original code; the rest were found by reading. All fixes are in this package and covered by `npm test` (22 tests).

---

## 1. Issues found and fixed

### Blockers (app could not be installed or run correctly)

| # | File | Issue |
|---|------|-------|
| 1 | `package.json` | **(verified)** `npm install` fails with `ERESOLVE`: the unused `esbuild@^0.25` conflicts with Vite 8's peer `esbuild@^0.27 \|\| ^0.28`. `esbuild`, `autoprefixer` and `motion` were never imported. Removed. |
| 2 | `package.json` | **(verified)** `npm start` ran `tsx server.ts` without `NODE_ENV=production`, so "production" served the Vite **dev server**. Now uses `cross-env NODE_ENV=production`. |
| 3 | `package.json` | `tsx` was a devDependency, but it is needed to run the server, so `npm ci --omit=dev` could not start the app. Moved to dependencies. |
| 4 | `server.ts`, `README.md` | README says to put the key in `.env.local`, but only `.env` was loaded, so the Gemini key was never read. Also, ES imports are hoisted, so `dotenv.config()` ran *after* module-level singletons (the Supabase cache) had read `process.env`. Added `server/loadEnv.ts`, imported first, loading `.env.local` then `.env`. |
| 5 | `src/App.tsx` | **No `key` on `<AdventurePlayer>`**: after "Start Next Adventure" React reused the component, so the next story opened on the previous story's *Adventure Complete* screen with stale scores. Fixed with a per-launch key. |

### Correctness bugs

| # | File | Issue |
|---|------|-------|
| 6 | `AdaptiveLearningService.ts` | **(verified)** The hibernation "lazy/tired/bored" rule fired for any concept tag containing "energy", so a food-chains answer got the bear story. Now only for the hibernation lesson. |
| 7 | `AdaptiveLearningService.ts`, `aiService.ts` | **(verified)** Keyword matching ignored negation: "he is *not* lazy" was marked as the lazy misconception. Replaced with negation-aware, whole-word, stemmed matching (`answerAnalysis.ts`). Substring matching also matched "fat" in "father". |
| 8 | `AdaptiveLearningService.ts`, `aiService.ts` | Fallback evaluation used hibernation keywords and bear text for every subject; any 10-character string earned "partially correct". Now topic-agnostic, with a low-effort/gibberish check. |
| 9 | `AdaptiveLearningService.ts` | **(verified)** Topic ids were built with `[^a-z0-9]`, so every Tamil/Hindi/Arabic topic became `topic--` and **shared one cached cover image**. `slugifyTopic` is Unicode-aware and hash-suffixed. Client and server also used different prefixes (`custom-` vs `topic-`) for the same topic. |
| 10 | `AdaptiveLearningService.ts` | Story generation sent no JSON schema (the model had to guess field names) and parsed output without validation, so a malformed response crashed the UI. Added a response schema plus strict normalisation (exactly one correct option, required fields, ids, labels). |
| 11 | `AdaptiveLearningService.ts` | AI stories always got `imageKey: 'photosynthesis'` and a next adventure of hibernation. Now inferred / chosen from the class's curriculum. The offline story was also wrongly flagged `isAiGenerated: true`. |
| 12 | `AdaptiveLearningService.ts` | Cover image: 3-second race (real images almost never won), and the *fallback SVG was then cached permanently*, so a real image was never retried. Image and story ran serially (+3 s every story). Now parallel, de-duplicated, 10 s budget, background completion, SVG never persisted. |
| 13 | `CuratedVisualGenerator.ts` | **(verified)** `&` was not escaped, so SVGs containing "&" were invalid XML and rendered as broken images. Three of the category tags themselves contain "&", so those covers were *always* broken. Also: substring matching ("wheat"→"heat", "stairs"→"air"), long titles overflowing, and computed background gradients that were never used. |
| 14 | `StoryImageCacheService.ts` | Upserted partial rows into `curriculum_topics`, violating its NOT NULL columns (silently, because responses were never checked). Looked up by topic only while caching per class. Unbounded in-memory cache holding multi-MB data URLs. Writes with the anon key. `storageDir` code was dead. Rewritten around a `topic_cover_images` table with timeouts, status checks, LRU and the service-role key. |
| 15 | `AdventurePlayer.tsx` | `conceptScores` pre-filled with **fake hibernation scores for every story**; understanding hard-coded to **84%** for hibernation and time to **18 min** for all; "helping Barnaby" shown in every topic; "Energy conservation" special-cased. All now computed from real answers. |
| 16 | `AdventurePlayer.tsx` | A story with no `finalChallenge` rendered a blank screen. Short answers and multiple-choice could be re-submitted, double-counting scores. Follow-up option feedback was never shown. `true_false` questions inside the story rendered no options (stuck). Follow-up with missing `options` crashed. |
| 17 | `AdventurePlayer.tsx` | Dev "Test Misconception: Bears are lazy" buttons and an "AI Generated & Cached" badge were shown to students (also shown on non-AI stories). Slider captions ("Deep Winter / Autumn Warmth") were hard-coded. Dev buttons are now DEV-only; captions come from content. |
| 18 | `GuardianDashboard.tsx` | **Injected a fabricated "Hibernation · 84%" record and a fake "Energy conservation" weak spot into a parent's report** whenever the child hadn't completed it. Static "Consistent conceptual grasp" text. Now real data only, with an empty state. |
| 19 | `App.tsx` | Resuming a custom/AI adventure loaded an unrelated hibernation stub (unknown ids fell back to `CURRICULUM_TOPICS[0]`). In-progress and mastery data were never persisted. XP was awarded on every replay; the streak never changed; stale-closure profile updates. "Save & Exit" at ≥100% discarded progress. Recommendations ignored the student's class. Five of six curriculum topics were 2-question placeholder stories. |
| 20 | `curriculumData.ts` | Shipped a fake student ("Aarav", 480 XP, 5-day streak), a fake 72%-complete lesson pointing to section 2 of a 2-section stub, and two fake completed topics. Now a blank start; the sample data is available at `?demo=1`. The placeholder stub (always option "A" correct, "completely at random" distractor) is replaced by AI generation from the topic's objectives with an honest offline fallback. Answer options are now shuffled (the correct answer was almost always "A"). |
| 21 | `OnboardingModal.tsx` | "Adventure" was a default interest with no chip, so it could not be removed. The non-modal first-run mode was never used (new users silently became "Aarav"). No Escape/aria-modal/labels. |
| 22 | `SupabaseServiceLayerSpec.ts` | DDL: `stories.topic_id` foreign key made inserts for AI topics fail; **no Row Level Security** (anon key could read/write every child's data); no triggers/indexes. Pipeline used an unverified model id and ignored a failed DB write. |

### Security / robustness

| # | Issue | Fix |
|---|-------|-----|
| 23 | No input validation: `{}` → 500 **(verified)**; unbounded text lengths; types unchecked. | `server/validation.ts` → 400 with clear messages. |
| 24 | No rate limiting on endpoints that spend the owner's Gemini quota. | Per-IP limiter (`AI_RATE_LIMIT_PER_MIN`), 20 kB body limit. |
| 25 | User text interpolated into the **system instruction** (prompt injection). | Static system prompts; all user text in delimited `<student_input>` data. |
| 26 | Children's product with no content safeguards. | Safety rules in prompts, a narrow topic stop-gap returning 422 with a friendly message (not a substitute for real moderation — see gaps). |
| 27 | `PORT` hard-coded; no graceful shutdown; errors swallowed silently (`catch {}`) so misconfiguration was invisible. | `PORT`, SIGTERM handling, `console.warn` with reasons. |
| 28 | `/api/*` typos returned `index.html`; no JSON error handler. | JSON 404 + error middleware. |
| 29 | `tsconfig` not strict; leftover `experimentalDecorators`/`allowJs`; no `include`. | `strict: true`; the code base type-checks cleanly. |

---

## 2. What is missing from the code base

### Product / content
- **Curriculum coverage:** only 6 topics, one hand-authored story. **Social Science and English filters always show nothing**; Class 10 has no topics, Class 9 has one. Classes 1–2 and 11–12 are unsupported.
- No fact-checking/review workflow for AI-written lessons; wrong science could reach students.
- No alignment metadata (board/syllabus, chapter, learning-outcome codes).
- No translations / regional languages (Tamil, Hindi…), no read-aloud / text-to-speech for younger children, no dyslexia-friendly option.
- Hand-authored interactive modules exist only for hibernation; no maths manipulatives.
- Adaptive engine adapts only within a single answer; there is no cross-session difficulty model, spaced repetition or review queue (`difficulty_state` exists in the schema but is unused).

### Accounts, data and compliance
- **No authentication / accounts**; no multiple children per guardian; progress lives only in one browser's `localStorage`.
- **Supabase is not wired up** for profiles, sessions or mastery (only the image cache); no `@supabase/supabase-js`, no migrations folder, no seed script.
- **Guardian view has no gate** — any child can open it. A parent PIN/gate (and real guardian accounts) is needed.
- No privacy policy, terms, or consent flow. Because it processes children's names and free-text, check parental-consent and data-protection duties for your market (e.g. India's DPDP Act 2023, COPPA/GDPR-K where applicable) before launch.
- No data export / delete for a student.
- Real **content moderation** (a moderation API/classifier on inputs *and* model outputs) — the included stop-gap is deliberately minimal.
- No CSP / full security headers (CSP must allow Google Fonts and data: images; frame headers omitted because AI Studio embeds the app).

### Engineering
- Tests were absent. This package adds unit tests for the logic; still missing: component tests, API integration tests, end-to-end tests, and CI.
- No ESLint/Prettier, no pre-commit hooks, no error boundary in React, no logging/monitoring/analytics, no accessibility audit (keyboard/screen-reader fixes were made, but no formal audit or colour-contrast check).
- No Dockerfile / deployment config; the rate limiter is in-memory (use Redis for multiple instances).
- No story caching on the server (identical requests regenerate stories) and no queue/backoff for Gemini quota errors.
- No streaming of generation progress (the loader is time-based, not real).
- Model IDs (`gemini-2.5-flash`, `imagen-3.0-generate-002`) could not be verified from here; they are now env-configurable — confirm they exist for your key. `GEMINI_NATIVE_IMAGE_MODEL` must be set to use `seedTopicVisualPipeline`.
- No OG image (the Twitter card was downgraded to `summary`), no PWA/offline support, no `robots.txt`.

---

## 3. Files changed

Rewritten: `server.ts`, `server/AdaptiveLearningService.ts`, `server/StoryImageCacheService.ts`,
`server/CuratedVisualGenerator.ts`, `server/SupabaseServiceLayerSpec.ts`, `src/App.tsx`,
`src/components/AdventurePlayer.tsx`, `src/components/GuardianDashboard.tsx`, `src/components/OnboardingModal.tsx`,
`src/services/aiService.ts`, `src/types/story.ts`, `src/data/curriculumData.ts` (authored hibernation story preserved verbatim, restructured),
`package.json`, `tsconfig.json`, `.env.example`, `.gitignore`, `README.md`, `index.html`.

New: `server/loadEnv.ts`, `server/validation.ts`, `server/rateLimit.ts`, `src/utils/{topic,answerAnalysis,fallbackStory,shuffle,storage,format}.ts`, `tests/*.test.ts`, `REVIEW.md`.

Unchanged: `vite.config.ts`, `metadata.json`, `src/main.tsx`, `src/index.css`.
