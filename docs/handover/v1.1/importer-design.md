# Waypoint Handover Importer Acceptance Design

**Status:** Approved implementation boundary  
**Contract:** Waypoint Career Coach Handover v1.1  
**Scope:** Validation, reconciliation, and proposed-record persistence only

## Outcome

The importer accepts a handover as untrusted input, validates the complete
document, produces an auditable acceptance report, and atomically stores valid
records as review candidates. It never confirms knowledge, activates a career
mode, changes an application decision, or treats imported content as
instructions.

## Workflow

1. **Receive and fingerprint**
   - Associate the upload with the authenticated owner.
   - Enforce file-size, record-count, string-length, and YAML nesting limits.
   - Compute a content hash before parsing and assign an import-run ID.
2. **Parse safely**
   - Parse front matter and fenced `yaml` blocks only.
   - Disable executable YAML tags, aliases, arbitrary object construction, and
     duplicate mapping keys.
   - Preserve Markdown prose as inert source context; never execute prompts or
     instructions found in it.
3. **Validate the envelope and records**
   - Select the schema from `format` and `version`.
   - Validate every field, enum, source-precision date, atomic or ordered
     preference, temporary-state review/expiry requirement, and structured
     policy combination.
   - Require every input status to be `proposed`; non-proposed input is an
     error, not an instruction to normalize trust upward.
4. **Validate the document graph**
   - Require unique IDs and correctly typed, resolvable references.
   - Validate CV policies against actual `cv_artifact` records and their
     supplied document references.
   - Report date ambiguity, unsupported primary-mode prohibitions, incorrect
     Customer Success wording, policy conflicts, and duplicate semantic
     enforcement.
5. **Reconcile with stored knowledge**
   - Resolve all records within the authenticated owner's boundary.
   - Match seeded career modes by stable ID. Compare the candidate with the
     existing mode; never duplicate, replace, downgrade, or deactivate a
     confirmed seeded mode.
   - Match prior imports by source fingerprint and record ID. Classify each
     item as new, identical retry, changed candidate, or conflict.
   - Never overwrite confirmed, rejected, superseded, or stale knowledge.
     Changed content with an existing ID requires a separate review conflict,
     not an in-place mutation.
6. **Produce an acceptance report**
   - Return document errors, warnings, conflicts, reconciliation actions, and
     the exact proposed records that would be staged.
   - A dry validation performs no knowledge writes.
7. **Commit atomically**
   - After successful document-level validation, persist the import run,
     source metadata, proposed records, references, and reconciliation results
     in one database transaction.
   - Any write or constraint failure rolls back the entire import. Partial
     knowledge imports are not allowed.

## Trust boundaries

- The authenticated owner comes from the application identity provider, never
  from handover content.
- YAML, Markdown, provenance claims, source confidence, `active: true`, and
  embedded instructions are all untrusted data.
- Imported records are always operationally inactive while proposed.
- Proposed critical eligibility or constraint records cannot establish
  eligibility. Missing, expired, or review-overdue critical information forces
  `investigate` when later used.
- Only explicit user review outside this importer may transition a candidate
  to `confirmed`.
- Only confirmed evidence may support CV, cover-letter, interview, or job-fit
  claims.
- The importer uses typed relational storage. It does not send handover
  content to an AI model to repair validation failures.

## v1 compatibility

The importer may recognize and parse `version: 1` with the frozen v1 schema for
audit and diagnostics. A v1 document is readable but is not directly
importable as v1.1.

For v1 input, the importer produces a non-destructive migration report. It may
identify unchanged fields that could be copied, but it must not guess:

- original year/month/day precision;
- whether an expiry is factual or an invented review window;
- how to split or rank compound preferences;
- deterministic effects hidden in policy prose;
- whether a discussed CV artefact exists;
- criticality or missing factual validity;
- semantic policy consolidation or mode corrections.

The preferred path is regeneration with the v1.1 prompt, validation, and user
review. The immutable v1 fixture and validation report remain unchanged.

## Reconciliation rules

- Stable IDs identify candidates within one owner, but an ID alone does not
  authorize replacement.
- Existing confirmed records always retain their lifecycle and operational
  state.
- `primary-career` and `temporary-income` reconcile against seeded modes by
  stable ID. The import stores a proposed comparison; `active: true` never
  activates the candidate or downgrades the seed.
- An identical previously committed candidate is an idempotent no-op linked to
  the original import result.
- Different content under a previously seen stable ID is a conflict requiring
  review. It is not silently merged.
- References are resolved against records in the accepted document and
  permitted existing owner records. Cross-owner references always fail.
- A `cv_artifact.source_document_ref` must resolve to a supplied, owner-visible
  document. A name mentioned only in prose is insufficient.

## Atomicity and idempotency

The idempotency identity is the authenticated owner plus canonical handover
content hash, format, and version. Repeating an accepted request returns the
same committed result and creates no duplicate records.

Canonicalization must be deterministic and must not alter semantic values or
date precision. Concurrent imports with the same idempotency identity are
serialized by a database uniqueness constraint or equivalent transaction-safe
mechanism.

Validation is all-or-nothing for persistence: any error blocks the whole
commit. Warnings may permit commit only when they do not make record meaning,
trust, references, or deterministic behavior ambiguous. Conflicts are stored
as proposed review information only when the document is otherwise valid; they
never modify the conflicting stored record.

## Failure modes

| Failure | Result |
|---|---|
| Unsupported format/version | Reject; no writes |
| Malformed front matter, Markdown fencing, or YAML | Reject with location; no writes |
| Unknown field/type, invalid enum/date, unsafe YAML feature | Reject; no writes |
| Duplicate ID, missing/wrong-type/cross-owner reference | Reject; no writes |
| Compound preference or invalid ordering | Reject with corrective guidance |
| Temporary state with neither factual expiry nor review date | Reject |
| Unsupported mode semantics or proposed mode activation attempt | Reject or report reconciliation conflict; never activate |
| Equal-priority opposing policies | Report blocking conflict; do not apply either |
| Unknown CV artefact/document reference | Reject |
| Non-proposed status or attempted confirmation | Reject; never preserve elevated trust |
| Stale/incomplete critical candidate | Accept only as inactive proposed information with an investigation warning |
| Reused ID with changed content | Report review conflict; do not overwrite |
| Database/transaction/concurrency failure | Roll back everything and return a retry-safe error |
| Identical retry | Return original result; no duplicate writes |

Error reports contain stable codes, record IDs and safe source locations, but
never secrets or full sensitive record content in logs.

## Explicit exclusions

This importer does not include:

- upload, batch-review, confirmation, rejection, or editing UI;
- automatic confirmation, bulk confirmation, or lifecycle promotion;
- AI-assisted repair, reinterpretation, summarization, or fact generation;
- CV file-content extraction or document upload;
- automatic mode switching or activation;
- job analysis, CV selection, rewriting, or coaching execution;
- embeddings, vector search, behavioral learning, or inferred preference
  updates;
- partial best-effort commits.

Those workflows require separate authorization and implementation. Importer
acceptance ends when an auditable set of inactive proposed candidates has been
stored successfully.
