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
single-user prototype, server-side code should use one configured
`prototype_users.id` and the Supabase service role. Never expose the service
role key to the browser.

For future Supabase Auth support, set `prototype_users.auth_user_id` to the
corresponding `auth.users.id`. The included RLS policies then permit an
authenticated browser/server client to access only that user's rows.

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

## Remote environments

Link the repository to the intended Supabase project, review the target, then
apply migrations:

```sh
supabase link --project-ref <project-ref>
supabase migration list
supabase db push
```

Create the fixed prototype user after deployment from a trusted server or SQL
admin session, retain its generated `id` as server-only configuration, and do
not commit that identifier or any Supabase keys. A later auth rollout only
needs to link `auth_user_id`; the owned records and foreign keys remain
unchanged.

The typed-knowledge migration seeds both approved career modes for users that
already exist when it runs. If the fixed prototype user is created after the
migration, application bootstrap must insert `primary-career` and
`temporary-income` rows using the values in the migration. This is deliberate:
the database cannot safely guess which later user is the fixed prototype user.
