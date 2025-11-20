<a href="https://app-review-analyzer.vercel.app">
  <img alt="App Review Analyzer" src="public/_static/og.jpg">
  <h1 align="center">App Review Analyzer</h1>
</a>

<p align="center">
  Turn app store reviews into clear product insights
</p>

<p align="center">
  <a href="https://twitter.com/AppDevFoundry">
    <img src="https://img.shields.io/twitter/follow/AppDevFoundry?style=flat&label=AppDevFoundry&logo=twitter&color=0bf&logoColor=fff" alt="AppDevFoundry Twitter follower count" />
  </a>
</p>

<p align="center">
  <a href="#introduction"><strong>Introduction</strong></a> ·
  <a href="#installation"><strong>Installation</strong></a> ·
  <a href="#tech-stack--features"><strong>Tech Stack + Features</strong></a> ·
  <a href="#author"><strong>Author</strong></a> ·
  <a href="#credits"><strong>Credits</strong></a>
</p>
<br/>

## Introduction

App Review Analyzer helps indie developers, small studios, and product teams turn noisy app store reviews into clear product insights. Built with Next.js 14, Prisma, Neon, Auth.js v5, Resend, React Email, Shadcn/ui, and Stripe.

Understand what users actually care about, spot gaps in existing apps, and make better decisions about what to build or improve next.

## Installation

Clone this repo locally with the following command:

```bash
git clone https://github.com/AppDevFoundry/app-review-analyzer.git
```

Or, deploy with Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAppDevFoundry%2Fapp-review-analyzer)

### Steps

1. Install dependencies using pnpm:

```sh
pnpm install
```

2. Copy `.env.example` to `.env.local` and update the variables.

```sh
cp .env.example .env.local
```

3. Set up the database:

```sh
# Run Prisma migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed the database with demo data
npx prisma db seed
```

4. Start the development server:

```sh
pnpm run dev
```

> [!NOTE]
> I use [npm-check-updates](https://www.npmjs.com/package/npm-check-updates) package for update this project.
>
> Use this command for update your project: `ncu -i --format group`

## Database

### Schema Overview

The application uses a fully normalized PostgreSQL schema with the following key models:

- **Workspace** - Multi-tenant workspace with plan-based limits
- **App** - Tracked iOS apps
- **Review** - Individual app store reviews with full metadata
- **ReviewSnapshot** - Analysis runs with aggregated insights
- **ReviewSnapshotInsight** - Categorized findings (bugs, features, praise)
- **ReviewInsightLink** - Links insights back to source reviews

See the complete schema in `prisma/schema.prisma`.

### Working with the Database

```sh
# View data in Prisma Studio
npx prisma studio

# Create a new migration after schema changes
npx prisma migrate dev --name your_migration_name

# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# Re-seed database
npx prisma db seed
```

### Seed Data

The seed script (`prisma/seed.ts`) creates:
- Demo user (`demo@appanalyzer.dev`)
- Sample workspace
- StoryGraph app with 739 real reviews
- Complete analysis snapshot with insights

All seed data is sourced from `prototype/review-analyzer/` JSON files.

## Testing

### Running Tests

The project uses [Vitest](https://vitest.dev/) for unit and integration testing.

```sh
# Run all tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

### Test Database Setup

Tests require a separate test database to avoid affecting development data:

1. **Option A - Neon Branch (Recommended)**:
   - Create a new branch in your Neon project (e.g., `model_a_test`)
   - Copy the connection string from Neon dashboard
   - Update `DATABASE_URL_TEST` in `.env.test`

2. **Option B - Local PostgreSQL**:
   - Install PostgreSQL locally
   - Create a test database: `createdb app_review_analyzer_test`
   - Update `DATABASE_URL_TEST` in `.env.test`

**Important**: The test database will be cleaned between test runs. Never point `DATABASE_URL_TEST` to your production or development database!

### Writing Tests

Test files follow this structure:

```typescript
import { describe, it, expect } from "vitest"
import { withCleanDb } from "@/tests/utils/test-db"

describe("My Feature", () => {
  it("should do something", async () => {
    await withCleanDb(async (prisma) => {
      // Your test code with a clean database
      const result = await prisma.user.create({ ... })
      expect(result).toBeDefined()
    })
  })
})
```

See `tests/config/plan-limits.test.ts` for examples.

## Roadmap

See [PROJECT_OVERVIEW_AND_ROADMAP.md](PROJECT_OVERVIEW_AND_ROADMAP.md) for detailed product roadmap and feature plans.

## Tech Stack + Features

### Frameworks

- [Next.js](https://nextjs.org/) – React framework for building performant apps with the best developer experience
- [Auth.js](https://authjs.dev/) – Handle user authentication with ease with providers like Google, Twitter, GitHub, etc.
- [Prisma](https://www.prisma.io/) – Typescript-first ORM for Node.js
- [React Email](https://react.email/) – Versatile email framework for efficient and flexible email development

### Platforms

- [Vercel](https://vercel.com/) – Easily preview & deploy changes with git
- [Resend](https://resend.com/) – A powerful email framework for streamlined email development
- [Neon](https://neon.tech/) – Serverless Postgres with autoscaling, branching, bottomless storage and generous free tier.

### UI

- [Tailwind CSS](https://tailwindcss.com/) – Utility-first CSS framework for rapid UI development
- [Shadcn/ui](https://ui.shadcn.com/) – Re-usable components built using Radix UI and Tailwind CSS
- [Framer Motion](https://framer.com/motion) – Motion library for React to animate components with ease
- [Lucide](https://lucide.dev/) – Beautifully simple, pixel-perfect icons
- [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) – Optimize custom fonts and remove external network requests for improved performance
- [`ImageResponse`](https://nextjs.org/docs/app/api-reference/functions/image-response) – Generate dynamic Open Graph images at the edge

### Hooks and Utilities

- `useIntersectionObserver` – React hook to observe when an element enters or leaves the viewport
- `useLocalStorage` – Persist data in the browser's local storage
- `useScroll` – React hook to observe scroll position ([example](https://github.com/mickasmt/precedent/blob/main/components/layout/navbar.tsx#L12))
- `nFormatter` – Format numbers with suffixes like `1.2k` or `1.2M`
- `capitalize` – Capitalize the first letter of a string
- `truncate` – Truncate a string to a specified length
- [`use-debounce`](https://www.npmjs.com/package/use-debounce) – Debounce a function call / state update

### Code Quality

- [TypeScript](https://www.typescriptlang.org/) – Static type checker for end-to-end typesafety
- [Prettier](https://prettier.io/) – Opinionated code formatter for consistent code style
- [ESLint](https://eslint.org/) – Pluggable linter for Next.js and TypeScript

### Miscellaneous

- [Vercel Analytics](https://vercel.com/analytics) – Track unique visitors, pageviews, and more in a privacy-friendly way

## Author

Built by [AppDevFoundry](https://github.com/AppDevFoundry), released under the [MIT license](https://github.com/shadcn/taxonomy/blob/main/LICENSE.md).

## Credits

This project is built on top of the excellent [Next SaaS Stripe Starter](https://github.com/mickasmt/next-saas-stripe-starter) by [@miickasmt](https://twitter.com/miickasmt).

Additional inspiration from:
- Shadcn ([@shadcn](https://twitter.com/shadcn)) - [Taxonomy](https://github.com/shadcn-ui/taxonomy)
- Steven Tey ([@steventey](https://twitter.com/steventey)) - [Precedent](https://github.com/steven-tey/precedent)
- Antonio Erdeljac ([@YTCodeAntonio](https://twitter.com/AntonioErdeljac)) - [Next 13 AI SaaS](https://github.com/AntonioErdeljac/next13-ai-saas)
