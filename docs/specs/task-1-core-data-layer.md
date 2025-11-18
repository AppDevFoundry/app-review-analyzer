You are an expert level backend API developer and database modeler/engineer with specialization in Prisma, Postgres, Node, Typescript.

# Task 1 – Core Data Layer & Prisma Migration

Related roadmap: @PROJECT_OVERVIEW_AND_ROADMAP.md §6 “Phase 1 – MVP” (lines 210‑251)

## 1. Why this matters
- Phase 1 requires App, Review, and ReviewSnapshot entities, workspace scoping, and plan gating before we can ship any UI or ingestion flows. (Roadmap lines 216‑249)
- The Python prototype (`prototype/review-analyzer/*`) already defines the JSON shape we expect from the analysis loop; the SaaS app needs matching tables so future agents can import/store that output.
- Neon is provisioned but empty, so this is the ideal moment to lock the schema and migrations with minimal churn.

## 2. Goals
1. Introduce Prisma models for `Workspace`, `WorkspaceMember`, `App`, `Review`, `ReviewSnapshot`, and `ReviewSnapshotInsight`, plus supporting enums.
2. Capture plan metadata (limits per plan tier) in TypeScript so higher layers can enforce “max apps / analyses / reviews per run”.
3. Provide typed helper functions for fetching the current user’s workspace + plan info, and for scoping queries.
4. Create a seed workflow that ingests at least one sample analysis JSON from the prototype to validate shape and provide realistic dev data.
5. Apply the migration against Neon (and update Prisma client) so later tasks work with the new schema.

## 3. Non-Goals
- No UI or API endpoints for workspaces/apps yet (Tasks 2+).
- No cron/queue wiring or LLM calls (Task 3+).
- No billing changes beyond storing plan metadata already coming from Stripe.

## 4. Dependencies & Inputs
- Existing auth + Stripe fields already live on `User` (see `prisma/schema.prisma`).
- `.env.local` must already point to the Neon Postgres branch.
- Prototype JSON lives under `prototype/review-analyzer/…`. Use `1570489264_analysis_*.json` as canonical sample data.

## 5. Deliverables
1. **Prisma schema update** with new models/enums + generated migration SQL committed under `prisma/migrations`.
2. **Plan metadata module** (e.g. `config/plan-limits.ts`) exporting typed limits keyed by plan slug.
3. **Workspace helper utilities** under `lib/` (e.g. `lib/workspaces.ts`) for fetching default workspace, checking plan limits, and coercing plan metadata.
4. **Seed script** (`prisma/seed.ts`) that:
   - Creates a demo workspace tied to the first user (or creates a dummy user if none exist).
   - Inserts one App + Reviews + ReviewSnapshot + Insights using a sample JSON file.
   - Can be invoked with `pnpm prisma db seed`.
5. **Docs**: this spec plus a short `README` snippet describing how to run migrations & seeds (add to root README or `docs/`).

## 6. Schema Requirements

### 6.1 Enums
- `WorkspacePlan` – `STARTER`, `PRO`, `BUSINESS`.
- `WorkspaceRole` – `OWNER`, `ADMIN`, `MEMBER`.
- `AppPlatform` – `IOS` (future-friendly for `ANDROID` etc.).
- `AppStatus` – `ACTIVE`, `PAUSED`, `ARCHIVED`.
- `ReviewSource` – `MOST_RECENT`, `MOST_HELPFUL`, `UNKNOWN`.
- `SnapshotStatus` – `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`.
- `InsightType` – `FEATURE_REQUEST`, `BUG_OR_COMPLAINT`, `PRAISE`, `USABILITY_ISSUE`, `OTHER`.
- `InsightPriority` – `LOW`, `MEDIUM`, `HIGH`.

### 6.2 Workspace & membership
`Workspace`
- `id` `String @id @default(cuid())`
- `name` `String`
- `slug` `String @unique`
- `plan` `WorkspacePlan @default(STARTER)`
- `appLimit` `Int` (derived default from plan, overrideable for custom plans)
- `analysisLimitPerMonth` `Int`
- `reviewLimitPerRun` `Int`
- `ownerId` `String` → `User`
- `stripeCustomerId` / `stripeSubscriptionId` optional overrides (mirror user for multi-seat)
- `createdAt`, `updatedAt`, `deletedAt?`

Indexes:
- `@@index([ownerId])`
- Soft-delete friendly index on `deletedAt`.

`WorkspaceMember`
- `id` `String @id`
- `workspaceId` `String`
- `userId` `String`
- `role` `WorkspaceRole`
- `invitedByUserId` optional
- `createdAt`, `updatedAt`

Constraints:
- `@@unique([workspaceId, userId])`
- `workspaceId` FK to Workspace.

Optional `WorkspaceInvite` table is **not** required yet.

### 6.3 App
`App`
- `id` cuid
- `workspaceId` FK
- `platform` `AppPlatform`
- `appStoreId` `String` (Apple numeric id)
- `bundleId` `String?`
- `name`, `slug`
- `developerName`, `primaryCategory`, `iconUrl`, `storeUrl`
- `averageRating` `Decimal?`
- `ratingCount` `Int?`
- `status` `AppStatus @default(ACTIVE)`
- `lastSyncedAt` `DateTime?`
- `createdAt`, `updatedAt`

Constraints:
- `@@unique([workspaceId, appStoreId])`
- `@@index([workspaceId, status])`

### 6.4 Review
`Review`
- `id` cuid
- `workspaceId` FK (denormalized for faster tenant scoping)
- `appId` FK
- `externalReviewId` `String` (Apple review id) UNIQUE per app (`@@unique([appId, externalReviewId])`)
- `rating` `Int`
- `title`, `body`, `author`, `country`, `language`, `version`
- `publishedAt` `DateTime`
- `fetchedAt` `DateTime`
- `source` `ReviewSource`
- `isTranslated` `Boolean @default(false)`
- `translationLanguage` `String?`
- `metadata` `Json?` (store raw Apple payload)
- `createdAt`, `updatedAt`

Indexes:
- `@@index([workspaceId, publishedAt])`
- `@@index([appId, rating])`

### 6.5 ReviewSnapshot
`ReviewSnapshot`
- `id` cuid
- `workspaceId`, `appId`
- `status` `SnapshotStatus`
- `analysisRangeStart`, `analysisRangeEnd`
- `reviewCount`, `positiveCount`, `neutralCount`, `negativeCount`
- `sourceReviewIds` `String[]` or `Json`
- `ratingsDistribution` `Json`
- `trends` `Json`
- `aiSummary` `String`
- `rawInsights` `Json` (entire payload from prompt)
- `promptTokens`, `completionTokens`, `costInCents`
- `errorMessage?`
- `createdAt`, `updatedAt`

Constraints:
- `@@index([workspaceId, appId, createdAt])`
- `@@index([status])`

### 6.6 ReviewSnapshotInsight
Separate table for structured insights so UI can query/filter without parsing JSON.
- `id` cuid
- `reviewSnapshotId` FK
- `workspaceId`
- `type` `InsightType`
- `priority` `InsightPriority`
- `title`, `description`
- `supportingReviewIds` `String[]` (or `Json`), `supportingReviewCount`
- `themeKey` `String?` (normalized slug, e.g., `sync_data` from prototype)
- `createdAt`

Constraints:
- `@@index([reviewSnapshotId, type])`
- `@@index([workspaceId, themeKey])`

## 7. Plan Metadata & Helpers
- Create `config/plan-limits.ts` exporting something like:
  ```ts
  type PlanLimit = {
    maxApps: number;
    maxAnalysesPerMonth: number;
    maxReviewsPerRun: number;
  };
  export const PLAN_LIMITS: Record<WorkspacePlan, PlanLimit> = { … };
  ```
- Add helper `getWorkspaceWithPlan(userId)` that:
  - Finds (or lazily creates) the user’s default workspace.
  - Joins membership + plan metadata + computed usage (counts derived from DB).
  - Returns typed object consumed by upcoming tasks.
- Provide `assertWithinPlan(workspaceId, metric)` util to centralize quota enforcement.

## 8. Seed Data Workflow
1. Add `prisma/seed.ts` if missing. Steps:
   - Ensure at least one user exists (create a fake if not).
   - Upsert a `Workspace` + membership for that user.
   - Insert one App (StoryGraph sample).
   - Read a JSON snapshot file from `prototype/review-analyzer/` (allow overriding path via env/CLI).
   - Insert Reviews + ReviewSnapshot + ReviewSnapshotInsights matching the schema. Map JSON keys to columns:
     - `ratings.distribution` → `ReviewSnapshot.ratingsDistribution`.
     - `issues.issue_categories` → `ReviewSnapshotInsights` with `type = BUG_OR_COMPLAINT`.
     - `issues.feature_request_samples` → `InsightType.FEATURE_REQUEST`.
     - `positives.top_positive_aspects` → `InsightType.PRAISE`.
   - Log counts so devs know seed succeeded.
2. Document seeding in README (commands + expected output).

## 9. Testing & Tooling Requirements
- **Introduce Vitest as the repo-wide test runner.**
  - Add dev dependencies: `vitest`, `@vitest/coverage-v8`, `ts-node`, and `@types/node` (already present).
  - Create `vitest.config.ts` configured for the Node environment, reusing the tsconfig path aliases.
  - Add npm scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`.
- **Database-aware integration tests.**
  - Define `DATABASE_URL_TEST` in `.env.test` pointing to a dedicated Neon branch or local Postgres instance.
  - Provide a helper (e.g., `tests/utils/prisma-test-client.ts`) that instantiates Prisma with `DATABASE_URL_TEST`.
  - Before each test suite, run `pnpm prisma migrate deploy --schema prisma/schema.prisma --env-file .env.test` to ensure schema parity. Clean tables between tests to keep runs deterministic.
- **Unit tests to implement as part of this task:**
  1. Plan helper logic (limit calculation, overrides, error throwing).
  2. Workspace auto-provisioning utilities (creating default workspace/membership, enforcing uniqueness).
  3. Seed-data mappers that transform prototype JSON into the DB-ready shapes (use fixtures under `tests/fixtures`).
- **Testing ergonomics.**
  - Add `tests/setup.ts` to configure global Vitest hooks (loading env, polyfills).
  - Document in README how to run tests locally, including the need for `DATABASE_URL_TEST`.
  - CI (if configured later) should run `pnpm test` to guard migrations/helpers.

## 10. Migration & Validation Steps
1. Update `schema.prisma`.
2. `pnpm prisma migrate dev --name add_review_models` (generates SQL).
3. `pnpm prisma generate`.
4. `pnpm prisma migrate deploy` against Neon (ensure DATABASE_URL points to shared db).
5. `pnpm prisma db seed`.
6. Record migration + seed logs in PR.

## 11. Acceptance Criteria
- Running the migration on a clean Neon database succeeds without manual intervention.
- `prisma format` passes; `prisma validate` shows no warnings.
- Seed script completes and `App`, `Review`, `ReviewSnapshot`, `ReviewSnapshotInsight` rows exist (verify via Prisma Studio or SQL).
- `PLAN_LIMITS` exported and used by helper utilities; plan defaults automatically populate new workspaces.
- All new files are covered by TypeScript types (no `any`).
- Documentation explains how to run migrations/seeds and how sample data maps to prototype JSON.

## 12. Open Questions & Follow-ups
- Do we need soft-delete behavior for Reviews (GDPR requests)? For now, rely on `deletedAt` only at Workspace/App level; individual review deletion can be a later concern.
- Should plan overrides live per workspace or per Stripe subscription item? This spec stores overrides directly in Workspace; revisit once billing requirements harden.
- Multi-workspace per user: this spec assumes we auto-create a “Personal” workspace per user. Task 2 should confirm how users switch workspaces in the UI.
- Insight storage granularity: we’re persisting both `rawInsights` JSON and normalized Insight rows. If this proves redundant, we can pare back later but this structure supports Phase 2 filtering/search (Roadmap lines 267‑274).
