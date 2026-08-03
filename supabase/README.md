# Supabase database

The migrations create the career-coach data model, ownership-aware RLS, and the
private `career-documents` Storage bucket. The second, forward-only migration
adds typed personal knowledge and mode-aware analysis without replacing the
original profile facts or analysis tables.

## Typed personal knowledge

New workflows should use:

- `career_modes` for the explicitly selected primary or temporary-income mode;
- `typed_preferences`, `decision_policies`, `evidence_records`, `skills`, and
  `capability_assessments` for reviewable personal knowledge;
- `temporary_states` only for expiring context and
  `historical_observations` for inactive history;
- `mode_aware_analyses` and `mode_aware_analysis_axes` for the revised
  multi-axis result; and
- the evidence/CV junction tables for factual citations and CV coverage.

All newly imported knowledge starts as `proposed`. Only `confirmed` knowledge
may influence decisions or support application claims. `rejected`,
`superseded`, and `stale` records remain stored but inactive. Application
queries must also apply validity, review, and mode scope.

## Identity model

Every application record belongs to a row in `prototype_users`. During the
public multi-user rollout, every new `auth.users` row automatically creates and
links one `prototype_users` row plus neutral `primary-career` and
`temporary-income` modes. Existing linked identities are preserved and existing
unlinked prototype identities are not guessed or overwritten. An authenticated
session can safely retry provisioning with
`bootstrap_current_waypoint_user()`; it can only bootstrap `auth.uid()`.

Deleting an Auth user cascades through its linked application identity and all
owned application rows. Account-deletion code must remove private Storage
objects first because database foreign keys do not delete Storage objects.

Normal application access should use the authenticated user's request-scoped
Supabase client so the included RLS policies enforce ownership. Reserve the
service role for narrow administrative operations and never expose its key to
the browser.

### AI credentials, onboarding, and usage

`user_ai_provider_credentials` stores only an opaque encrypted secret envelope,
its encryption-key version, and non-secret masked/fingerprint metadata. Browser
roles have no table privileges even though owner RLS is enabled as a second
boundary. Trusted server routes perform credential operations and must return
only provider, mask, verification state, and timestamps—never
`encrypted_secret`.

Every application identity also receives a resumable `user_onboarding_state`
row and conservative `user_usage_limits`. Users can read their own limits and
UTC daily usage, while only trusted server code can mutate quotas or counters.
The default public-beta limits are 25 AI requests, 5 imports, and 10 uploads per
day, 100 MiB storage, and 2 concurrent AI requests. Adjust them through an
audited server/admin operation rather than a browser write.

Each provider call acquires an expiring row in `ai_request_leases` under a
transactional per-user lock. Calls release their lease in `finally`; abandoned
leases expire and are reclaimed on the next acquisition. Browser roles have no
access to the lease table or its acquire/release functions.

Storage object names must use this layout:

```text
<prototype_user_id>/<document_id>/<safe_filename>
```

The first path segment is used by Storage RLS.

## Local development

With the Supabase CLI installed and Docker running:

```sh
supabase start
supabase db reset
```

`db reset` recreates the local database and applies every file in
`supabase/migrations` in timestamp order.

To inspect pending migration changes without applying them remotely:

```sh
supabase migration list
supabase db lint
```

### Destructive two-user isolation test

After migrating a disposable local or hosted test project, set the four
`SUPABASE_TEST_*` variables described in `.env.example`, including the explicit
mutation opt-in, and run `npm run test:integration`. The suite creates two
confirmed Auth users and verifies owner/foreign select, insert, update, delete,
cross-tenant relationship, Storage upload, and signed-URL behavior through
their real sessions. It deletes both Auth users in cleanup. Never point this
suite at production.

The GitHub integration job is enabled only when the repository/environment
variable `RUN_SUPABASE_INTEGRATION` is set to `true` and the three test-project
secrets are configured. This keeps pull requests from forks safe while making
the destructive gate explicit for release branches.

## Remote environments

Link the repository to the intended Supabase project, review the target, then
apply migrations:

```sh
supabase link --project-ref <project-ref>
supabase migration list
supabase db push
```

Do not commit user identifiers or any Supabase keys. Deploy the provisioning
migration before enabling public signup so every new account has its application
identity before the first authenticated request. The migration backfills all
existing Auth users; any intentionally unlinked legacy prototype identity is
left untouched for an explicit, audited migration decision.
