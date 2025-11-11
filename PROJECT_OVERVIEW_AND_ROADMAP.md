# App Review Analyzer – Project Overview & Roadmap

## 1. Product Vision

**Working name:** App Review Analyzer (future: “AppLens” / “Opportunity Scanner”)

Help indie developers, small studios, and product teams **turn noisy app store reviews into clear product insights**—so they can:

- Understand what users actually care about.
- Spot gaps and weaknesses in existing apps.
- Make better decisions about **what app to build next** or **what to improve next**.

V1 focuses on **analyzing reviews for a single app**.  
Later phases expand to **multi-app “Opportunity Scanner”** that compares competitors, clusters themes across a whole niche, and surfaces market gaps.

---

## 2. Goals & Non-Goals

### 2.1 Goals

- Provide a **practical, focused tool** that helps:
  - Indie iOS developers and small studios.
  - Entrepreneurs evaluating app ideas.
  - Product teams researching competitors.
- Turn raw reviews into:
  - Clear **summaries & theme clusters**.
  - **Feature request lists** and **complaint buckets**.
  - Simple **visuals / trends** (e.g. sentiment over time).
- Integrate naturally with the existing **SaaS starter**:
  - Workspaces, auth, Stripe subscriptions.
  - Multi-tenant, multi-user from day one.
- Lay the groundwork for:
  - Automated **niche research** (Opportunity Scanner).
  - Integration with future **courses / content** (AppDevFoundry, iOSDevMastery).

### 2.2 Non-Goals (for now)

- Full ASO tool (keyword rankings, screenshots, A/B testing).
- Trading / arbitrage on app businesses.
- Building a full-blown “all app stores, all platforms” solution. Initial focus is **iOS App Store**, with architecture that allows adding others later.

---

## 3. Target Users & Use Cases

### 3.1 Primary Users

1. **Indie iOS Developers**
   - Solo or small teams.
   - Looking for their **next app idea** or ways to **improve an existing app**.

2. **Entrepreneurs / Non-technical founders**
   - Evaluating whether a niche is worth building in.
   - Comparing competitors before investing in dev work.

3. **Small Product Teams**
   - Need **quick insight** into competitor apps.
   - Want structured data to support roadmap discussions.

### 3.2 Key Use Cases

1. **“Should I build an app in this niche?”**
   - User enters a competitor’s App Store URL.
   - Tool shows top pain points & feature gaps.
   - User decides whether there’s room to differentiate.

2. **“How can I improve my existing app?”**
   - User tracks *their* app.
   - Tool clusters reviews into themes (e.g. “sync issues”, “pricing complaints”, “feature requests”).
   - User gets a prioritized list of improvements.

3. **“Which competitor is weakest on X?”** (future Opportunity Scanner)
   - User selects multiple competitors in a niche.
   - Tool compares their review profiles.
   - Highlights relative strengths/weaknesses and recurring unmet needs.

---

## 4. Core Concepts & Data Model (High-Level)

These will map to Prisma models in the SaaS starter.

- **User**
  - Authenticated person (Auth.js).
  - Belongs to one or more **Workspaces**.

- **Workspace**
  - Represents an indie dev, studio, or product team.
  - Owns **Apps**, **ReviewSnapshots**, and related resources.
  - Plan/billing info is derived from Stripe subscription.

- **App**
  - Single tracked app from the iOS App Store.
  - Fields:
    - `platform` (initially `"ios"`)
    - `appStoreId` (numeric Apple ID)
    - `name`, `iconUrl`, `developerName`, `primaryCategory`
    - `averageRating`, `ratingCount`
  - Belongs to a Workspace.

- **Review**
  - Raw, individual app store review.
  - Fields:
    - `author`, `title`, `body`
    - `rating`, `language`, `version`
    - `publishedAt`
  - Associated to an App (and implicitly a Workspace).

- **ReviewSnapshot**
  - Represents a **batch analysis run** for an App at a point in time.
  - Stores:
    - Time range of reviews analyzed.
    - Counts (positive/neutral/negative).
    - Serialized **AI-generated insights** (JSON / text).
  - Used for history and “compare over time.”

- **Insight**
  - Logical concept (may be embedded under ReviewSnapshot or broken into separate table later).
  - Types:
    - `FEATURE_REQUEST`
    - `BUG_OR_COMPLAINT`
    - `PRAISE`
    - `USABILITY_ISSUE`
  - Fields:
    - `title`
    - `description`
    - `supportingReviewIds` or counts.

- **CompetitorSet / Niche** (Phase 2+)
  - Represents a **group of apps** that define a niche (e.g. “intermittent fasting trackers”, “golf stat apps”).
  - Used by the Opportunity Scanner to aggregate insights across multiple apps.

---

## 5. Product Walkthrough (V1 App Review Analyzer)

### 5.1 Onboarding & Setup

1. User signs up / logs in.
2. Creates a **Workspace** (or uses default personal workspace).
3. Chooses plan:
   - Free: limited apps & analyses.
   - Pro: more apps, deeper analysis, more frequent refresh.

### 5.2 Adding an App

- User clicks **“Add App”**.
- Inputs either:
  - App Store URL, or
  - Numeric app ID.
- System:
  - Parses URL → extracts app ID.
  - Calls metadata API (App Store lookup).
  - Displays confirmation with app name, icon, rating.
  - Saves App under the Workspace.

### 5.3 Fetching Reviews

- For each app, user can click **“Fetch & Analyze Reviews”**.
- System:
  1. Fetches new reviews from the App Store (since last run).
  2. Stores them in the DB.
  3. Triggers **AI analysis**:
     - Summarizes sentiment.
     - Extracts themes: feature requests, complaints, praise.
     - Suggests “most impactful improvements.”
  4. Saves a **ReviewSnapshot** with all results.

### 5.4 Viewing Insights

On the App details page:

- **Overview section**
  - App metadata (rating, category etc.).
  - Count of reviews analyzed.
  - Sentiment bar/pie (positive/neutral/negative).
  - Last analysis timestamp.

- **Insights section**
  - “Top 5 Feature Requests”
  - “Top 5 Complaints”
  - “Key Themes & Takeaways” (AI-generated narrative).
  - “If you were building a competitor…” synthesis.

- **Reviews tab**
  - Filterable list of raw reviews:
    - Filter by rating, version, date, theme.
  - Helpful for deeper manual inspection.

### 5.5 Limits & Billing (V1)

Example defaults (adjustable later):

- **Free**
  - 1 Workspace, 1 App.
  - 1 analysis run/week.
  - Limited review depth or time range.

- **Pro**
  - Multiple Apps (e.g. 5–10).
  - Daily or on-demand analyses (rate-limited).
  - Longer history window.
  - More detailed AI insights.

---

## 6. Roadmap & Phases

### Phase 1 – MVP: Single-App Review Analyzer

**Objective:** A solid, usable, end-to-end tool for analyzing reviews of a single app.

**Key Deliverables:**

1. **Data model & infrastructure**
   - Workspace, User linkage (leveraging saas starter).
   - App, Review, ReviewSnapshot models.
   - Background job or queued workflow pattern (for fetching/analysis).

2. **App management UI**
   - App list view within a Workspace.
   - “Add App” flow with URL/id parsing and lookup.
   - Ability to delete or pause tracking for an app.

3. **Review ingestion**
   - Adapter to fetch reviews from App Store API (or interim solution if API access is limited).
   - Logic to deduplicate reviews and store them.
   - Configurable limits per run based on plan.

4. **AI analysis**
   - Prompt(s) to:
     - Cluster reviews into themes.
     - Extract feature requests & complaints.
     - Summarize key takeaways.
   - Store results under ReviewSnapshot.

5. **Insights dashboard**
   - Per-app detail page showing:
     - App overview.
     - Sentiment summary.
     - Top themes, feature requests, complaints.
   - Simple charts / visuals (sentiment distribution).

6. **Plan limits & gating**
   - Plan-based:
     - Max apps per workspace.
     - Max analyses per month.
     - Max review count or time range per analysis.
   - Integrate with Stripe subscription status from the starter.

---

### Phase 2 – Pro Features & Better UX

**Objective:** Increase perceived value for paying users and polish the experience.

**Key Deliverables:**

1. **Comparison over time**
   - Timeline view showing:
     - Average rating trend.
     - Sentiment trend.
     - “Theme frequency” trend (e.g. fewer crash reports after a given version).
   - Compare two snapshots side-by-side.

2. **Improved filtering & search**
   - Filter reviews by:
     - Rating (1–5)
     - Version
     - Date range
     - Theme
   - Search within reviews.

3. **Saved “insight views”**
   - Allow users to save filters as “views” (e.g. “Bugs in last 3 months”, “Feature ideas”).
   - Useful for recurring product reviews.

4. **Notifications**
   - Optional email summary:
     - Weekly: “New major themes in the last 7 days.”
   - Engagement driver for Pro users.

5. **Team collaboration (lightweight)**
   - Invite others to workspace.
   - Basic role: Admin vs Member.
   - Commenting on specific insights or themes (nice-to-have, can be Phase 3 if complex).

---

### Phase 3 – Opportunity Scanner (Multi-App / Niche Analysis)

This is where **Idea #2** comes in.

**Objective:** Expand from single-app insights to **niche-level opportunity discovery.**

**Key Concept:** **Niche / CompetitorSet**

- A Niche is a named group of apps, e.g. “Habit trackers”, “Intermittent fasting”, “Kids sleep apps”.
- Each Niche maps to multiple Apps already in the system (or ones the user adds).

**Key Deliverables:**

1. **Niche / CompetitorSet management**
   - Create a Niche: name + description.
   - Add existing tracked apps to the Niche or search/add new ones.
   - Optionally auto-suggest top apps for a keyword/phrase (future enhancement).

2. **Multi-app analysis**
   - Aggregate reviews & insights across all apps in the Niche.
   - AI analysis that answers:
     - “Across this niche, what are the most common complaints?”
     - “Which user pains are unsolved or poorly addressed?”
     - “Which features are table stakes vs differentiators?”

3. **Comparative metrics**
   - Per app in the Niche:
     - Average rating (recent 90 days vs lifetime).
     - Volume of complaints about specific themes (e.g. “sync”, “onboarding”, “pricing”).
   - Per theme:
     - How many apps get dinged for this?
     - Is there any app that does this well?

4. **Opportunity scoring**
   - Define a simple scoring heuristic:
     - High demand + high dissatisfaction + few apps doing it well = higher opportunity score.
   - Present a **ranked list of “opportunity themes”** in a Niche.
   - Example output:
     - “Offline mode and sync reliability are major pain points across 4/5 habit apps.”
     - “Long-term progress visualization is requested often but poorly implemented.”

5. **Niche reports**
   - Generate a shareable or exportable “Niche Report”:
     - Summary of niche.
     - Key pain points and gaps.
     - Suggested directions for a new app or a major feature for existing one.

**Plan gating for Opportunity Scanner:**

- Likely Pro/Team-only feature.
- Limits on:
  - # of apps per Niche.
  - # of Niches.
  - Frequency of full re-analyses.

---

### Phase 4 – Stretch Ideas (Future / Optional)

- **Additional platforms**
  - Google Play, macOS App Store, other app stores.
  - Merge cross-platform insights for the same product.

- **Deeper ASO integration**
  - Pull basic rank / category data.
  - Combine qualitative (reviews) + quantitative (ranking) signals.

- **Public sharable pages**
  - Optionally share a read-only “insights snapshot” for a given app or niche.
  - Useful for public portfolio content or marketing.

- **Integrations**
  - Notion/Slack integration for pushing weekly summaries.
  - Webhooks for custom workflows.

---

## 7. Monetization & Plans (Draft)

**Note:** This is directional, not final pricing.

### Free

- 1 workspace.
- 1 tracked app.
- 1 analysis run per week.
- Limited number of reviews analyzed per run (e.g. last 100).

### Pro

- 1 workspace.
- 5–10 tracked apps.
- Daily or on-demand analyses (rate-limited).
- Larger review slice (e.g. last 500–1000).
- Comparison over time.
- Basic niche analysis for up to 1 simple Niche (maybe 2–3 apps).

### Team

- Multiple users per workspace.
- More apps (e.g. 20+).
- Multiple Niches with multi-app Opportunity Scanner.
- Priority support.
- Enhanced exports and integrations (Slack/Notion/email digests).

---

## 8. Technical Overview (High-Level)

This sits on top of the **Next SaaS Stripe Starter** foundation.

### 8.1 Tech Stack

- **Frontend & API:** Next.js 14 (App Router, Server Actions), TypeScript.
- **UI:** Tailwind CSS + shadcn/ui.
- **Auth:** Auth.js v5.
- **DB:** Neon Postgres + Prisma.
- **Billing:** Stripe subscriptions.
- **Email:** Resend + React Email (for summaries/notifications).
- **AI:** OpenAI or compatible model for:
  - Thematic clustering.
  - Summarization.
  - Opportunity scoring.

### 8.2 Key Flows

1. **Add App**
   - Client → API/Server Action → App Store metadata fetch → Prisma write.

2. **Review Fetch + Analyze**
   - Trigger (button click or scheduled job) → fetch new reviews → DB store → AI summarize → write ReviewSnapshot.

3. **Insight Display**
   - Server components load App + last ReviewSnapshot + aggregated stats → render UI.

4. **Niche Analysis (Phase 3)**
   - Fetch apps & their snapshots → aggregate relevant review subsets → AI analysis for cross-app themes & opportunities → store & render NicheSnapshot.

---

## 9. Risks & Open Questions

### 9.1 Risks

- **App Store data access**
  - Need to validate sustainable access to review data (official APIs vs scraping; rate limits).
- **AI costs**
  - Analysis is token-heavy; need to:
    - Limit free usage.
    - Cache results (ReviewSnapshots).
    - Possibly pre-batch jobs to reduce cost.

- **Signal vs noise**
  - Need good prompting and heuristics so insights feel genuinely useful, not generic.

### 9.2 Open Questions

- How much history (time range) does a typical user need to feel they’re getting real value?
- Should we support **multiple locales/languages** early, or start with English-only?
- What is the minimal set of charts/visualizations that offer value without overengineering?

---

## 10. Next Steps

1. **Align on core scope for Phase 1 (MVP)**:
   - Confirm exact fields for App, Review, ReviewSnapshot.
   - Decide initial plan limits (apps, analyses, review count).

2. **Create a short MVP spec**:
   - “Add App → Fetch Reviews → Generate + Display Insights” as one self-contained milestone.

3. **Leverage existing prototype(s)**:
   - Review the previous review-analyzer prototype.
   - Reuse any good prompts, data structures, or heuristics.

4. **Implement MVP on top of saas-stripe-starter**:
   - Start with schema & basic UI (App listing, Add App).
   - Stub review fetch with sample data if necessary.
   - Add AI summarization last, once the data loop is solid.

This document should serve as the **anchor overview** and roadmap for the repository. More detailed technical and product specs can be created per phase (e.g. `/docs/specs/phase1-mvp.md`, `/docs/specs/opportunity-scanner.md`) as implementation begins.