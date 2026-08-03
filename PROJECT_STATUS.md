# Waypoint — project status

**Status date:** 3 August 2026

**Working branch:** `feat/ui-ux-redesign`

**Release stage:** feature-complete public-beta candidate; awaiting owner review
before merge and automatic deployment

## Product scope complete

- Public landing page and responsive authenticated application shell.
- Email/password authentication, recovery, Google OAuth, protected routes, and
  resumable onboarding through Supabase Auth.
- Isolated multi-user PostgreSQL data and private CV storage enforced with Row
  Level Security and tenant-safe foreign keys.
- Career Profile with manual facts, narrative import, review queues, insights,
  provenance, lifecycle states, and explicit uncertainty handling.
- PDF and DOCX CV upload, validation, deterministic extraction, structured
  sections and claims, multiple CV management, and permanent deletion.
- Job-description parsing, atomic requirements, evidence matching,
  deterministic scoring, apply/investigate/skip recommendations, CV selection,
  corrections, and saved analysis history.
- Application Kit with reusable user-owned answers and contact information.
- Bring Your Own Key support for OpenAI and Groq, including validation,
  encrypted credential storage, replacement, and removal.
- Account export and permanent account deletion.
- Deep Mineral responsive UI system using Tailwind CSS, Base UI, and generated
  shadcn-style source components.

## Engineering and safety complete

- Cookie-backed server sessions and PKCE OAuth callbacks.
- Encrypted AI credentials are never returned in plaintext or included in
  account exports.
- AI calls use fixed official provider endpoints; users cannot inject arbitrary
  endpoints.
- Prompt inputs are schema-validated and treated as untrusted content.
- Deterministic code owns authorization, evidence rules, scoring, blockers,
  fallbacks, and final decision policies.
- Atomic usage limits and per-user AI request concurrency leases.
- Atomic job-requirement correction keeps relational records and saved analysis
  JSON synchronized, with rollback for malformed historical data.
- Stable requirement positions preserve source ordering.
- Security headers and Content Security Policy are configured for development
  and production behavior.

## Current verification evidence

- `npm run typecheck`: passing.
- `npm run lint`: passing.
- `npm test`: 219 tests across 38 files passing.
- `npm run test:e2e`: 5 Chromium public/auth/legal/health and protected-route
  tests passing.
- `npm run build`: Next.js 16.2.12 production build passing on Node.js 22.
- `npm run test:integration`: 5 live disposable-account tests passing against
  the linked hosted Supabase project.
- Live integration coverage verifies two-user database and Storage isolation,
  atomic requirement synchronization, atomic narrative staging and review with
  rollback, and AI concurrency limits.
- Hosted Supabase migrations are applied through
  `202608030005_atomic_narrative_staging.sql`.
- Interactive Google signup has completed locally and returns to Waypoint’s
  onboarding flow.

## Release boundary

The branch must not be merged until the project owner reviews and approves it.
Merging to `main` triggers the already-configured deployment.

Before approval:

1. Review the final UI locally on desktop and mobile widths.
2. Complete one authenticated happy path: sign in, onboarding, Career Profile,
   CV upload, provider connection, job analysis, Saved Jobs, Application Kit,
   Settings, and sign out.
3. Confirm the production host contains the required environment variables.
4. Confirm Supabase Site URL and Google OAuth allowlists contain the deployed
   HTTPS origin.
5. Replace the public-beta legal notices with final operator, support,
   jurisdiction, hosting-region, retention, and subprocessor details before a
   general-availability claim.

## Honest launch language

Until the deployed happy path is verified, describe Waypoint as a completed
full-stack project or public-beta candidate. After deployment verification it
may be described as a working public beta. Do not claim production scale,
security certification, real-user outcomes, or employment outcomes without
evidence.

For the full feature inventory, architecture, launch checklist, and LinkedIn
content, see `docs/LINKEDIN_PROJECT_ANALYSIS.md`.
