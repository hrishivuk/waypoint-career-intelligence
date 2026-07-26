# Trusted Knowledge Projection Design

**Status:** Approved implementation boundary  
**Input:** Reviewed Waypoint Handover v1.1 candidates  
**Output:** Typed, owner-scoped trusted knowledge

## Review acceptance and projection are separate

Review records preserve the exact imported candidate, any corrected record, the
user's decision, provenance, and revision history. Review acceptance does not
itself write to the typed career-knowledge tables.

Projection is a later deterministic application step. It selects only accepted
candidates, validates their effective records and dependencies again, and maps
them into the existing typed knowledge model. A successful projection may be
used by career workflows; a reviewed candidate that has not projected remains
audit data only.

- `pending` candidates are never projected.
- `rejected` candidates are retained for audit and never projected.
- `confirmed` candidates project their exact imported record.
- `corrected` candidates project their validated corrected record.
- Projection status does not rewrite review status.

The review API may expose an optional projection status such as `pending`,
`projected`, `blocked`, `failed`, or `not_applicable`. This is presentation
metadata, not another trust decision.

## Corrected-record precedence

For a `corrected` decision, the corrected record is the sole effective
projection input. The original remains immutable evidence of what was imported
but cannot contribute fields, fill omissions, or override the correction.

The correction must preserve the stable record ID, record type, and proposed
source lifecycle required by the handover contract. Projection assigns the
trusted lifecycle appropriate to the destination only after the correction has
passed review and projection validation. A changed correction creates a new
review revision and therefore a new projection attempt.

## Validation and dependency order

Projection rechecks ownership, review revision, accepted status, v1.1 schema,
typed references, criticality, and temporal metadata. It does not rely solely
on validation performed when the file was staged.

Within an accepted import, project dependency roots before dependants:

1. reconcile seeded career modes by stable ID;
2. project independent skills, top-level evidence, and CV artefacts;
3. project child evidence and capability assessments after their referenced
   skills/evidence;
4. project preferences, temporary state, working style, and stable facts;
5. project policies after mode and CV references resolve;
6. project historical observations and uncertainties after their related
   records resolve.

Dependency order is determined from typed references, not trusted from source
order. Missing, wrong-type, cyclic, or cross-owner references block the
affected projection and are reported; they are never silently removed.
Confirmed seeded modes are reconciled rather than duplicated or downgraded.

## Atomicity and idempotency

The projection identity is owner, staged candidate ID, accepted review
revision, and projection-schema version. Repeating the same projection returns
the recorded result without creating duplicate typed records.

Each accepted import should project in one transaction when its records form
one dependency graph. A validation, reference, concurrency, or persistence
failure rolls back that transaction. Retrying is safe. A later review revision
does not mutate an earlier projection silently; it requires an explicit,
auditable supersession or correction path.

Stable handover IDs support reconciliation, but never authorize overwriting a
confirmed record. Existing trusted knowledge retains its lifecycle unless a
separate approved transition explicitly supersedes it.

## Critical uncertainty behavior

Reviewing a critical record does not erase its uncertainty:

- A critical eligibility or constraint record with missing factual validity,
  expired validity, or overdue review cannot establish eligibility.
- Its associated uncertainty is projected and remains visible.
- Career decisions that depend on it must return `investigate` until the
  critical information is confirmed and current.
- A critical uncertainty is never converted into a positive fact, inferred
  expiry, or hard blocker without supported evidence.
- Normal and important staleness retain the warning and confidence behavior
  defined by the v1.1 contract.

Projection preserves source precision, provenance, criticality, and temporal
metadata exactly; it does not enrich them through AI.

## Failure reporting

Projection records a stable outcome per candidate/import: projected target,
blocked dependency, validation failure, conflict, or persistence failure.
Reports identify record IDs and safe reasons without logging sensitive record
content. A failed or blocked projection remains retryable after its underlying
review or dependency is corrected.

## Explicit exclusions

Projection does not:

- review, confirm, reject, or correct candidates;
- provide review UI or bulk-confirmation behavior;
- reinterpret prose, call an AI model, or repair invalid records;
- infer missing dates, CV artefacts, capabilities, preferences, or policies;
- activate or automatically switch career modes;
- overwrite or downgrade existing confirmed knowledge;
- run job analysis, CV selection, writing, coaching, or embeddings;
- treat projection success as permission for external actions.

These remain separate workflows with their own authorization and acceptance
criteria.
