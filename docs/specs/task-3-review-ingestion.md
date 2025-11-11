# Task 3 – Review Ingestion Service & Snapshot Trigger

Related roadmap: `PROJECT_OVERVIEW_AND_ROADMAP.md` §6 “Phase 1 – MVP” (lines 226‑244)

## 1. Why this matters
- Phase 1 promises an automated “Fetch Reviews → Store → Analyze” loop. Without dependable review ingestion we cannot generate ReviewSnapshots or surface insights. (Roadmap lines 226‑244)
- Plan limits (apps, analyses per month, reviews per run) are enforced at ingestion time, so this service is the guardrail against runaway costs.
- The Python prototype (`prototype/review-analyzer/app_reviews_fetcher.py`) already proves out fetching logic; Task 3 porting it into the Next.js/Prisma stack unlocks end-to-end workflows.

## 2. Goals
1. Build a reusable review ingestion module that fetches latest App Store reviews for an App, deduplicates them, and stores them in Postgres.
2. Provide both manual and scheduled triggers (button in UI/server action + cron-compatible API route) respecting plan quotas.
3. Emit ingestion run records for observability (counts, duration, errors) stored in DB and surfaced via logs.
4. Automatically kick off ReviewSnapshot generation (Task 4) once ingestion succeeds by enqueuing a future job hook/stub.
5. Ensure code is testable with mocked Apple endpoints and Prisma test DB, sharing the Vitest stack set up in Task 1.

## 3. Non-Goals
- No AI analysis logic (handled in Task 4). This task ends once reviews are stored and a snapshot trigger record is queued.
- No multi-app niche aggregation (Phase 3).
- No UI visualization of ingestion history beyond simple status indicators. Detailed dashboards can arrive later.

## 4. Dependencies & Inputs
- Task 1 schema (App, Review, ReviewSnapshot, plan helpers) must exist.
- Task 2 UI should expose “Fetch latest reviews” CTA; this spec defines backend pieces that button will call.
- Apple RSS/JSON endpoints referenced in the prototype:
  - Most recent: `https://itunes.apple.com/rss/customerreviews/page={page}/id={appId}/sortBy=mostRecent/json`
  - Most helpful: `sortBy=mostHelpful`
- `.env.local` must include `APPLE_REVIEWS_COUNTRY` defaulting to `us` (optional override).
- Need background job trigger; default approach: Vercel Cron hitting `/api/jobs/review-ingestion` daily plus manual triggers.

## 5. Deliverables
1. **Review ingestion service module** (e.g., `lib/reviews/ingest.ts`) exposing:
   ```ts
   type IngestionOptions = {
     appId: string;
     limit?: number; // overrides plan default
     source?: "mostRecent" | "mostHelpful" | "both";
     triggeredByUserId?: string;
     reason: "manual" | "scheduled";
   };
   export async function ingestReviews(options: IngestionOptions): Promise<IngestionResult>;
   ```
2. **Apple fetch adapter** (`lib/apple/reviews.ts`) handling pagination, retries, and JSON normalization into internal DTOs.
3. **Ingestion run entity**:
   - Add Prisma model `ReviewIngestionRun` (or similar) to record `id`, `appId`, `workspaceId`, `reason`, `requestedAt`, `startedAt`, `finishedAt`, `status`, `reviewsFetched`, `reviewsInserted`, `error`.
   - Model should link to `ReviewSnapshot` once generated (nullable FK).
4. **Manual trigger server action** invoked from the Apps UI (Task 2) or later App detail page.
5. **Cron-safe API route** at `app/api/jobs/review-ingestion/route.ts` verifying signature (e.g., `env.CRON_SECRET`), iterating eligible apps, and calling ingestion sequentially or in batches.
6. **Plan enforcement** inside the ingestion service (max runs per workspace per rolling window, per-run review cap).
7. **Logging/metrics**: structured `console.info`/`console.error` entries with workspace/app context.
8. **Docs** under `docs/specs/task-3-review-ingestion.md` (this file) plus README snippet describing how to run manual ingestion locally.

## 6. Architecture & Flow

1. **Eligibility check**
   - Only run on `App.status = ACTIVE` and non-deleted apps.
   - Enforce `reviewLimitPerRun` from workspace plan; allow override via internal options for testing.
   - Track how many runs executed in the last rolling 24h / month (per plan). Use `ReviewIngestionRun` records to compute.

2. **Fetch pipeline**
   - For each source (helpful, recent) call Apple adapter.
   - Adapter handles:
     - Pagination up to `limit` total reviews per run.
     - Exponential backoff + max 3 retries on 5xx/timeout via `AbortController`.
     - Rate limiting (sleep if hitting Apple throttle; share simple `p-limit` concurrency).
   - Normalized review DTO shape:
     ```ts
     type NormalizedReview = {
       externalId: string;
       rating: number;
       title: string;
       body: string;
       author: string;
       version?: string;
       country?: string;
       language?: string;
       publishedAt: Date;
       source: ReviewSource;
       raw: unknown; // entire Apple entry
     };
     ```

3. **Deduplication & persistence**
   - De-dupe on `externalId` before hitting DB.
   - Insert via Prisma `createMany` with `skipDuplicates` relying on `@@unique([appId, externalReviewId])`.
   - Use transaction to (1) create `ReviewIngestionRun`, (2) insert reviews, (3) update `run.reviewsInserted`, (4) commit.
   - Update `App.lastSyncedAt` to `new Date()` when any reviews inserted.

4. **Snapshot trigger stub**
   - After success, enqueue or call `queueReviewSnapshot(appId, runId)` stub in `lib/reviews/snapshot-trigger.ts`.
   - For now, simply create a `ReviewSnapshot` row with `status = PENDING` and reference the ingestion run; Task 4 can process these pending entries.

5. **Error handling**
   - Catch network/parse errors, mark run `status = FAILED`, capture `errorMessage`.
   - Provide human-friendly error codes for UI (e.g., `APPLE_NOT_FOUND`, `PLAN_LIMIT_REACHED`).
   - Use `Retry-After` header from Apple if provided; log for observability.

## 7. Config & Environment
- `.env` additions:
  - `APPLE_REVIEWS_COUNTRY=us` (default fallback).
  - `CRON_SECRET=` for authenticating scheduled job route.
- Cron job (documented in README):
  - Example Vercel config hitting `/api/jobs/review-ingestion?secret=...` daily.
  - Local simulation command `pnpm tsx scripts/run-ingestion.ts --appId=...`.
- Provide `config/ingestion.ts` with:
  ```ts
  export const INGESTION_DEFAULTS = {
    maxPagesPerSource: 5,
    requestTimeoutMs: 8000,
    retryDelaysMs: [500, 1500, 3000],
  };
  ```

## 8. Plan Enforcement Rules
- Use workspace plan metadata from Task 1:
  - `maxReviewsPerRun` → cap the number of normalized reviews processed (stop fetching once reached).
  - `maxAnalysesPerMonth` → approximate ingestion runs per month until Task 4 formalizes snapshots (for now, treat ingestion+analysis as same limit).
  - Additional derived limit: `maxManualRunsPerDay` (Starter 1, Pro 5, Business 10) defined in `config/plan-limits.ts`.
- When limit hit:
  - Return structured error object that UI can display (“Upgrade to Pro to fetch more than 1 run/day”).
  - Log warning with workspace + plan info.

## 9. Observability & Audit
- `ReviewIngestionRun` should store:
  - `reason` (`manual`, `scheduled`).
  - `triggeredByUserId` (nullable for cron).
  - `requestedAt`, `startedAt`, `finishedAt`.
  - `reviewsFetched`, `reviewsInserted`, `duplicateCount`, `sourcesProcessed`.
- Provide helper `getRecentIngestionRuns(appId, limit = 5)` for UI to show last runs (used later).
- Consider emitting structured logs, e.g.:
  ```ts
  logger.info("review_ingestion_completed", { workspaceId, appId, runId, inserted });
  ```
  (Simple `console.info` ok for now, but wrap in `lib/logger.ts` for future swap.)

## 10. Testing Strategy
- **Unit tests (Vitest)**
  - Apple adapter: pagination, deduping, handling of empty feeds, retry logic (use `msw` to simulate network).
  - Normalization util: parsing Apple RSS JSON into `NormalizedReview`.
  - Plan limiter: verifying run quotas across different plan configurations.
- **Integration tests**
  - Use Prisma test DB with seeded App + Workspace.
  - Mock Apple responses via `msw` in Node (set `fetch` polyfill) to return deterministic review fixtures from `tests/fixtures/apple`.
  - Test full `ingestReviews` call verifying DB rows created, duplicate handling, and `ReviewIngestionRun` fields.
  - Test manual trigger server action ensuring plan limit errors bubble to caller.
- **Cron route tests**
  - Write API route tests using Next.js route handler with supertest or direct invocation verifying secret validation and multi-app batching.
- **Manual QA checklist**
  1. From Apps UI, click “Fetch latest reviews” → run record appears, `App.lastSyncedAt` updates.
  2. Trigger again within same day on Starter plan → see limit error.
  3. Switch app to `PAUSED` then trigger → request blocked with message explaining paused apps cannot ingest.
  4. Simulate cron call hitting API route with valid secret; confirm logs for each active app.
  5. Inspect DB to verify `ReviewSnapshot` row created with `status=PENDING` after ingestion.

## 11. Acceptance Criteria
- Ingestion service fetches, deduplicates, and inserts reviews for at least one real App Store ID (StoryGraph) without manual intervention.
- Plan limits enforced: manual runs capped according to plan, review counts truncated based on `maxReviewsPerRun`.
- `ReviewIngestionRun` records accurately reflect outcomes and can be queried for history.
- Cron endpoint secured via secret; invalid secret returns 401.
- Manual trigger server action wired for UI, returning structured success/error payloads.
- Snapshot trigger stub invoked after ingestion, creating pending snapshot row linked to the run.
- Vitest suite covers adapter, service, plan enforcement, server action, and cron handler (with mocked Apple endpoints).
- README/docs updated with instructions for running manual ingestion + tests.

## 12. Open Questions & Follow-ups
- Should we store raw Apple feed files for audit? For now, keep `Review.metadata` JSON; revisit if compliance requires.
- Where should long-running ingestion live when deploying to Vercel (Edge vs Node)? Default to Node runtime; evaluate worker/lambda if runtime exceeds limits.
- How to handle localization (multiple countries/languages)? This spec assumes single country per workspace; add multi-country support later.
- Future improvement: add exponential backoff/resume when Apple returns 429; track `retryAfter` and schedule re-run automatically.
