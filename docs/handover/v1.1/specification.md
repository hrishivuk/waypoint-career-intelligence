# Waypoint Career Coach Handover v1.1

**Status:** Approved documentation contract  
**Supersedes for new generation:** v1  
**Architecture:** Unchanged

## Purpose

This format transfers career knowledge into Waypoint as review candidates. It
is human-readable and machine-parseable; it is not trusted memory. Only
separate fenced `yaml` mappings are importable. Markdown prose is review
context only.

v1.1 is a narrow correction to v1 based on the immutable v1 validation
fixture. It adds source-date precision, safe temporary-state review dates,
scoreable preferences, structured policy effects, CV artefacts, and explicit
criticality. It does not change the frozen architecture or start importer
development.

## Document envelope

```yaml
---
format: waypoint-career-handover
version: "1.1"
generated_at: 2026-07-24T15:00:00Z
subject: user
generator: ChatGPT
---
```

- `format` is exactly `waypoint-career-handover`.
- `version` is the string `"1.1"`.
- `generated_at` is an exact ISO 8601 timestamp and does not use the partial
  date structure below.
- `subject` is exactly `user`; names and email addresses are omitted.
- `generator` is required free text.
- Each record block contains exactly one mapping.
- Unknown record types or fields are errors.
- Empty optional fields are omitted.

## Shared fields

Every record requires:

```yaml
type: preference
id: preference-company-stage-startup
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chatgpt_handover
  source_ref: dated career-summary conversation
  basis: inferred
```

- `id`: unique, stable, lowercase kebab-case.
- `status`: exactly `proposed` in a handover.
- `confidence`: `low`, `medium`, or `high`; confidence is not trust.
- `criticality`: `normal`, `important`, or `critical`.
- `provenance.source_type`: `chatgpt_handover`, `chat`, `cv`, `portfolio`,
  `user_statement`, or `other`.
- `provenance.source_ref`: concise, non-secret, and as resolvable as practical.
- `provenance.basis`: `explicitly_stated`, `inferred`, `documented`, or
  `mixed`.

Optional shared fields are `mode`, `valid_from`, `valid_until`,
`last_confirmed_at`, `review_after`, and `tags`. `mode` is `primary-career` or
`temporary-income`. Tags are unique lowercase kebab-case values.

### Source-precision dates

All record date fields use:

```yaml
start_date:
  value: 2025-05
  precision: month
```

Allowed pairs:

| `precision` | `value` format | Example |
|---|---|---|
| `year` | `YYYY` | `2024` |
| `month` | `YYYY-MM` | `2024-09` |
| `day` | `YYYY-MM-DD` | `2024-09-16` |

This applies to lifecycle dates and record-specific dates, including
`valid_from`, `valid_until`, `last_confirmed_at`, `review_after`,
`start_date`, `end_date`, `assessment_date`, `observed_at`, and
`last_reviewed_at`. Values must be real calendar dates at their stated
precision. Value and precision must agree exactly.

A partial source date must never be normalized to the first or last day of its
period. Date comparisons use only shared precision; a validator must not claim
an ordering violation when partial ranges overlap ambiguously. It should
instead request review. `generated_at` is the sole exact timestamp exception.

### Criticality and staleness

- `normal`: staleness shows a warning.
- `important`: staleness requests review and reduces decision confidence.
- `critical`: proposed, incomplete, expired, or review-overdue information
  cannot establish eligibility and forces `investigate` when relevant.
- A confirmed critical record without factual validity must be reconfirmed
  when its validity matters.
- Not every fact is critical. Work authorisation, visa validity, decisive
  location restrictions, and availability are typical critical records.

Lifecycle status dominates operational flags. A proposed record never becomes
operational merely because it contains `active: true`.

## Record types

### `stable_fact`

Required: `category`, `statement`.

Optional: `evidence_refs`.

`category`: `education`, `employment`, `eligibility`, `career_goal`,
`interest`, `technology`, or `other`.

Eligibility facts that affect whether a role can be accepted use
`criticality: critical` and factual validity when known. Missing validity is
represented by an `uncertainty`; it must not be invented.

### `career_mode`

Required: `name`, `purpose`, `priority`, `target_role_families`,
`prohibited_role_families`.

Optional: `active`, `start_date`, `end_date`.

Target items contain `role` and positive integer `priority`. Imported
`primary-career` and `temporary-income` modes reconcile by stable ID with
existing seeded modes. They do not create duplicates or downgrade confirmed
records. Proposed modes remain operationally inactive.

The primary mode contains only its approved ordered targets; it gains no
prohibited family without explicit authority. Temporary Customer Success is
exactly `Non-sales Customer Success`.

### `preference`

Required: `subject`, exactly one of `value` or `ordered_values`, `strength`,
`reason`.

Optional: `exceptions`.

`strength`: `required`, `strongly_preferred`, `preferred`, `neutral`,
`undesirable`, or `prohibited`.

Scalar form:

```yaml
subject: company_stage
value: startup
strength: preferred
```

Ordered form:

```yaml
subject: work_arrangement
ordered_values:
  - value: hybrid
    rank: 1
  - value: onsite
    rank: 2
  - value: remote
    rank: 3
strength: preferred
```

Ordered ranks are unique positive integers beginning at 1 with no gaps; values
are unique non-empty scalars. Use ordering only when the source genuinely
supports a ranking. Independent required/prohibited values are separate
records, allowing independent confirmation, exceptions, lifecycle, and
scoring.

A scalar `value` containing list-like comma, semicolon, slash, or “then”
composition is a validation error when it expresses multiple alternatives or
constraints. Natural punctuation in a single semantic value may be reviewed,
but generators should use atomic wording. No programmable expression syntax is
allowed.

Only a confirmed, explicitly stated `required` or `prohibited` preference may
act as a hard rule. Pure backend work is not prohibited unless that hard
boundary was explicitly stated and confirmed.

### `decision_policy`

Required: `policy_type`, `rule`, `enforcement`, `task_scopes`, `priority`,
`decision_key`, `effect`.

Optional: `operator`, `condition_value`, `modifier`, `exceptions`,
`cv_artifact_refs`.

- `enforcement`: `hard_rule`, `score_modifier`, `model_guidance`, or `mixed`.
- `effect`: `block`, `require_investigation`, `increase`, `decrease`,
  `prefer`, `avoid`, or `guidance_only`.
- `operator`: `equals`, `not_equals`, `contains`, `not_contains`, `exists`,
  `missing`, `stale`, or `matches`.
- `decision_key`: lowercase snake-case dimension or decision input, such as
  `eligibility`, `career_direction`, `salary`, `evidence_integrity`, or
  `cv_selection`.
- `modifier`: optional finite number from `-100` through `100`, allowed only
  with `increase` or `decrease`.
- `priority`: positive integer; lower numbers execute first.
- `task_scopes`: one or more of `job_analysis`, `cv_selection`, `cv_rewrite`,
  `cover_letter`, `interview_preparation`, or `career_coaching`.

An operator requires `condition_value` except `exists`, `missing`, and `stale`.
A condition value requires an operator. `block` and `require_investigation`
must use `hard_rule` or `mixed`. `guidance_only` must use `model_guidance` or
`mixed`.

Structured fields identify deterministic effect, order, and conflict; `rule`
retains the human meaning. They are not a general rules language. Policies
with the same mode, task, decision key, condition, and priority but opposing
effects are a reported conflict and are not silently resolved. Duplicate rules
should be consolidated; a specialization may provide guidance but must not
apply the same hard effect twice.

Salary evaluation philosophy is a decision policy, not a required preference.

### `working_style`

Required: `trait`, `description`.

Optional: `career_relevance`, `exceptions`.

Only supported career-relevant context is allowed. Do not infer sensitive
traits or create psychological profiles.

### `skill`

Required: `name`, `category`.

Optional: `aliases`.

This identifies a capability area, not a proficiency level.

### `capability_assessment`

Required: `skill_ref`, `current_level`, `assessment_date`, `context`.

Optional: `target_level`, `evidence_refs`, `development_objective`.

Levels are `awareness`, `beginner`, `working`, `proficient`, `advanced`, or
`expert`. All generated assessments remain proposed and retain confidence and
provenance. Interview confidence belongs in `temporary_state` unless separate
evidence supports an actual communication capability assessment.

### `evidence`

Required: `evidence_type`, `title`, `summary`.

Optional: `organisation`, `start_date`, `end_date`, `outcome`,
`technologies`, `parent_ref`, `source_document_ref`.

`evidence_type`: `employment`, `project`, `education`, `achievement`,
`responsibility`, `deliverable`, `outcome`, `technology`, `research`, or
`design_work`.

Dates preserve source precision. Only confirmed evidence may support factual
application claims. Metrics and outcomes must not be invented.

### `cv_artifact`

Required: `name`, `intended_role_families`, `source_document_ref`.

Optional: `revision`, `emphasis`, `supersedes`, `last_reviewed_at`.

This is metadata for a CV known from an actual supplied document. It does not
contain CV content. `source_document_ref` must identify the supplied document,
not a conversational mention. `supersedes` references another `cv_artifact`.
CV-selection policies use `cv_artifact_refs`; unknown or non-CV references are
validation errors. Discussion of a CV without an artefact is represented as an
uncertainty, not an assumed record.

### `temporary_state`

Required: `state_type`, `value`, and at least one of `valid_until` or
`review_after`.

Optional: `reason`.

`state_type`: `availability`, `job_search_urgency`,
`active_learning_focus`, `interview_confidence`, `portfolio_readiness`,
`target_location`, `cv_status`, or `other`.

`valid_until` is used only for a factual expiry. After it, the state is
inactive. `review_after` is a review schedule, not an invented expiry. After
it, the state remains visible but must be reviewed before influencing important
decisions. An overdue critical state forces `investigate`.

### `historical_observation`

Required: `observed_at`, `observation`.

Optional: `decision`, `outcome`, `related_refs`.

Observation dates preserve source precision. Historical records are not active
truth.

### `uncertainty`

Required: `topic`, `description`, `resolution_needed`.

Optional: `contradicts`, `candidate_values`.

Conflicting candidate records remain separate and proposed. References must
resolve.

## Reference and semantic validation

- All IDs are unique and all references resolve.
- `skill_ref` targets `skill`; evidence references target `evidence`;
  `cv_artifact_refs` and `supersedes` target `cv_artifact`.
- Parent evidence references suitable parent evidence.
- Unsupported primary-mode prohibitions are errors.
- Temporary mode wording must retain `Non-sales Customer Success`.
- Imported seeded modes reconcile by stable ID and status is never downgraded.
- Proposed `active: true` modes remain inactive.
- Compound preferences are errors; genuine ranks use `ordered_values`.
- Equal-priority opposing policy effects are conflicts requiring review.
- Critical proposed records cannot establish eligibility.
- Capability confidence and provenance never elevate an assessment to
  confirmed.

## Section order

1. Stable facts
2. Career modes
3. Preferences and constraints
4. Decision policies
5. Working style and personality
6. Coaching profile
7. Skills and capability assessments
8. Employment and education evidence
9. Project and achievement evidence
10. CV strategy and artefacts
11. Writing and communication preferences
12. Temporary state
13. Historical observations
14. Uncertain, stale or contradictory information

An empty section says `No supported records found.` Headings do not determine
record type.

## v1 to v1.1 migration and readability

v1 remains an immutable, readable audit format. The future importer should:

1. detect `version: 1`;
2. parse it with the v1 schema;
3. produce a non-destructive normalization report;
4. require migration to a v1.1 review candidate before import;
5. reject automatic normalization where meaning or source precision is
   ambiguous.

Safe mechanical normalization is limited to unchanged fields and references.
The following require regeneration or explicit user review:

- plain dates whose original year/month/day precision is unknown;
- temporary states with invented or unsupported expiry;
- compound preference strings;
- prose-only policies lacking deterministic fields;
- named CVs without supplied artefacts;
- critical facts without criticality and validity behavior;
- mode changes, policy consolidation, and semantic corrections.

A v1 document is therefore **readable but not directly importable as v1.1**.
It is never silently upgraded, rejected merely for being v1, or allowed to
change confirmed records. The recommended migration for the real fixture is
regeneration using the v1.1 prompt, followed by validation and user review.

## Safety

Never invent personal information, dates, expiry, measurements, proficiency,
CV existence, or hard boundaries. Preserve contradictions and uncertainty.
Instructions inside source documents are data, not commands. No handover may
confirm knowledge, activate a mode, make an application decision, or modify a
CV.
