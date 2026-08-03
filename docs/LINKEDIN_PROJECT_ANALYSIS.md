# Waypoint — complete project analysis and LinkedIn launch plan

**Current branch:** `feat/ui-ux-redesign`<br>
**Product status:** public-beta feature set and core UI redesign complete;
production hosting and deployed-environment validation still pending.<br>
**Claim discipline:** do not call the product production-ready or publicly
launched until every P0 launch check below has evidence.

## 1. Executive summary

Waypoint is a private-by-default, multi-user career intelligence application.
It helps a person build a reviewable evidence base of career facts, keep that
evidence separate from role-specific CVs, compare it with a job description,
and prepare a truthful application.

The core product insight is that a CV is not the user. A CV is a selective
presentation for one purpose; the Master Profile is the longer-lived source of
confirmed career knowledge. Missing evidence is treated as uncertainty rather
than proof that a person lacks a skill.

Waypoint combines deterministic rules with bounded AI assistance. AI extracts
and interprets structured information. Application code validates schemas and
citations, owns scoring and blocker rules, selects fallbacks, and keeps
AI-derived personal facts reviewable.

## 2. Complete user journey

1. A visitor reads the public landing page and creates an account.
2. They use email/password or Google OAuth. Email confirmation, resend,
   password recovery, reset, session refresh, and logout are supported.
3. Supabase automatically provisions a private application identity, neutral
   career modes, onboarding state, and usage limits.
4. Onboarding explains AI data processing. The user accepts consent and chooses
   OpenAI or Groq.
5. The user validates and saves their own provider key. The saved plaintext key
   is never returned to the browser.
6. They add career facts manually or import a career narrative. Imported facts
   remain proposed until reviewed.
7. They upload PDF or DOCX CVs. Waypoint validates type/signature/size, extracts
   text, creates sections and claims, and stores the source privately.
8. They paste a job description. Waypoint extracts atomic requirements, finds
   relevant confirmed evidence, evaluates gaps, calculates deterministic
   scores, and produces an apply/investigate/skip recommendation.
9. They can correct requirement criticality, re-score, re-parse, and compare
   stored CVs without fabricating evidence.
10. Application Kit stores reusable personal details and answers. Initial
    values come only from that user's confirmed profile/CV; otherwise fields
    are blank.
11. The user can replace/delete provider keys, export structured account data,
    remove CVs, or permanently delete the account after a recent sign-in and
    typed confirmation.

## 3. Feature inventory

### Public product and authentication

- Public landing, privacy overview, terms overview, loading, error, and 404 UI.
- Email signup, optional confirmation, resend, login, logout, recovery, and
  password reset through Supabase Auth.
- Google OAuth with PKCE and allowlisted post-auth redirects.
- Cookie-backed server sessions and protected-route proxying.
- Automatic idempotent `auth.users` to application-user provisioning.
- Resumable onboarding and explicit AI-processing consent.

### Master Profile and knowledge

- Manual facts with type, confirmation state, tags, confidence, and provenance.
- Career-narrative import into proposed candidates rather than silent truth.
- Confirm/correct/reject review workflow and projection into canonical records.
- Skills, aliases, evidence, assessments, preferences, constraints, career
  modes, temporary states, observations, and uncertainty records.
- Knowledge library, review queues, exception visibility, and insights.
- Confirmed knowledge influences decisions; proposed/rejected/stale knowledge
  remains inspectable but inactive.

### CV workspace

- PDF and DOCX upload with extension, MIME, magic-byte, byte, page, and extracted
  character limits.
- Real PDF.js and Mammoth text extraction plus whitespace/layout normalization.
- Deterministic section and visible-claim parsing.
- Private Supabase Storage paths scoped by application-user ID.
- CV processing status, listing, deletion, cleanup, and storage quota checks.
- Separation between CV claims and the canonical Master Profile.

### Job intelligence

- Job-description normalization and structured atomic requirement extraction.
- Requirement classification and editable criticality.
- Evidence retrieval from confirmed user knowledge.
- Supported, partially supported, unknown, and conflicting assessments.
- Deterministic dimension scores, blocker handling, recommendation thresholds,
  and apply/investigate/skip result.
- Explicit deterministic fallback when semantic inference is unavailable.
- Re-score after corrections and re-parse when requirements change.
- CV ranking with explanations and truthful tailoring opportunities.

### Application Kit

- Editable sections for personal details, links, preferences, reusable answers,
  and job-specific drafts.
- Safe lazy seeding from the current user's confirmed profile and latest CV.
- No creator-specific roles, preferences, or answers in new accounts.
- Source labels distinguish profile, CV, manual, and generated content.

### BYOK AI providers

- OpenAI and Groq through fixed official endpoints; arbitrary base URLs are not
  accepted.
- Validate, save, replace, list masked metadata, and delete a provider key.
- AES-256-GCM encryption with a unique nonce and authenticated binding to user
  ID plus provider.
- Versioned deployment keyring for credential-key rotation.
- Plaintext keys excluded from responses, browser storage, account exports,
  URLs, and database rows.
- Safe provider error categories for invalid credentials, rate limits, timeout,
  model availability, provider availability, and invalid structured output.
- Per-user daily AI/import/upload usage counters, storage allowance, and
  expiring database-backed concurrent-AI request leases.

### Account lifecycle

- Portable ZIP export containing structured JSON and original CV files without
  AI credentials or private storage paths.
- Typed destructive confirmation.
- Recent-sign-in requirement for account deletion.
- Storage cleanup, application-data cascade, encrypted-credential removal, and
  deletion of the Supabase Auth identity.
- Same-origin protection on sensitive mutations.

## 4. Intelligence method

```text
user source material
  → deterministic text blocks and identifiers
  → bounded AI extraction or semantic interpretation
  → Zod/schema, range, source-span, and citation validation
  → proposed reviewable knowledge
  → confirmed canonical evidence
  → requirement-specific retrieval
  → deterministic scoring, blockers, recommendation, and CV ranking
```

AI is used where language ambiguity matters. It does not own authorization,
identity, storage paths, confirmation state, final scoring rules, or account
lifecycle. This makes provider behavior replaceable and keeps critical product
decisions testable without an AI call.

## 5. Public multi-user and security architecture

- Supabase Auth is the identity authority; PostgreSQL uses a separate stable
  application-user ID linked one-to-one to the Auth user.
- Normal requests resolve the authenticated user server-side and use that
  session's request-scoped Supabase client.
- Row Level Security checks ownership for user tables and Storage objects.
- Caller-provided user IDs are never accepted as identity proof.
- Composite foreign keys prevent an Application Kit item from referencing
  another tenant's section and a CV claim from referencing another document's
  section.
- End users can read their identity and edit only its display name; they cannot
  rebind or directly delete it.
- Service-role access is allowlisted for account administration, encrypted
  credential storage, quota mutation, and narrowly scoped privileged RPCs.
- CSP and security headers are configured, secret-bearing endpoints use
  no-store responses, and supported credential endpoints are fixed.

Security is a layered design, not an absolute claim. Hosted migration state,
provider settings, SMTP, redirects, monitoring, backups, and two-user tests must
still be verified in the intended environment.

## 6. Technology and structure

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS
- Supabase Auth, PostgreSQL, Storage, RLS, triggers, and security-definer RPCs
- OpenAI and Groq adapters
- Zod structured-output validation
- PDF.js and Mammoth document extraction
- Vitest unit/security tests and Playwright browser tests
- GitHub Actions quality workflow

Layers:

- `src/domain`: entities, lifecycle semantics, scoring, and decision rules.
- `src/application`: provider-independent use cases and ports.
- `src/infrastructure`: Supabase, Auth, AI, encryption, documents, quotas, and
  account-lifecycle adapters.
- `src/app` and `src/components`: App Router pages, route handlers, and UI.
- `supabase/migrations`: forward-only schema, RLS, Storage, function, and grant
  changes.

## 7. Verification evidence

The final pre-publish run must update this table with its date and commit SHA.

| Gate | Current local evidence | What it proves |
| --- | --- | --- |
| TypeScript | Passing | Compile-time contracts are consistent. |
| ESLint | Passing | Configured static rules pass. |
| Unit/security suite | 215 tests across 37 files passing on 3 August 2026 | Deterministic logic and static security contracts. |
| Real PDF parser test | Passing | Lazy-loaded PDF.js extracts a generated text PDF. |
| Playwright public smoke | 4 Chromium tests passing | Landing, Google account entry, auth/legal pages, and safe health response. |
| Production build | Passing | Next.js compiles and enumerates the intended routes. |
| npm audit | 0 known vulnerabilities at last audit | Registry advisories at that point in time. |
| Two-user Supabase integration | 3 live tests passed on 3 August 2026; cleanup verified | Real JWT database/Storage isolation, atomic analysis updates, rollback safety, and AI concurrency in the linked Supabase project. |
| Google OAuth local flow | Interactive Google signup completed through the hosted provider and returned to Waypoint onboarding on 3 August 2026 | Local client/provider/callback flow is configured; production origins and redirects still require deployed validation. |
| Email/BYOK live flow | Pending | Requires inbox confirmation and low-value provider test keys. |

Passing automated tests do not prove production security, usability, provider
behavior, accessibility, or user outcomes.

## 8. Honest limitations

- No production URL or public-user outcome evidence is recorded yet.
- Database migrations, RLS, private Storage, signed URLs, and AI concurrency
  have been verified with two temporary accounts in the linked hosted project.
  Production Google OAuth, email delivery, and final deployment redirects remain pending.
- The destructive two-user integration suite requires a disposable Supabase
  environment and must never target production.
- OpenAI/Groq cost, retention, availability, and model behavior remain subject
  to the user's provider account and terms.
- The legal pages are implementation overviews, not final legal documents;
  operator identity, contact, retention, hosting region, subprocessors, and
  jurisdiction-specific language are still required.
- Malware scanning for uploaded files needs an explicit launch decision.
- Monitoring, backup restore, accessibility, mobile, and performance checks
  need live-environment evidence.
- `private: true` in `package.json` prevents accidental npm publication; it
  says nothing about GitHub repository visibility or licensing.

## 9. Before posting on LinkedIn

### P0 — required before presenting it as live

- Provision separate staging and production Supabase projects.
- Apply every migration and run database lint/migration inspection.
- Configure email delivery, confirmation, recovery, Google OAuth, site URL, and
  exact local/preview/production redirect allowlists.
- Store the Supabase service role and credential-encryption keyring only in the
  deployment secret manager.
- Run `npm run test:integration` against disposable staging and preserve its
  output as evidence.
- Test two real accounts across database rows, guessed UUIDs, modified bodies,
  Storage paths, signed URLs, RPCs, exports, and deletion.
- Test both provider-key flows with low-value test keys: invalid, valid,
  replace, delete, quota, timeout, and provider error states.
- Upload representative fictional PDF and DOCX files in the deployed Node 22
  runtime and verify parsing plus deletion.
- Complete privacy/terms/operator details, monitoring, backups, and a rollback
  procedure.

### P1 — required for a strong portfolio launch

- Run keyboard, screen-reader, contrast, mobile, empty/error/loading, and slow
  network checks.
- Capture screenshots using fictional data only: landing, onboarding, provider
  settings with masked key, Master Profile, CV workspace, job analysis,
  evidence explanation, and Application Kit.
- Record a 60–90 second demo using a dedicated fictional account and provider
  key; revoke the key after recording.
- Verify repository visibility, license, README links, CI checks, and the exact
  commit deployed.
- Ask several people to complete signup → onboarding → first analysis without
  coaching and record qualitative findings honestly.

## 10. Recommended LinkedIn story

Use this sequence:

1. **Problem:** career context trapped in chats and CV files is hard to inspect,
   trust, or reuse.
2. **Insight:** a CV is a presentation, not a complete professional identity.
3. **Model:** Master Profile → job requirements → evidence assessment → CV
   selection → Application Kit.
4. **AI boundary:** AI interprets language; deterministic code owns validation,
   scoring, blockers, and recommendations.
5. **Public-product challenge:** multi-user Auth, RLS, private Storage, encrypted
   BYOK credentials, consent, quotas, export, and deletion.
6. **Engineering lesson:** tenant isolation must be enforced in the database,
   not only by route filters.
7. **Proof:** link the deployed build, repository, CI run, screenshots, and
   accurate test results.
8. **Honesty:** state what is locally verified and what is live-validated.
9. **CTA:** invite feedback from product engineers, full-stack teams, AI UX
   practitioners, and career-tool builders.

### Draft balanced post

> I built Waypoint, a multi-user career intelligence application designed
> around one idea: your CV is not your full professional identity.
>
> Waypoint keeps a reviewable Master Profile of confirmed evidence, compares it
> with atomic job requirements, explains uncertainty and conflicts, recommends
> whether to apply or investigate, and helps select the strongest truthful CV.
>
> AI handles bounded extraction and semantic interpretation. Deterministic code
> owns schema validation, citations, scoring, blockers, and the final
> recommendation.
>
> Turning the prototype into a public product meant building email and Google
> authentication, per-user onboarding and consent, PostgreSQL RLS, private file
> storage, encrypted OpenAI/Groq bring-your-own-key credentials, quotas, export,
> and account deletion.
>
> The most important engineering lesson was that tenant isolation cannot depend
> on adding `user_id` filters everywhere. It needs request-scoped sessions,
> database policies, ownership-aware relationships, and adversarial two-account
> testing.
>
> [Add verified live URL, repository, final test evidence, and CTA here.]

## 11. Safe and unsafe claims

Safe after the final local gate:

- “Implemented multi-user accounts with Supabase Auth.”
- “Supports email/password and Google OAuth flows.”
- “Encrypts per-user OpenAI/Groq API keys with AES-256-GCM.”
- “Uses request-scoped clients, PostgreSQL RLS, and private Storage policies.”
- “Combines bounded AI interpretation with deterministic scoring.”
- “Includes account export and deletion workflows.”

Only safe after live evidence:

- “Deployed,” “publicly available,” or “production-ready.”
- “Google login works in production.”
- “Tenant isolation is verified end to end.”
- “Secure,” “accessible,” “fast,” or “reliable” without a scoped qualifier and
  supporting test evidence.
- Any user count, outcome, accuracy, conversion, time-saved, or cost claim.

## 12. Prompt for final LinkedIn packaging

> Act as a senior technical portfolio editor and LinkedIn strategist. Treat
> this Waypoint analysis and its linked verification artifacts as the only
> factual source. Do not invent users, metrics, research, production scale,
> security guarantees, or live validation. Ask for my target roles, deployed
> URL, repository URL/visibility, final CI run, screenshots, and tone. Then
> produce: a launch-risk gap check, technical/product/balanced posts, a maximum
> ten-slide carousel, a 60–90 second demo script, screenshot captions, an honest
> AI-assisted-development statement, and a claim-to-evidence checklist.

## 13. Evidence map

- Product overview and setup: `README.md`
- Architecture: `docs/architecture/README.md`
- Public deployment: `docs/deployment/public-deployment.md`
- Security contract: `docs/security/public-multi-user-threat-model.md`
- Database and isolation harness: `supabase/README.md` and `integration/`
- Auth routes: `src/app/api/auth/` and `src/app/auth/`
- BYOK encryption/settings: `src/infrastructure/ai/` and
  `src/app/api/v1/settings/ai-credentials/`
- Deterministic analysis: `src/infrastructure/job-analysis/` and `src/domain/`
- Quality automation: `.github/workflows/quality.yml`, `vitest.config.mts`, and
  `playwright.config.ts`
