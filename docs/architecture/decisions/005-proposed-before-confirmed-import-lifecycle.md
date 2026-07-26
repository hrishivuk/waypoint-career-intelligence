# ADR-005: Proposed-before-confirmed import lifecycle

**Status:** Approved  
**Date:** 24 July 2026  
**Supersedes:** Trusting imported or AI-inferred personal knowledge immediately

## Decision

Every imported typed record begins as `proposed`, regardless of source
confidence or whether the source says it was explicitly stated. Only an
explicit user review can make it `confirmed`. The shared lifecycle is
`proposed`, `confirmed`, `rejected`, `superseded`, and `stale`.

Imported records preserve provenance, confidence, temporal metadata, source
references, mode scope, and tags where relevant. Only confirmed evidence may
support factual application claims. Stale critical constraints force
investigation or reconfirmation; expired temporary state becomes inactive;
historical records remain stored but do not become active truth automatically.

## Consequences

- ChatGPT familiarity and AI inference can populate reviewable proposals but
  cannot silently alter trusted personal knowledge.
- Batch import requires validation and confirmation workflows.
- Corrections preserve history through rejection or supersession rather than
  destructive replacement.
