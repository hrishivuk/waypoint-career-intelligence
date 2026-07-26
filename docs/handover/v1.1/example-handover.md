---
format: waypoint-career-handover
version: "1.1"
generated_at: 2026-07-24T15:00:00Z
subject: user
generator: Fictional example
---

# Stable facts

```yaml
type: stable_fact
id: fact-example-work-authorisation
status: proposed
category: eligibility
statement: Holds an example graduate work permission; its expiry is not known from the supplied material.
criticality: critical
confidence: medium
provenance:
  source_type: user_statement
  source_ref: example eligibility discussion
  basis: explicitly_stated
tags: [eligibility, work-authorisation]
```

# Career modes

```yaml
type: career_mode
id: primary-career
status: proposed
name: Primary career
purpose: Build a permanent career in frontend, product, UX, and design.
priority: 1
active: true
target_role_families:
  - role: Frontend Engineer
    priority: 1
  - role: Product Engineer
    priority: 2
  - role: UX Engineer
    priority: 3
  - role: Product Designer
    priority: 4
  - role: UX Designer
    priority: 5
  - role: UI Designer
    priority: 6
prohibited_role_families: []
criticality: important
confidence: high
provenance:
  source_type: user_statement
  source_ref: approved example career-mode context
  basis: explicitly_stated
```

```yaml
type: career_mode
id: temporary-income
status: proposed
name: Temporary income
purpose: Find professional office-based income while the primary career search continues.
priority: 2
active: true
target_role_families:
  - role: Trust and Safety
    priority: 1
  - role: Operations
    priority: 2
  - role: Business Support
    priority: 3
  - role: Digital Analyst
    priority: 4
  - role: Technical Support
    priority: 5
  - role: Quality Assurance
    priority: 6
  - role: Non-sales Customer Success
    priority: 7
  - role: Other professional office or technology-adjacent work
    priority: 8
prohibited_role_families:
  - Retail
  - Restaurants
  - Supermarkets
  - Shops
  - Warehouse work
  - Delivery work
  - Caretaking
  - Manual labour
criticality: important
confidence: high
provenance:
  source_type: user_statement
  source_ref: approved example temporary-income context
  basis: explicitly_stated
```

Both modes are proposed review candidates. `active: true` describes the
candidate's intended state and does not activate or replace seeded modes.

# Preferences and constraints

```yaml
type: preference
id: preference-example-work-arrangement
status: proposed
mode: primary-career
subject: work_arrangement
ordered_values:
  - value: hybrid
    rank: 1
  - value: onsite
    rank: 2
  - value: remote
    rank: 3
strength: preferred
reason: The example user explicitly ranked these arrangements.
exceptions:
  - A substantially stronger learning opportunity may outweigh this ordering.
criticality: normal
confidence: high
provenance:
  source_type: user_statement
  source_ref: example work-arrangement discussion
  basis: explicitly_stated
review_after:
  value: 2027-01
  precision: month
```

```yaml
type: preference
id: preference-example-backend
status: proposed
mode: primary-career
subject: role_family
value: Pure Backend Engineer
strength: undesirable
reason: Frontend and product work are currently a stronger direction; no hard prohibition was stated.
exceptions:
  - A realistic role with strong product exposure and mentorship may still be considered.
criticality: normal
confidence: medium
provenance:
  source_type: chat
  source_ref: example role-positioning discussion
  basis: inferred
```

# Decision policies

```yaml
type: decision_policy
id: policy-example-salary-context
status: proposed
policy_type: career-tradeoff
rule: Evaluate salary in context rather than using one permanent threshold.
enforcement: mixed
task_scopes: [job_analysis, career_coaching]
priority: 30
decision_key: salary
effect: require_investigation
operator: missing
exceptions: []
criticality: important
confidence: high
provenance:
  source_type: user_statement
  source_ref: example salary discussion
  basis: explicitly_stated
```

```yaml
type: decision_policy
id: policy-example-evidence-integrity
status: proposed
policy_type: evidence-integrity
rule: Never invent or upgrade experience in application materials.
enforcement: hard_rule
task_scopes: [cv_selection, cv_rewrite, cover_letter, interview_preparation]
priority: 1
decision_key: evidence_integrity
effect: block
operator: equals
condition_value: unsupported-claim
exceptions: []
criticality: critical
confidence: high
provenance:
  source_type: user_statement
  source_ref: example application-writing instruction
  basis: explicitly_stated
```

# Working style and personality

```yaml
type: working_style
id: working-style-example-ownership
status: proposed
trait: enjoys-ownership
description: Prefers meaningful responsibility for shaping and building products.
career_relevance: May increase interest in roles with product influence.
exceptions:
  - Do not assume every small company provides meaningful ownership.
criticality: normal
confidence: medium
provenance:
  source_type: chatgpt_handover
  source_ref: example project discussions
  basis: inferred
```

# Coaching profile

```yaml
type: decision_policy
id: coaching-example-challenge-assumptions
status: proposed
policy_type: coaching-behaviour
rule: Challenge weak reasoning and explain trade-offs without flattery.
enforcement: model_guidance
task_scopes: [job_analysis, career_coaching]
priority: 10
decision_key: coaching_style
effect: guidance_only
exceptions: []
criticality: normal
confidence: high
provenance:
  source_type: user_statement
  source_ref: example coaching request
  basis: explicitly_stated
```

# Skills and capability assessments

```yaml
type: skill
id: skill-example-typescript
status: proposed
name: TypeScript
category: frontend-engineering
aliases: [TS]
criticality: normal
confidence: high
provenance:
  source_type: cv
  source_ref: example-frontend-cv-v2.pdf
  basis: documented
```

```yaml
type: capability_assessment
id: capability-example-typescript
status: proposed
skill_ref: skill-example-typescript
current_level: proficient
target_level: advanced
assessment_date:
  value: 2026-07
  precision: month
context: Proposed self-assessment for frontend delivery; interview recall was not used as a capability rating.
evidence_refs: [evidence-example-employment]
development_objective: Refresh advanced type-system concepts.
criticality: normal
confidence: medium
provenance:
  source_type: chatgpt_handover
  source_ref: example skills review
  basis: mixed
```

# Employment and education evidence

```yaml
type: evidence
id: evidence-example-employment
status: proposed
evidence_type: employment
title: Frontend Developer
summary: Built typed user-interface features for a web product.
organisation: Example Company
start_date:
  value: 2024-01
  precision: month
end_date:
  value: 2025-06
  precision: month
technologies: [React, TypeScript]
criticality: normal
confidence: high
provenance:
  source_type: cv
  source_ref: example-frontend-cv-v2.pdf employment section
  basis: documented
tags: [frontend, product]
```

# Project and achievement evidence

```yaml
type: evidence
id: evidence-example-project
status: proposed
evidence_type: project
title: Internal workflow redesign
summary: Designed and implemented a clearer multistep workflow.
outcome: Users reported fewer support questions; no verified measurement is available.
technologies: [React, Figma]
criticality: normal
confidence: medium
provenance:
  source_type: chatgpt_handover
  source_ref: example project discussion
  basis: mixed
tags: [frontend, ux]
```

# CV strategy and artefacts

```yaml
type: cv_artifact
id: cv-example-frontend-v2
status: proposed
name: Frontend CV
intended_role_families: [Frontend Engineer, Product Engineer]
source_document_ref: example-frontend-cv-v2.pdf
revision: v2
emphasis: Frontend delivery, TypeScript, and product collaboration.
last_reviewed_at:
  value: 2026-07
  precision: month
criticality: important
confidence: high
provenance:
  source_type: cv
  source_ref: example-frontend-cv-v2.pdf
  basis: documented
```

```yaml
type: decision_policy
id: cv-policy-example-frontend
status: proposed
mode: primary-career
policy_type: cv-selection
rule: Prefer the supplied frontend CV when frontend implementation is central.
enforcement: mixed
task_scopes: [cv_selection]
priority: 20
decision_key: cv_selection
effect: prefer
operator: contains
condition_value: Frontend Engineer
cv_artifact_refs: [cv-example-frontend-v2]
exceptions: []
criticality: important
confidence: medium
provenance:
  source_type: chatgpt_handover
  source_ref: example CV-selection discussion and supplied CV
  basis: mixed
```

# Writing and communication preferences

```yaml
type: preference
id: writing-example-direct
status: proposed
subject: application_writing_style
value: concise
strength: strongly_preferred
reason: Prefer direct writing while the separate evidence-integrity policy prevents unsupported claims.
exceptions: []
criticality: normal
confidence: high
provenance:
  source_type: user_statement
  source_ref: example writing feedback
  basis: explicitly_stated
```

# Temporary state

```yaml
type: temporary_state
id: state-example-interview-confidence
status: proposed
state_type: interview_confidence
value: Interview recall currently feels less confident than delivery ability.
reason: Recent preparation discussion; this is not a communication capability rating.
review_after:
  value: 2026-09
  precision: month
criticality: important
confidence: medium
provenance:
  source_type: user_statement
  source_ref: example interview-preparation discussion
  basis: explicitly_stated
```

# Historical observations

```yaml
type: historical_observation
id: history-example-role-decision
status: proposed
observed_at:
  value: 2026-05
  precision: month
observation: A role initially looked attractive by title, but repetitive maintenance reduced interest.
decision: Did not apply.
outcome: Clarified the importance of meaningful building work.
criticality: normal
confidence: medium
provenance:
  source_type: chat
  source_ref: example May 2026 job review
  basis: documented
```

# Uncertain, stale or contradictory information

```yaml
type: uncertainty
id: uncertainty-example-work-authorisation-expiry
status: proposed
topic: work-authorisation-expiry
description: The supplied material does not establish the permission's factual expiry.
resolution_needed: Confirm the exact expiry from the official permission before using it for eligibility.
criticality: critical
confidence: high
provenance:
  source_type: chatgpt_handover
  source_ref: example eligibility review
  basis: documented
```
