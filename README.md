# Tour Guide Operations

Tour Guide Operations is a full-stack operations workspace for tourism teams. It centralizes tour groups, guide availability, assignments, planning, change requests, and operational imports in one permission-aware application.

This repository is a sanitized portfolio copy. It contains no production credentials, is not linked to a production Supabase project, and keeps development fallback data so the interface can be reviewed locally without external infrastructure.

## The problem it solves

Tour operations teams need to spot groups without a guide, avoid assignment conflicts, track guide confirmations, and keep planning data consistent across spreadsheets and separate workflows. This project turns those tasks into a shared operational view while preserving assignment history and enforcing business rules at both the UI and database boundaries.

## Implemented features

- Operations dashboard with upcoming groups, unassigned groups, pending confirmations, and change-request indicators.
- Group and guide management with filtering, validation, status workflows, and archived-history support.
- Guide availability management, including annual submissions, exceptions, review states, and conflict checks.
- Assignment and planning workflows with candidate filtering, transactional changes, confirmation tracking, and assignment-generated occupancy.
- A guide portal for profiles, assigned groups, availability, confirmations, and change requests.
- CSV import and export for operational datasets, with previews, validation, configurable circuit mappings, and field-level export controls.
- Role- and permission-aware navigation and actions backed by Supabase Auth and Row Level Security.
- Internationalized UI and translation-catalog workflows for English, Spanish, French, and Turkish, with English fallback.
- Notification outbox and communication history. Delivery-provider integration is intentionally deferred; the UI never reports queued email as sent.
- Development-only diagnostics and mock/localStorage fallbacks for safe local review.

## Technology stack

- Next.js 16 App Router and React 19
- TypeScript with strict checking
- Tailwind CSS 4, shadcn/ui, Radix UI, and Lucide icons
- Supabase Auth, PostgreSQL, Row Level Security, SQL functions, and migrations
- Playwright Test for the automated regression suite
- ESLint with the Next.js Core Web Vitals and TypeScript configurations

## Architecture

The application uses route-level components in `app/`, feature-oriented UI in `components/`, and shared domain, authorization, data-access, and utility code in `lib/`.

Browser-facing Supabase queries and mutations are separated under `lib/supabase/`. The database contract lives in the ordered migrations under `supabase/migrations/`; these include the schema, reference data, permission model, RLS policies, transactional workflows, and translation catalog. In development, supported modules can fall back to deterministic mock data and browser storage. Production mode does not expose that fallback and requires a configured Supabase project.

Sensitive operations are implemented through permission-checked PostgreSQL functions rather than unrestricted browser writes. Assignment, group-status, availability, import, and authorization workflows retain history and validate their invariants transactionally.

## How Codex was used

Codex was used as a development partner throughout the project: to inspect the existing architecture, propose incremental implementation plans, implement narrowly scoped UI and Supabase changes, review SQL/RLS boundaries, and run local lint, type, build, and regression checks. Human decisions remained authoritative for business rules, security boundaries, and production rollout. Changes were kept reviewable through explicit migration ordering, conservative fallbacks, and verification notes.

The repository retains `AGENTS.md`, which tells coding agents to consult the version-matched Next.js documentation installed with the project before making framework-specific changes.

## Local setup

Requirements:

- Node.js 20.9 or newer
- npm
- Docker and the Supabase CLI only if you want to run the optional local database stack

Install dependencies and start the application:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no Supabase environment variables, development mode uses the existing local fallback where supported. Development tools are disabled by default.

### Optional local Supabase setup

Do not use production credentials for local development. Start the repository's local Supabase stack and apply its migrations:

```bash
npx supabase start
npx supabase db reset
```

Create `.env.local` with the following shape and fill it only with values reported by the local Supabase instance:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-publishable-or-anon-key>
NEXT_PUBLIC_ENABLE_DEV_TOOLS=false
```

Set `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true` only when you intentionally need the development diagnostics or preview controls. All `.env*` files are ignored except the placeholder-only `.env.example`.

The example SQL file `supabase/local-dev-auth-profile-mapping.example.sql` documents optional local auth/profile mapping. Review it before running it, and never add real passwords, tokens, user identifiers, or production URLs to the repository.

## Available commands

```bash
npm run dev        # Start the development server
npm run lint       # Run ESLint
npm run typecheck  # Run the TypeScript compiler without emitting files
npm test           # Run the Playwright-based regression tests
npm run build      # Create a production build
npm run start      # Serve a completed production build
```

The current automated suite exercises access-refresh race handling and does not require a browser or Supabase. Database/RLS verification requires an isolated local Supabase stack; it must never be run against production by default.

## Security and deployment notes

- `.env*`, build output, dependencies, coverage, and Playwright artifacts are excluded from version control.
- `NEXT_PUBLIC_*` values are browser-visible and embedded at build time. Only use the Supabase public URL and publishable/anon key there; never use a service-role key.
- Local fallback data is for development review, not a production security boundary.
- A production deployment requires a dedicated Supabase project, reviewed environment configuration, migrated schema, auth-provider setup, and a complete RLS verification pass. Those steps are intentionally outside this portfolio preparation.

## Project status

The application and its database evolution are preserved as implemented. External email delivery remains provider-deferred, and this portfolio copy is intentionally unconfigured for production services.
