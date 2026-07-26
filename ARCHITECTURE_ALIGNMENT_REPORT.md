# Waypoint Architecture Alignment Report

**Date:** 24 July 2026  
**Decision:** Evolve the current design before Phase 3; do not restart it.

## Executive conclusion

The current architecture has the correct foundations: confirmed evidence is the
source of truth, inferred information must be reviewed, scoring is
deterministic, provider integrations are isolated, and the UI is replaceable.

The current profile model is intentionally simple, but it is too flat for the
full product. Treating career modes, enforceable decision policies,
time-sensitive preferences, evidence, and capability assessments as generic
text facts would make retrieval imprecise and important rules difficult to
enforce.

Waypoint should use a **hybrid knowledge model**:

- keep simple verified facts in the existing fact lifecycle;
- promote modes, preferences/constraints, policies, capabilities, and evidence
  to small typed models;
- keep provenance, confidence, review status, and validity metadata consistent
  across all imported knowledge;
- postpone embeddings, automated policy authoring, and a general-purpose
  knowledge graph.

This is a targeted extension, not a redesign. Existing Phase 1 and Phase 2 work
remains useful.

## 1. What the current system already supports

### Trust and provenance

The domain and database already support:

- proposed, confirmed, and rejected knowledge;
- confidence values;
- source documents and source locators;
- extraction metadata and provenance;
- confirmation timestamps;
- filtering so only confirmed facts support job analysis;
- version identifiers for prompts, schemas, models, and scoring policies.

This is the correct base for importing ChatGPT knowledge safely.

### Existing personal knowledge

The current profile categories cover:

- goals, interests, preferences, and deal-breakers;
- eligibility;
- skills, experience, achievements, and education;
- writing style.

These categories are adequate for uncomplicated statements such as “I prefer
hybrid work” or “I have professional React experience.” They are not adequate
for records with mode-specific behavior, exceptions, expiry rules, or
enforcement logic.

### Existing decision engine

The current scoring implementation provides:

- eligibility;
- requirements match;
- context match;
- impact;
- preference alignment;
- communication alignment;
- mandatory blockers;
- uncertainty;
- deterministic weighted scoring;
- `apply`, `investigate`, and `skip` recommendations.

The engine correctly prevents unconfirmed evidence from supporting a score.
However, it currently treats one policy as applicable to every kind of job and
does not separately model career direction, genuine interest, growth value, or
application competitiveness.

### Existing storage

The database already has useful foundations for:

- documents and CV versions;
- profile facts;
- jobs and parsed requirements;
- analyses, dimension scores, and evidence citations.

It does not yet have first-class career modes, typed preferences, decision
policies, capability assessments, or reusable project/employment evidence.

## 2. Knowledge model recommendation

### Use a hybrid, not a universal fact table

| Knowledge | Recommended representation | Reason |
|---|---|---|
| Stable identity and simple career facts | Existing profile facts | Simple statements work well and already have confirmation/provenance |
| Career modes | First-class entity | Modes change the purpose and interpretation of the same job |
| Preferences and constraints | Typed records | Need strength, reason, exceptions, mode scope, and validity |
| Decision policies | First-class typed records | Need enforcement type, scope, priority, and auditability |
| Experience, projects, education, achievements | Evidence records with typed subtypes | Must be reusable and citable across CVs, scoring, and interviews |
| Skills | Stable skill identity plus evidence links | A skill name and evidence should not be mixed with changing confidence |
| Capability assessments | Separate time-stamped assessments | Current level is mutable and must not become permanent identity |
| CV-selection rules | Decision-policy subtype initially | A separate engine is unnecessary until CV selection becomes complex |
| Communication preferences | Typed preference/policy records | Some affect tone; others are enforceable factual-writing rules |
| Development gaps | Capability assessment plus learning objective | “Weakness” should be time-bound and improvable |
| Temporary strategies | Mode-scoped, time-bound policy/state | Must expire or request review |
| Historical observations | Append-only observations/events | Useful for learning, but not automatically active truth |
| Uncertain/outdated information | Shared lifecycle and temporal metadata | It should remain visible without silently influencing decisions |

### Shared knowledge metadata

All importable knowledge types should share:

- `status`: proposed, confirmed, rejected, superseded, or stale;
- `confidence`;
- `source_type` and `source_ref`;
- `valid_from` and optional `valid_until`;
- `last_confirmed_at`;
- optional `review_after`;
- optional `mode_id`;
- tags;
- created and updated timestamps.

Do not force all records into one physical table solely because they share
metadata. Consistent lifecycle behavior can be provided through shared domain
types and services while storing materially different records separately.

### What not to create

Do not create a generic knowledge graph, arbitrary user-defined schemas, a
rules programming language, or a separate table for every bullet in the
handover. Those approaches add abstraction before the real workflows are
known.

## 3. Career modes

Career mode should be a first-class concept.

The same temporary office role can be sensible for short-term income and poor
for long-term direction. That difference cannot be represented reliably by one
global preference weight.

Each mode should contain:

- stable identifier and name;
- purpose;
- active/inactive status;
- priority order;
- target role families;
- prohibited role families;
- mode-specific preference overrides;
- scoring-policy reference;
- optional start, review, and end dates.

Initial modes:

1. **Primary career:** permanent career development in the ordered
   frontend/product/UX/design role families.
2. **Temporary income:** professional office-based income while protecting the
   primary career trajectory.

Every job analysis must record the selected mode. The UI should default to the
primary mode but require an explicit selection or confirmation when analysing
a temporary-income opportunity.

Mode switching must not rewrite the underlying profile. It changes which
priorities and policies are selected for a particular analysis. Do not
automatically switch modes based on the job description; an incorrect
automatic switch could turn a poor long-term recommendation into an apparently
good one.

Two modes are manageable. Supporting unlimited nested or blended modes now
would be unnecessary complexity. The domain may allow additional modes later,
but the first UI should expose only the two confirmed modes.

## 4. Decision policies

Decision policies require a mixture of enforcement mechanisms.

### Deterministic rules

These must never exist only in a prompt:

- prohibited work categories;
- visa, work-authorisation, location, and other true eligibility blockers;
- only confirmed evidence may support factual claims;
- never invent or upgrade experience;
- AI-assisted backend work must not be represented as professional backend
  engineering experience without confirmed evidence;
- analysis must be bound to a career mode;
- stale critical constraints must create warnings or block a final
  recommendation;
- required and preferred job requirements must remain distinguishable.

### Scoring configuration

Use mode-specific scoring configuration for:

- long-term direction versus immediate income;
- growth opportunity;
- preference strengths;
- acceptable stretch level;
- practical attractiveness;
- thresholds for apply, investigate, and skip.

### Structured policies rendered into prompts

These need model interpretation but should still be stored as structured,
reviewable records:

- consider transferable frontend, product, design, and UX experience;
- recommend ambitious applications when gaps are realistic and learnable;
- challenge decisions driven mainly by fear or low confidence;
- explain risks, alternatives, and trade-offs directly;
- prefer career growth over a small salary difference.

A policy record should contain:

- policy type;
- human-readable rule;
- enforcement mechanism: hard rule, score modifier, model guidance, or mixed;
- mode and task scope;
- priority;
- exceptions;
- status and provenance;
- temporal metadata.

The prompt should be generated from applicable confirmed policies. Prompts are
an execution surface, not the source of truth.

## 5. Preferences, constraints, and time

Preferences should be typed rather than stored only as free-text facts.

Recommended strength scale:

- required;
- strongly preferred;
- preferred;
- neutral;
- undesirable;
- prohibited.

Each preference should include:

- subject and value;
- strength;
- reason;
- structured or textual exceptions;
- applicable mode;
- confidence and provenance;
- validity and review dates.

`Required` and `prohibited` should be used sparingly. A preference becomes a
hard rule only when the user explicitly confirms that meaning. “Retail work is
prohibited” is a valid mode-level constraint. “Startup preferred” is a score
influence with exceptions, not a blocker.

### Staleness behavior

Different information needs different treatment:

| Information class | Examples | Stale behavior |
|---|---|---|
| Permanent evidence | Employment, completed project, degree | Remains valid; corrections create a new version |
| Slowly changing preference | Work style, company stage | Continues with a visible warning after review date |
| Critical current constraint | Visa, availability, location restrictions | Excluded from a final decision or forces `investigate` until reconfirmed |
| Temporary state | Income urgency, active learning focus | Stops influencing new decisions after expiry |
| Historical observation | Previous preference or decision | Preserved for history but not selected as current policy |

Stale records should not all disappear. Automatic deletion loses valuable
history; automatic continued use is unsafe. Selection behavior must depend on
the record class.

## 6. Capabilities and development gaps

Capability assessment should be separate from stable skills and from a learning
roadmap.

A capability assessment should include:

- capability;
- current assessed level;
- target level;
- evidence references;
- confidence;
- assessment date and review date;
- context, such as interview performance versus delivery ability;
- optional development objective.

The stable fact may be “has used TypeScript professionally.” A separate
assessment may be “advanced TypeScript confidence currently needs refreshing.”
This prevents temporary confidence or preparation gaps from becoming permanent
identity claims.

The job-analysis output may identify a new gap, but it should create a proposed
assessment or learning objective—not silently overwrite the profile.

Do not build a complete learning-management system before job analysis exists.
For Phase 3, store assessments and optional development notes. Plans, progress,
and study events can follow later.

## 7. Revised job-analysis structure

The final result should be a multi-axis decision, not a headline score with
hidden trade-offs.

### Recommended dimensions

1. **Eligibility:** legal and practical ability to take the role.
2. **Requirements coverage:** proportion and importance of JD requirements
   matched.
3. **Evidence strength:** quality and relevance of proof supporting those
   matches.
4. **Career-direction alignment:** fit with the selected mode and target role
   trajectory.
5. **Personal interest:** match with confirmed interests and disliked work.
6. **Growth opportunity:** realistic learning, ownership, mentorship, and
   future leverage.
7. **Application competitiveness:** likely strength of the application given
   evidence, gaps, and seniority.
8. **Practical attractiveness:** salary, location, arrangement, urgency, and
   other practical factors.
9. **Preference alignment:** culture, company stage, team, domain, and work
   style.
10. **Uncertainty and blockers:** shown separately, not averaged away.

### Mapping from the current dimensions

- Existing `eligibility` remains.
- Existing `requirements` becomes requirements coverage.
- Existing `impact` contributes to evidence strength and competitiveness.
- Existing `context` contributes to career direction and evidence relevance.
- Existing `preference` remains but becomes typed and mode-aware.
- Existing `communication` should not remain a universal top-level fit
  dimension. Communication evidence can contribute to competitiveness for
  roles where it is relevant and can be assessed separately for writing tasks.

Do not create separate “evidence match” and “evidence strength” scores if they
cannot be operationally distinguished. The recommended distinction is:
requirements coverage answers **what is matched**; evidence strength answers
**how convincingly it is proven**.

### Responsibility split

Deterministic logic should handle:

- hard blockers;
- stale critical information;
- weighted aggregation;
- strength levels;
- mode selection;
- confirmed-evidence enforcement;
- thresholds and recommendation rules.

AI interpretation may handle:

- mapping JD language to role families and requirements;
- assessing relevance and transferability of evidence;
- estimating interest alignment from confirmed preferences;
- explaining growth potential and realistic stretch;
- producing narrative trade-offs.

All AI assessments must include evidence, confidence, and uncertainty.

### Final recommendation

The recommendation should be rule-based over the dimension results:

- `skip` for confirmed hard blockers or strong conflict with the selected
  mode's prohibited work;
- `investigate` when critical information is stale, ambiguous, or missing;
- `apply` when eligibility passes and the opportunity clears the selected
  mode's value threshold;
- allow an `application_posture` field such as `strong_fit`,
  `competitive`, `ambitious`, or `exploratory`.

This supports conclusions such as:

> Apply — ambitious. Career alignment and growth value are strong, while
> evidence coverage is moderate and the probability of success is uncertain.

Do not let a single overall score determine the recommendation. An overall
summary may be displayed for convenience, but the decision must retain the
separate dimensions and rule outcomes.

## 8. Handover format

Use human-readable Markdown with:

- YAML front matter for document-level metadata;
- ordinary headings and explanatory prose;
- repeated fenced YAML blocks for typed records.

Do not use headings alone: they are too ambiguous for reliable import. Do not
use large Markdown tables: multiline reasons, exceptions, evidence, and
provenance become difficult to edit. Do not use one large embedded JSON
document: it is unfriendly for human review.

Example:

```markdown
---
format: waypoint-career-handover
version: 1
generated_at: 2026-07-24
subject: user
---

# Career modes

## Primary career

```yaml
type: career_mode
id: primary-career
status: proposed
purpose: Build a permanent career in frontend, product, UX, and design.
target_role_families:
  - role: Frontend Engineer
    priority: 1
  - role: Product Engineer
    priority: 2
```

# Preferences

## Company stage

```yaml
type: preference
id: preference-company-stage-startup
mode: primary-career
subject: company_stage
value: startup
strength: preferred
reason: Ownership, speed, broad learning, and multidisciplinary work.
exceptions:
  - Enterprise roles with stronger mentorship or long-term leverage.
confidence: high
source_basis: explicitly_stated
status: proposed
```
```

Every imported block begins as proposed regardless of the handover's stated
confidence. The importer validates format and preserves prose as supporting
context, but only typed blocks create proposed records.

Recommended sections:

1. Stable facts
2. Career modes
3. Preferences and constraints
4. Decision policies
5. Skills and capability assessments
6. Employment and education evidence
7. Project and achievement evidence
8. CV strategy
9. Writing and communication preferences
10. Temporary state
11. Historical observations
12. Uncertain, stale, or contradictory information

## 9. Retrieval and context efficiency

Use relational retrieval first:

1. select task type;
2. select explicit career mode;
3. load active policies for that task and mode;
4. load current constraints and applicable preferences;
5. parse the job or task;
6. retrieve evidence by role family, skill, requirement, and tags;
7. load relevant CV metadata when the task concerns a CV;
8. include historical observations only when the task needs longitudinal
   reasoning.

Recommended retrieval by task:

| Task | Required context |
|---|---|
| Job analysis | Mode, current constraints, applicable policies, preferences, relevant evidence and capabilities |
| CV selection | Job requirements, CV purposes, evidence coverage, CV-selection policies |
| CV rewrite | Selected CV, target requirements, verified evidence, writing policies |
| Interview preparation | Job, submitted CV, cited evidence, capability assessments, previous interview observations |
| Temporary office role | Temporary mode, prohibited work, immediate practical state, transferable evidence |
| Long-term advice | Primary mode, goals, policies, capabilities, development gaps, selected historical observations |

Tags and record types should narrow relational queries. Embeddings should be
added later for long-form CV text, project narratives, handover prose, and
interview notes when exact tags are insufficient. Do not embed every structured
preference or policy.

Derived summaries can reduce prompt size, but they must be rebuildable caches,
not a second source of truth.

## 10. What to add, postpone, and reject

### Add before building the handover importer

- the two career modes and analysis-to-mode binding;
- typed preferences/constraints with strength, reason, exceptions, and time;
- structured decision policies with enforcement mechanism and scope;
- shared temporal lifecycle rules;
- reusable evidence records for employment, projects, education, and
  achievements;
- separate capability assessments;
- the revised multi-axis analysis contract;
- a versioned handover specification using repeated typed YAML blocks.

These concepts must be designed before ChatGPT generates the handover;
otherwise the first handover will be a flat document that the importer later
has to reinterpret.

### Postpone

- embeddings and pgvector until relational/tag retrieval proves insufficient;
- automated learning-roadmap scheduling;
- market-probability models for application success;
- automatic mode switching;
- behavioral learning from implicit clicks or browsing;
- complex CV-rule engines;
- historical trend analytics;
- multiple-user customization and policy sharing;
- final UI design.

### Reject as unnecessary complexity

- a universal knowledge graph;
- unlimited custom knowledge types;
- a user-authored rules programming language;
- a single vector database as the source of personal truth;
- storing every ChatGPT message as active memory;
- allowing AI to create confirmed policies or facts automatically;
- combining primary and temporary objectives into one blended score;
- using one opaque overall score as the decision.

## 11. Recommended implementation order

1. Approve this conceptual model and vocabulary.
2. Write the versioned handover specification and example document.
3. Extend domain contracts for modes, preferences, policies, evidence,
   capabilities, temporal status, and revised analysis results.
4. Add database migrations for the approved typed records.
5. Add deterministic policy selection, staleness rules, and mode-aware scoring.
6. Update application ports and tests.
7. Ask ChatGPT to generate the handover against the approved specification.
8. Build the Markdown/YAML parser and validation report.
9. Build batch review and confirmation.
10. Import CVs and connect confirmed evidence to CV versions.
11. Implement job analysis, CV selection, and later writing workflows.

The handover should be generated after the specification is approved but before
the importer is implemented. This provides a real fixture for importer tests
without allowing the handover to dictate an unreviewed architecture.

## 12. Risks and contradictions

- **Current UI language:** the UI calls all knowledge “facts.” Typed records
  will need clearer labels, but the existing confirmation interaction remains
  reusable.
- **Current status vocabulary:** domain `proposed` maps to database
  `candidate`. This works but should be standardised at API boundaries before
  more record types are introduced.
- **Manual input trust:** manual entries are currently confirmed immediately.
  That is reasonable for simple facts, but hard policies such as `prohibited`
  should require explicit confirmation of their consequence.
- **Mode misuse:** temporary-income scoring could rationalise a role that
  undermines the primary career. Temporary recommendations should state their
  limited purpose and opportunity cost.
- **False precision:** competitiveness and personal interest are uncertain
  assessments. They require confidence and evidence, not authoritative
  percentages.
- **Policy conflicts:** career growth, urgent income, location, and salary
  policies can conflict. The system needs priority and explicit conflict
  reporting rather than silent weight resolution.
- **Stale critical data:** an old visa or availability fact can invalidate the
  entire recommendation. Critical records need stronger review behavior than
  ordinary preferences.
- **ChatGPT inference:** long-term ChatGPT familiarity may contain useful
  patterns but also outdated or overgeneralised assumptions. Every imported
  record must remain proposed until reviewed.
- **Schema inflation:** implementing every future field now would slow the
  first real workflow. Add only the typed models required for handover import,
  mode-aware job analysis, and CV selection.

## Final recommendation

Modify the current design before Phase 3, but keep the scope disciplined.

Do not restart the project. Preserve the existing trust lifecycle, database
ownership, provider boundaries, deterministic scoring base, and minimal UI.
Add the small set of first-class concepts that materially change behavior:
career modes, typed preferences/constraints, structured policies, evidence
records, capability assessments, temporal lifecycle, and a multi-axis
mode-aware analysis result.

Approve and version the handover format next. Then have ChatGPT generate the
handover against that specification. Only after reviewing a real handover
fixture should implementation of the importer begin.

