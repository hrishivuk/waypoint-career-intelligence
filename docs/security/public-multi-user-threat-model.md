# Public multi-user and BYOK security contract

**Status:** implementation contract  
**Branch:** `feat/public-multi-user-byok`

## Trust boundaries

- The browser is untrusted. It may hold Supabase session state, but it must not
  receive the Supabase secret/service-role key, the credential-encryption key,
  or a previously saved AI-provider key.
- Next.js server routes authenticate the current Supabase user and resolve the
  associated application-user ID before accessing owned data.
- Normal user-data access uses a request-scoped Supabase client carrying that
  user's session so PostgreSQL Row Level Security is enforced.
- Elevated Supabase credentials are reserved for named administration and
  bootstrap operations. An elevated client is never the default repository
  dependency.
- OpenAI and Groq receive only the bounded career material required for the
  requested capability and the user's selected provider credential.

## Tenant invariant

Every protected page, route, repository operation, RPC, and Storage object is
bound to exactly one authenticated application user. A caller-controlled user
ID is never accepted as proof of ownership. Unknown or foreign identifiers
must not reveal whether another user's record exists.

The release gate requires two-user tests for select, insert, update, delete,
RPC execution, file access, signed URLs, guessed UUIDs, and modified request
bodies.

## Authentication contract

- Supabase Auth is the identity authority.
- Email/password and Google OAuth use cookie-backed server-side sessions.
- OAuth uses PKCE and an allowlisted callback destination.
- Creating an Auth user idempotently provisions one application user and its
  required defaults.
- Email verification, resend, password recovery, session expiry, and logout
  are first-class states.
- Authentication endpoints are rate-limited and do not disclose whether an
  email address already exists.

## AI credential contract

- Initial providers are limited to the official OpenAI and Groq endpoints.
- Arbitrary provider base URLs are prohibited.
- Keys are accepted only in HTTPS request bodies and never in URLs.
- A saved key is encrypted on the server with AES-256-GCM using a unique nonce.
- The authenticated application-user ID and provider are authenticated as
  additional data, preventing ciphertext from being reassigned to another
  user or provider.
- The key-encryption key is versioned and supplied by the deployment secret
  manager. It is never stored in PostgreSQL or exposed to the browser.
- The database stores ciphertext, nonce, authentication tag, key version,
  provider, a non-secret fingerprint suffix, and lifecycle timestamps.
- Saved keys are never returned or revealed. Users may test, replace, or
  delete them.
- Replacement is atomic. Deletion removes ciphertext and associated metadata.
- Data exports and backups intended for users exclude provider credentials.
- Logs redact keys, tokens, authorization headers, cookies, CV text, career
  narratives, job descriptions, ciphertext, and raw provider objects.

## AI execution contract

- Provider and model selection is resolved after authenticating the actor.
- Provider failures map to safe categories: invalid credential, quota/rate
  limit, unsupported model, timeout, unavailable provider, and invalid output.
- Raw SDK errors are not returned to clients.
- Calls have input limits, output limits, timeouts, bounded retries, per-user
  concurrency controls, and idempotency where a workflow can fan out.
- Cache identity includes actor, provider, model, prompt/schema/engine version,
  input hash, and knowledge fingerprint. It excludes key material and key
  fingerprints.
- Deterministic fallback remains visibly labelled and never pretends semantic
  inference completed.

## Upload contract

- CV uploads have byte, page, and extracted-text limits.
- Extension, declared MIME type, and file signature must agree.
- Filenames are sanitised and never used as an authorization boundary.
- Storage paths begin with the resolved application-user ID.
- Failed and partial operations clean up database and Storage artifacts.
- Download links are short-lived and owner-scoped.
- Public launch requires a decision on malware scanning for stored uploads.

## Account lifecycle

- Users can export their structured data and source documents without secrets.
- Destructive account deletion requires recent authentication and explicit
  confirmation.
- Deletion removes Storage objects, encrypted provider credentials,
  application records, and finally the Auth identity.
- The workflow is idempotent and records only non-sensitive operational status
  so interrupted deletion can be retried safely.

## Operational requirements

- Separate local, preview/staging, and production environments.
- CI runs migrations, type checking, linting, unit/integration tests, browser
  tests, dependency auditing, and secret scanning.
- Production uses HTTPS, security headers, a restrictive Content Security
  Policy, redacted structured logs, error monitoring, rate-limit telemetry,
  database backups, and a rehearsed rollback procedure.
