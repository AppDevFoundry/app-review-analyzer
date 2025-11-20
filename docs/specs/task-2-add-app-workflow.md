You are an expert level frontend software engineer specializing in Next.js/React, TypeScript, Tailwind CSS, UI/UX.

# Task 2 – “Add App” Workflow & Metadata Fetcher
 
Related roadmap: `PROJECT_OVERVIEW_AND_ROADMAP.md` §6 “Phase 1 – MVP” (lines 221‑245)
Note: Here are some Progress Notes you can review for what was recently implemented from the roadmap: @docs/TASK_1_COMPLETION_SUMMARY.md

## 1. Why this matters
- Phase 1 requires an App management UI so users can list, add, pause, or delete tracked apps inside their workspace (roadmap lines 221‑225).
- Fetching App Store metadata up front keeps data clean (name, icon, developer, category) and unlocks downstream insights without extra manual entry.
- Plan limits (Task 1) must be enforced at this entry point to stop Starter users from exceeding their allowances.
- Clear UX scaffolding here ensures Task 3 (review ingestion) has a reliable entry point and surfaces status back to users.

## 2. Goals
1. Provide an authenticated “Apps” surface in the protected area where workspace members can view/manage their tracked apps.
2. Implement a full “Add App” flow that accepts an App Store URL or numeric ID, parses it, fetches metadata from Apple, enforces plan limits, and persists the App record.
3. Allow pausing (toggling status) and deleting apps, honoring workspace access control.
4. Communicate plan limits and state (e.g., remaining slots) in the UI, driven by the plan metadata from Task 1.
5. Ensure all actions are covered by robust server-side validation, tenancy checks, and optimistic UI states.

## 3. Non-Goals
- No review ingestion, analysis, or scheduling (Task 3).
- No workspace switcher UX (future enhancement) beyond using the default workspace resolved server-side.
- No deep App detail dashboard yet (will arrive with Tasks 3‑5); this task focuses on list management + creation.

## 4. Dependencies & Inputs
- Task 1 schema + helpers (`Workspace`, `App`, plan limits, workspace fetch utilities) must be merged.
- Auth + protected layout already exist (`app/(protected)/layout.tsx` and `app/(protected)/dashboard/page.tsx`).
- Shadcn UI primitives (cards, table, dialog, toast) are available in `components/ui`.
- Need Apple Search API access (no auth required) – use public Lookup endpoint.

## 5. Deliverables
1. **Apps route** within the protected area (`app/(protected)/apps/page.tsx` or replace current dashboard page) showing:
   - App list (table or cards) with key metadata.
   - Empty-state messaging + CTA when none exist.
2. **Client components** for:
   - App list/table (`components/apps/app-table.tsx`).
   - App card row with status badges + actions.
   - “Add App” dialog (`components/apps/add-app-dialog.tsx`).
3. **Server actions / API routes**:
   - `createApp` (add + metadata fetch).
   - `updateAppStatus` (pause/resume).
   - `deleteApp`.
4. **Validation & helpers**:
   - Zod schema for parsing input (App Store URL or ID, optional nickname).
   - Utility to parse Apple IDs from URL.
   - Apple metadata fetcher module under `lib/apple.ts`.
5. **Plan enforcement + messaging** integrated via Task 1 helpers.
6. **Tests** (unit or integration) covering parser + metadata fetcher + server action validation.
7. **Docs snippet** referencing this flow (README or `docs/specs/task-2…`).

## 6. UX Requirements

### 6.1 Navigation & layout
- Add “Apps” nav entry in the protected layout sidebar/top nav (wherever menu lives).
- Route should be server-rendered, fetching data via `prisma.app.findMany` scoped to the current workspace.
- Page metadata updated to reference “Apps – App Review Analyzer”.

### 6.2 List states
- **Default list**: grid or table showing for each app:
  - Icon, name, developer.
  - Platform badge (iOS).
  - Status badge (Active, Paused, Archived).
  - Last synced timestamp (if exists).
  - Average rating + review count (if stored).
  - Actions: “Pause/Resume”, “Delete”, “View details” (link placeholder for future detail page).
- **Empty state**: use `EmptyPlaceholder` pattern with CTA “Add your first app”.
- **Loading state**: skeleton cards for initial load; button spinner when performing actions.

### 6.3 Add App dialog
- Primary CTA button `Add App`.
- Dialog content:
  - Input for App Store URL or numeric ID (single field) with help text + example (`https://apps.apple.com/us/app/storygraph/id1570489264`).
  - Optional text input for internal nickname/notes (stored later or ignored for now; include stub but optional).
  - Display plan usage (e.g., “2 of 5 apps used on Pro plan”).
- On submit:
  - Optimistically disable form + show spinner.
  - If plan limit reached, show inline error + disable CTA. Provide upsell link to pricing page.
  - Success state closes dialog, triggers toast (“StoryGraph added”) and refreshes list.

### 6.4 Actions
- **Pause/Resume**:
  - Toggle `App.status` between `ACTIVE` and `PAUSED`.
  - Confirmation prompt when pausing (explain it stops future reviews until resumed).
  - Paused cards should show muted style + tooltip.
- **Delete**:
  - Danger confirmation modal referencing app name.
  - Deleting sets `deletedAt` on App (soft delete) or removes row (align with Task 1 decision). For now, soft delete recommended; specify in server action.
  - On delete, also surface note that reviews remain but app no longer appears (foundation for future data retention).

### 6.5 Toasts & errors
- Use shadcn `useToast`.
- Cases: success (added, paused, resumed, deleted), validation error, Apple lookup failure, network failure.
- Display inline validation error when Apple ID invalid or metadata not found.

## 7. Server Action Requirements

### 7.1 Shared constraints
- All actions must:
  - Enforce authentication (via `getCurrentUser`).
  - Resolve workspace via Task 1 helper (ensuring membership/role).
  - Ensure user has permission (Owner/Admin for destructive actions; Members can add apps if plan allows? confirm requirement—default to allowing all members).
  - Wrap DB writes in try/catch; log errors with `console.error` or centralized logger.

### 7.2 `createApp` action
Input:
```ts
type CreateAppInput = {
  identifier: string; // URL or numeric id
  nickname?: string;
};
```
Steps:
1. Validate input via Zod (`identifier` required, trimmed).
2. Parse Apple ID:
   - Accept: numeric string, App Store URL, or share link.
   - Use regex to capture `/id(\d+)` or query param `?id=`.
3. Call Apple Lookup API:
   - `https://itunes.apple.com/lookup?id=${appId}&entity=software`
   - Optionally add `&country=us` or allow override.
   - Timeout at ~5s; retry once on network failure.
4. Extract metadata:
   - `trackName`, `artistName`, `primaryGenreName`, `artworkUrl512`, `averageUserRating`, `userRatingCount`, `bundleId`, `trackViewUrl`.
5. Enforce plan limit:
   - Use helper from Task 1 to compute `currentAppCount` vs `workspace.appLimit`.
6. Upsert `App` row with slug `slugify(trackName)` unique per workspace.
7. Return new App data to client for optimistic update.

Edge cases:
- If Apple API returns no results, surface “App not found”.
- If duplicate `appStoreId` exists in workspace, return friendly message.
- If plan limit exceeded, return `PlanLimitError` and UI should show upgrade CTA.

### 7.3 `updateAppStatus`
Input: `{ appId: string, status: AppStatus }`
Checks:
- App must belong to workspace.
- Only allow transitions: Active ↔ Paused (Archived reserved for delete).
- Update `status`, `updatedAt`, `pausedAt?`.
- Return updated record.

### 7.4 `deleteApp`
Input: `{ appId: string, hardDelete?: boolean }`
Behavior:
- Default soft-delete by setting `deletedAt` + `status = ARCHIVED`.
- Optionally accept `hardDelete` for future cleanups but keep false for now.
- Ensure cascade behavior for related data is defined later (Task 3).

## 8. Metadata Fetcher & Caching
- Create `lib/apple.ts` with:
  - `fetchAppStoreMetadata(appStoreId: string, country = "us")`
  - `parseAppStoreId(identifier: string)`
- Use `fetch` with `next: { revalidate: 60 * 60 }` to allow edge caching; also guard with `AbortController` for timeout.
- Normalize metadata fields into internal type:
  ```ts
  export type AppStoreMetadata = {
    appStoreId: string;
    name: string;
    developerName: string;
    iconUrl: string;
    storeUrl: string;
    primaryCategory: string;
    averageRating?: number;
    ratingCount?: number;
    bundleId?: string;
    country: string;
  };
  ```
- Handle `artworkUrl512` vs `artworkUrl100` fallback; ensure https.
- Log the request/response status for diagnostics (without storing full payload).

## 9. Plan enforcement & messaging
- Use `PLAN_LIMITS` + workspace overrides.
- Compute `appsRemaining = max(0, appLimit - currentAppCount)`.
- Display in UI near Add button.
- If user hits limit:
  - Disable Add button (but still allow clicking to see upsell message).
  - Show inline banner referencing pricing page (`/pricing`).
- When workspace plan changes (Stripe webhook), subsequent loads should reflect new limits automatically via helper.

## 10. Observability & DX
- Server actions should throw `Error` with user-facing message; UI catches and surfaces toast.
- Consider instrumentation hook (e.g., `console.info` for audit) with context: `{ workspaceId, userId, action }`.
- Add storybook-style screenshot or description to docs? optional.

## 11. Testing Strategy
- **Testing stack**
  - Reuse the Vitest setup from Task 1. Client components should use `@testing-library/react` + `@testing-library/user-event` (add as dev deps) with `vitest-environment-jsdom`.
  - Mock network access with `msw` (Mock Service Worker) to stub the Apple Lookup API so tests do not hit the real endpoint.
  - Extend `tests/setup.ts` to register `msw` handlers and JSDOM globals for React Testing Library.
- **Unit tests**
  - `parseAppStoreId` covering valid numeric IDs, localized URLs, query-param forms, trailing slashes, and failure cases.
  - `fetchAppStoreMetadata` verifying mapping logic, error handling (404/no result), and fallback icon URLs using mocked fetch/MSW.
  - UI components (`AppTable`, `AddAppDialog`) snapshot/DOM tests ensuring plan-limit banners, loading states, and CTA enable/disable logic render correctly.
- **Server action tests**
  - Use Vitest running in Node env with the Prisma test DB to assert:
    - `createApp` enforces plan limits and deduplicates `appStoreId`.
    - `updateAppStatus` rejects cross-workspace access and illegal transitions.
    - `deleteApp` soft-deletes and updates status to `ARCHIVED`.
  - Seed the test DB within each suite using the helper fixtures created in Task 1; clean up via transaction rollbacks or TRUNCATE between tests.
- **Manual QA checklist**
  1. Login as Starter user with 0 apps → add valid StoryGraph ID → card appears.
  2. Attempt to add same app twice → receive friendly duplicate warning.
  3. Switch plan limit (mock via DB) to 1 → attempt to add second app → limit message + upsell.
  4. Pause/resume toggles status badge + disables ingestion placeholder.
  5. Delete app → disappears from list; limit counter updates instantly.

## 12. Acceptance Criteria
- Visiting `/dashboard/apps` (or `/dashboard`) shows real data for the current workspace with correct states.
- “Add App” successfully saves metadata for at least one real App Store ID and enforces plan limit.
- Plan usage indicator updates immediately after add/delete.
- Server logs show metadata fetch + creation events without leaking secrets.
- All inputs validated; invalid App Store URL errors are user-friendly.
- UI states match design system (shadcn) and responsive across breakpoints.
- Spec + README updated explaining how to add apps locally (including need for `.env` Apple key = none).

## 13. Open Questions & Follow-ups
- Do we want to support searching by keyword (Apple Search API) if user doesn’t know ID? For now, ID/URL only; future enhancement could add autocomplete.
- Should Members be allowed to delete apps or is that Admin-only? Default to Admin/Owner for delete; note in spec so implementer can confirm.
- Should deleting also delete future scheduled jobs (Task 3)? Add TODO for ingestion worker to respect `App.status`.
- Need to decide where App detail route will live; for now, `View details` can link to `/apps/[appId]` placeholder.

**Also note, the database currently is a branch from an outdated version, so we need to run the migration files as well to get the database setup to an expected state before starting this task. Please take a look at the database and migrations and apply accordingly**
