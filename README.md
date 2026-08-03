# Waypoint

Waypoint is an evidence-grounded career intelligence workspace. It keeps a
reviewable Master Profile separate from any individual CV, compares that
evidence with a job description, recommends whether to apply, investigate, or
skip, and identifies the strongest stored CV for the application.

The current public-product branch supports multiple isolated user accounts.
Each person signs in with email/password or Google and supplies their own
OpenAI or Groq API key for AI-assisted workflows (BYOK: bring your own key).

## What it does

- Creates a private workspace for every Supabase Auth user.
- Supports email signup, email confirmation, sign in, sign out, password
  recovery, and Google OAuth through Supabase Auth.
- Provides resumable first-run onboarding and AI-provider setup.
- Imports career narratives as proposed, source-backed knowledge for review.
- Maintains confirmed skills, experience, projects, preferences, constraints,
  career modes, evidence, and provenance in a Master Profile.
- Uploads and deterministically parses PDF and DOCX CVs into sections and
  visible claims without treating a CV as the user's complete identity.
- Parses job descriptions into atomic requirements and evaluates them as
  supported, partially supported, unknown, or conflicting.
- Uses deterministic eligibility, scoring, and recommendation rules; AI is
  limited to structured extraction and semantic interpretation.
- Re-scores analyses after knowledge corrections and can re-parse a job when
  its requirements change.
- Ranks ready CVs and explains truthful tailoring opportunities.
- Stores reusable Application Kit answers and contact/application details.
- Exports a user's structured account data and supports account deletion.
- Lets a user validate, replace, or remove an encrypted OpenAI or Groq key.

Missing evidence is represented as uncertainty, not as proof that a user lacks
a capability. AI-derived personal knowledge remains reviewable, and users
should verify every application before submitting it.

## How the intelligence works

```text
source material
  -> deterministic source blocks
  -> bounded AI extraction/interpretation
  -> schema and citation validation
  -> reviewable canonical knowledge
  -> requirement-specific evidence retrieval
  -> deterministic scoring and recommendation
```

AI proposes and interprets; application code owns validation, source IDs,
blockers, scoring thresholds, cache invalidation, and final recommendation
rules. If an AI call fails, supported workflows use an explicitly labelled
deterministic fallback instead of presenting invented semantic results.

## Technology

- Next.js 16 App Router and React 19
- TypeScript, Tailwind CSS, Zod, and Vitest
- Supabase Auth, PostgreSQL, Storage, and Row Level Security (RLS)
- OpenAI and Groq provider adapters
- PDF.js and Mammoth for PDF/DOCX extraction

The repository follows a layered structure:

- `src/domain` — entities and deterministic decision rules
- `src/application` — provider-independent use cases and ports
- `src/infrastructure` — Supabase, AI-provider, identity, and document adapters
- `src/app` and `src/components` — pages, route handlers, and UI
- `supabase/migrations` — forward-only schema, function, and policy changes

## Local setup

Requirements:

- Node.js 22 or newer
- npm
- A Supabase project, or Supabase CLI plus Docker for a local database

Install dependencies and create a local environment file:

```bash
npm install
cp .env.example .env.local
```

Set the Supabase URL, publishable key, and server-only service-role key. Then
generate the server-side credential-encryption key:

```bash
openssl rand -base64 32
```

Put the generated value into the JSON keyring in `.env.local`:

```dotenv
AI_CREDENTIAL_ENCRYPTION_KEY_VERSION=v1
AI_CREDENTIAL_ENCRYPTION_KEYS={"v1":"YOUR_BASE64_32_BYTE_KEY"}
```

Keep the JSON on one line. Do not commit `.env.local`, reuse this key as an AI
provider key, or expose either the service-role key or encryption key through a
`NEXT_PUBLIC_` variable.

Apply all migrations before accepting signups:

```bash
supabase start
supabase db reset
```

The repository intentionally does not commit a project-specific
`supabase/config.toml`. Run `supabase init` once before `supabase start` in a
fresh clone, or link the clone directly to a disposable hosted test project.

For a hosted Supabase project, link and push instead. See the
[public deployment guide](docs/deployment/public-deployment.md) for Auth,
Google OAuth, redirect URLs, migrations, encryption-key rotation, and release
checks.

Start the app and open <http://localhost:3000>:

```bash
npm run dev
```

`/api/health` reports configuration presence only and never returns secret
values. Users add their provider key after signup in **Settings → AI provider**;
the deployment does not need to distribute a shared AI key for normal user
workflows. Provider model environment variables still select which supported
models the application invokes.

## Authentication configuration

In Supabase Auth:

1. Set the Site URL for the environment.
2. Allow the local, preview, and production callback URLs documented in the
   [deployment guide](docs/deployment/public-deployment.md).
3. Enable email/password authentication and decide whether email confirmation
   is required.
4. Configure the Google provider with a Google OAuth web client, then add the
   Supabase provider callback URL to Google's authorized redirect URIs.

The database trigger provisions one application identity, onboarding record,
usage limits, and two neutral career modes for every new Auth user. Normal
application queries use the authenticated request-scoped client so RLS remains
the primary tenant boundary.

## BYOK security boundary

- Only official OpenAI and Groq endpoints are supported; users cannot supply a
  custom base URL.
- The browser submits a key over HTTPS and never receives a saved key back.
- The server validates it, encrypts it with AES-256-GCM, and authenticates the
  ciphertext to the user ID and provider.
- PostgreSQL stores the encrypted envelope and masked metadata, not plaintext.
- The server decrypts a key only for that user's provider request.
- Keys are not included in user exports, URLs, client storage, or responses.
- Removing a credential deletes its encrypted database record.
- Relevant CV, career, or job text is sent to the provider selected by the
  user. Provider billing, retention, and rate limits remain governed by that
  user's provider account and terms.

The deployment service-role key and credential-encryption key are powerful
server secrets. Anyone who controls both the application database and the
active encryption key can decrypt saved provider keys; protect deployment
access, logs, backups, and secret-manager permissions accordingly. See the
[security contract](docs/security/public-multi-user-threat-model.md).

## Verification

Run the full repository quality gate:

```bash
npm run typecheck
npm run lint
npm test
npm run test:integration # disposable migrated Supabase project required
npm run test:e2e
npm run build
```

The production build does not initialize PDF.js. It is lazy-loaded only for an
actual PDF upload, and the unit suite exercises that real parser path. Run on
Node.js 22 or newer so PDF.js can load its native canvas compatibility layer;
PDF and DOCX extraction must still be smoke-tested in the deployment runtime.

## Deployment and project documentation

- [Public deployment guide](docs/deployment/public-deployment.md)
- [Supabase schema and migration notes](supabase/README.md)
- [Public multi-user threat model](docs/security/public-multi-user-threat-model.md)
- [Architecture overview](docs/architecture/README.md)
- [Project analysis](docs/LINKEDIN_PROJECT_ANALYSIS.md)

The files under `docs/handover`, older architecture decisions, and the personal
Auth setup document describe earlier milestones or migration history. They are
retained for design provenance and are not the current public deployment guide.
