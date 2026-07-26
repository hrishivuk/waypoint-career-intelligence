# Waypoint Architecture

**Status:** Approved and frozen  
**Effective date:** 24 July 2026

This document is the authoritative architecture for current Waypoint
development. It approves the direction proposed in
`ARCHITECTURE_ALIGNMENT_REPORT.md` and supersedes the simpler personal-knowledge
and job-analysis model described in `PROJECT_STATUS.md`. Those reports remain
useful historical context, but this document and the approved ADRs in
`decisions/` govern implementation.

The architecture is frozen. Alternatives should be reconsidered only when
implementation exposes a concrete blocker.

## Product boundary

Waypoint is a personal, evidence-based AI career coach. It helps the user decide
whether to apply, investigate, or skip a role; select and tailor a CV; and plan
application steps without inventing experience.

The existing modular application remains in place:

1. **Domain** owns career concepts, trust rules, lifecycle behavior, and
   deterministic decisions.
2. **Application** coordinates workflows and provider-independent ports.
3. **Infrastructure** integrates Supabase, OpenAI, storage, and identity.
4. **UI/API** remains replaceable and contains no career decision rules.

The working Phase 1 and Phase 2 foundations must be evolved, not restarted.

## Personal knowledge model

Waypoint uses a hybrid model:

- Existing profile facts remain appropriate for simple, stable statements.
- First-class typed records represent career modes, preferences and
  constraints, decision policies, reusable evidence, skills, capability
  assessments, temporary state, historical observations, coaching behavior,
  decision priorities, and limited working-style context.
- Importable records share lifecycle, provenance, confidence, temporal, mode,
  and tag metadata where relevant, without being forced into one universal
  table.

Supported lifecycle states are `proposed`, `confirmed`, `rejected`,
`superseded`, and `stale`. Imported knowledge always starts as `proposed`;
confidence or explicit wording in a source does not bypass user review.

Only confirmed evidence may support factual application claims. Permanent
evidence remains usable until corrected or superseded. Slowly changing
preferences may remain active with a staleness warning. Stale critical
constraints force investigation or reconfirmation. Expired temporary state
does not influence new decisions. Historical observations remain stored but
inactive unless a task explicitly requests historical context.

## Career modes

Every job analysis is bound to one explicitly selected mode. Waypoint never
infers or switches mode from job-description content.

### Primary career

Purpose: build a permanent career, in this priority order:

1. Frontend Engineer
2. Product Engineer
3. UX Engineer
4. Product Designer
5. UX Designer
6. UI Designer

### Temporary income

Purpose: find professional office-based income while the primary career search
continues. Suitable families include Trust & Safety, Operations, Business
Support, Digital Analyst, Technical Support, QA, non-sales Customer Success,
and other professional office or technology-adjacent roles.

Retail, restaurants, supermarkets, shops, warehouse work, delivery work,
caretaking, and manual labour are prohibited recommendations in this mode.
Temporary recommendations must state their limited purpose and opportunity
cost.

## Policies and coaching behavior

Important rules are structured, reviewable records rather than hidden prompt
text. A decision policy records its rule, enforcement mechanism (`hard_rule`,
`score_modifier`, `model_guidance`, or `mixed`), task and mode scope, priority,
exceptions, lifecycle, provenance, and temporal metadata.

Deterministic enforcement covers hard blockers, confirmed-evidence rules,
stale critical constraints, selected mode, preference strengths, aggregation,
thresholds, and recommendation outcomes. AI may interpret job language, map
transferable evidence, and explain trade-offs, but it may not invent evidence
or freely choose the final recommendation.

The coaching profile must direct Waypoint to challenge assumptions, avoid
flattery and reflexive agreement, expose weak reasoning and risks, explain
trade-offs, suggest alternatives, distinguish confidence issues from capability
gaps, and remain truthful and evidence-based. It should reason from senior
engineering, product design, hiring-manager, and startup-founder perspectives.
This behavior must be represented in structured policy records, not only in a
system prompt.

Working-style and personality context is deliberately limited to career advice
and company-fit analysis. Initial handover assertions in this area remain
proposed until reviewed.

## Job analysis

The result is a multi-axis decision containing:

1. eligibility;
2. requirements coverage;
3. evidence strength;
4. career-direction alignment;
5. personal interest;
6. growth opportunity;
7. application competitiveness;
8. practical attractiveness;
9. preference alignment;
10. uncertainty and blockers.

It also records the selected career mode, `apply`/`investigate`/`skip`
recommendation, application posture (`strong_fit`, `competitive`, `ambitious`,
or `exploratory`), citations, narrative trade-offs, and scoring-policy version.
No opaque overall score controls the decision.

Confirmed blockers or prohibited mode conflicts produce `skip`. Missing,
ambiguous, or stale critical information produces `investigate`. `apply`
requires eligibility and the selected mode's value threshold to pass.

## Retrieval and AI boundaries

Relational, typed, and tag-based retrieval is the approved strategy. Each task
loads only its selected mode, applicable policies and constraints, relevant
preferences, evidence, capabilities, CV metadata, temporary state, and any
explicitly needed history.

Embeddings and vector search are postponed until real workflows demonstrate
that relational retrieval is insufficient. Derived summaries may be
rebuildable caches, never a second source of truth.

AI providers remain replaceable. Prompts and scoring policies remain versioned.
Prompts are an execution surface generated from confirmed applicable records,
not the source of personal truth or enforceable policy.

## Explicitly excluded

Current implementation must not introduce a knowledge graph, arbitrary custom
record types, user-programmable rules, embeddings, a vector database as source
of truth, automatic behavioral learning, automatic mode switching, a learning
management system, blended primary/temporary scoring, or one opaque job-fit
score. Waypoint is not a psychological profiling product.

## Approved decision records

- [ADR-001: Hybrid personal knowledge model](decisions/001-hybrid-knowledge-model.md)
- [ADR-002: Explicit career modes](decisions/002-explicit-career-modes.md)
- [ADR-003: Deterministic multi-axis recommendations](decisions/003-deterministic-multi-axis-recommendations.md)
- [ADR-004: Relational retrieval without embeddings](decisions/004-relational-retrieval-no-embeddings.md)
- [ADR-005: Proposed-before-confirmed import lifecycle](decisions/005-proposed-before-confirmed-import-lifecycle.md)
