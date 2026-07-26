# ADR-003: Deterministic multi-axis recommendations

**Status:** Approved  
**Date:** 24 July 2026  
**Supersedes:** A recommendation governed by one weighted overall fit score

## Decision

Job analysis retains separate outputs for eligibility, requirements coverage,
evidence strength, career-direction alignment, personal interest, growth
opportunity, application competitiveness, practical attractiveness, preference
alignment, and uncertainty/blockers.

Deterministic rules own hard blockers, staleness handling, mode and policy
selection, preference strength, confirmed-evidence enforcement, aggregation,
thresholds, and the final `apply`, `investigate`, or `skip` recommendation.
AI may interpret and map evidence and explain trade-offs, with citations,
confidence, and uncertainty, but may not invent experience or freely determine
the outcome.

The result also includes application posture, evidence citations, narrative
trade-offs, and scoring-policy version.

## Consequences

- Trade-offs and uncertainty cannot be hidden by an average.
- Existing scoring dimensions are migrated or mapped rather than discarded.
- An overall summary may be displayed, but it is never the sole decision
  mechanism.
