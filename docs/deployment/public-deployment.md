# Public multi-user deployment

This is the current deployment guide for Waypoint's public, multi-user BYOK
product. Complete it separately for local, preview/staging, and production
environments. Never share projects, secrets, callback allowlists, or test user
data between staging and production.

## 1. Prerequisites

- Node.js 20.19 or newer (Node.js 22 LTS recommended)
- A hosting platform that supports Next.js 16 server routes
- A Supabase project with Auth, PostgreSQL, and Storage
- A Google Cloud project if Google sign-in will be enabled
- A deployment secret manager
- Supabase CLI for migration inspection and deployment

OpenAI and Groq deployment keys are not required for normal BYOK workflows.
Each user supplies and pays for their own provider credential. Model names are
still selected by deployment configuration, so validate that every configured
model is available to the corresponding users before launch.

## 2. Environment variables

Start from `.env.example` and configure these values in the hosting platform's
server environment:

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe | Supabase project URL used by Auth clients. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Supabase publishable/anon key; RLS must protect data. |
| `SUPABASE_URL` | Server only | Supabase URL used by elevated server operations. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Bypasses RLS; restrict to narrowly scoped server operations. |
| `AI_CREDENTIAL_ENCRYPTION_KEY_VERSION` | Server only | Active keyring version, for example `v1`. |
| `AI_CREDENTIAL_ENCRYPTION_KEYS` | Server only | One-line JSON object of versioned base64 AES keys. |
| `OPENAI_MODEL` | Server only | Default model used with a user's OpenAI key; defaults in code if omitted. |
| `GROQ_MODEL` | Server only | Default model used with a user's Groq key. |
| `GROQ_CV_EXTRACTION_MODEL` | Server only | Optional Groq task override. |
| `GROQ_JD_PARSING_MODEL` | Server only | Optional Groq task override. |
| `GROQ_JOB_MATCHING_MODEL` | Server only | Optional Groq task override. |

`OPENAI_API_KEY`, `GROQ_API_KEY`, and `AI_PROVIDER` remain available to legacy
provider-adapter paths and development tests, but the authenticated public
workflows resolve a saved credential for the current user. Do not configure a
shared production provider key as an undocumented fallback for public users.

Generate an encryption key locally, then copy only its output into the secret
manager:

```bash
openssl rand -base64 32
```

Configure the keyring as one-line valid JSON:

```dotenv
AI_CREDENTIAL_ENCRYPTION_KEY_VERSION=v1
AI_CREDENTIAL_ENCRYPTION_KEYS={"v1":"BASE64_OUTPUT_FROM_OPENSSL"}
```

The decoded key must be exactly 32 bytes. Preserve old keys during rotation:

```dotenv
AI_CREDENTIAL_ENCRYPTION_KEY_VERSION=v2
AI_CREDENTIAL_ENCRYPTION_KEYS={"v1":"OLD_BASE64_KEY","v2":"NEW_BASE64_KEY"}
```

Changing the active version causes newly saved/replaced credentials to use the
new key. Do not remove `v1` until every `v1` database credential has been
re-encrypted or deleted and rollback/backups no longer require it. Losing an
in-use key makes its credentials unrecoverable; exposing it requires credential
rotation by affected users.

Never:

- prefix a service-role, AI-provider, or encryption key with `NEXT_PUBLIC_`;
- commit environment files or paste secrets into issues, logs, or screenshots;
- log authorization headers, cookies, request bodies, CV text, job text,
  encrypted envelopes, or raw provider errors; or
- place provider keys in URLs, analytics events, browser storage, or exports.

## 3. Apply Supabase migrations

For local development with Docker running:

```bash
supabase start
supabase db reset
supabase db lint
```

For a hosted environment, confirm the target project before applying anything:

```bash
supabase link --project-ref <project-ref>
supabase migration list
supabase db push
supabase db lint
```

Apply the account-provisioning, credential/onboarding/usage, and atomic usage
limit migrations before public signup is enabled. They:

- provision one `prototype_users` application identity for each Auth user;
- create neutral primary-career and temporary-income modes;
- create resumable onboarding and per-user quota state;
- create encrypted provider-credential storage; and
- expose narrowly scoped bootstrap/usage functions.

`prototype_users` is a retained application-identity table name, not a
single-user mode. Do not rename it during deployment. Review migration output,
RLS policies, function grants, and the private `career-documents` bucket before
accepting traffic.

Test with two accounts. Account A must not be able to select, update, delete,
download, sign, or infer the existence of Account B's records or Storage
objects, including when IDs and request bodies are manually modified.

## 4. Configure email authentication

In Supabase **Authentication → URL Configuration**:

- Set **Site URL** to the canonical production origin.
- Add exact redirect URLs for every approved environment.
- For local development, allow `http://localhost:3000/auth/callback` and
  `http://localhost:3000/reset-password`.
- Add the equivalent HTTPS URLs for staging and production.
- Avoid broad production wildcards. Preview wildcard patterns should be scoped
  to the hosting provider and tested separately.

In **Authentication → Providers → Email**:

- Enable email/password signup.
- Require email confirmation for public production.
- Configure a production SMTP provider, sender identity, and branded templates.
- Ensure confirmation and recovery templates preserve the Supabase confirmation
  URL and return users to the allowlisted Waypoint origin.
- Set sensible email-send and Auth rate limits.

Test signup, duplicate signup behavior, confirmation, resend, sign in, sign out,
forgot password, reset password, expired links, and expired sessions. Public
errors should not reveal whether an email address is registered.

## 5. Configure Google OAuth

1. In Google Cloud, configure the OAuth consent screen and required branding,
   support email, privacy-policy URL, terms URL, and authorized domains.
2. Create an **OAuth 2.0 Client ID → Web application**.
3. Add each Waypoint web origin under **Authorized JavaScript origins**.
4. Copy the exact Supabase Google provider callback URL into Google's
   **Authorized redirect URIs**. Supabase displays this callback in the Google
   provider configuration; it is normally of the form
   `https://<project-ref>.supabase.co/auth/v1/callback`.
5. Add the Google client ID and secret in Supabase
   **Authentication → Providers → Google** and enable the provider.
6. Keep Waypoint's own `/auth/callback` URL in the Supabase redirect allowlist;
   Waypoint exchanges the PKCE code there and accepts only a local, validated
   post-login destination.

Use separate OAuth clients for local/staging and production where practical.
Test first-time Google signup, returning sign-in, an existing email identity,
consent denial, callback failure, logout, and a disabled/deleted account.

## 6. Storage and upload checks

The `career-documents` bucket must remain private. Object names follow:

```text
<application_user_id>/<document_id>/<safe_filename>
```

Before launch, verify ownership policies for upload, list, signed download, and
delete. Exercise file-size, format, empty-document, malformed PDF, and malformed
DOCX failures. Confirm failed operations clean up partial database and Storage
artifacts. Public deployment also requires an explicit malware-scanning risk
decision for stored user uploads.

## 7. BYOK behavior to verify

For both OpenAI and Groq:

1. Create a user and open **Settings → AI provider**.
2. Submit an invalid key and confirm the UI returns a sanitized error.
3. Submit a valid key and confirm only masked status and verification time are
   returned.
4. Use narrative import, CV extraction where applicable, job parsing, and job
   matching.
5. Exercise quota, provider-rate-limit, unavailable-model, timeout, and invalid
   structured-output paths.
6. Replace the key and prove the previous credential no longer works through
   the application.
7. Delete it and prove provider-backed work requires a key again.
8. Confirm browser responses, logs, analytics, error monitoring, database
   exports, and user exports never contain plaintext credentials.

When AI-assisted work runs, only the bounded career/profile, CV, or job content
needed for that task should be sent to the selected provider. Waypoint cannot
import a user's ChatGPT conversations, memories, subscription, or billing. A
ChatGPT subscription is not an OpenAI API account or API credit.

## 8. Build and runtime validation

Run from a clean checkout against a non-production environment:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Smoke-test at least:

- public landing, signup, email confirmation, email sign-in, and Google sign-in;
- onboarding, provider-key save/replace/delete, and session expiry;
- profile import/review, knowledge editing, and career-mode data;
- PDF/DOCX upload, parsing, listing, download where available, and deletion;
- job parse, deterministic fallback, semantic matching, correction, re-score,
  re-parse, CV selection, and Application Kit;
- data export and account deletion; and
- desktop/mobile keyboard navigation, focus, labels, errors, and empty states.

### Known PDF.js warning

The Next.js production build can emit non-fatal server-side PDF.js warnings
about `DOMMatrix`, `ImageData`, and `Path2D` polyfills. A successful build does
not prove document extraction works in the hosting runtime. Upload and parse
representative, fictional PDFs and DOCX files in staging and production. Track
the warning as unresolved until the runtime behavior and an appropriate
polyfill or PDF.js loading strategy have been explicitly verified.

## 9. Production controls

Before public traffic:

- enforce HTTPS, secure cookies, security headers, and a restrictive CSP;
- configure privacy-safe error monitoring, uptime checks, and provider failure
  and latency metrics;
- enable database backups/PITR appropriate to the project and rehearse restore;
- set per-user and authentication rate limits, concurrency limits, upload
  limits, and provider timeouts;
- enable dependency, secret, and migration scanning in CI;
- publish a privacy policy, terms, AI/career-advice disclaimer, retention
  policy, and support contact;
- document an encryption-key compromise and rotation procedure;
- audit the repository and Git history for secrets and personal CV/profile data;
  and
- rehearse migration and application rollback against staging.

## 10. Release gate

Do not enable public signup until two brand-new accounts can independently:

- sign up and confirm email;
- sign in with Google;
- resume and complete onboarding;
- validate, save, replace, and remove their own OpenAI or Groq key;
- create/review knowledge and upload/delete a CV;
- analyse, correct, and re-score a job;
- export their data and delete their account; and
- sign out, return, and restore a valid session.

Automated and manual tests must prove neither account can access the other's
database rows, files, signed URLs, provider credentials, exports, or account
actions. Record the tested commit, migration list, environment, and results in
the release notes.
