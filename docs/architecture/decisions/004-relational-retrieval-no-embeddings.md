# ADR-004: Relational retrieval without embeddings

**Status:** Approved  
**Date:** 24 July 2026  
**Supersedes:** Any assumption that vector search is required for Phase 3

## Decision

Use relational queries, explicit types, tags, career-mode scope, task scope,
and lifecycle metadata to retrieve only the context needed for each workflow.
Structured records remain the source of truth.

Do not add embeddings or a vector database at this stage. Reconsider them only
if real long-form CV, project, handover, or interview content demonstrates that
typed and tag-based retrieval is insufficient. Derived summaries are permitted
only as rebuildable caches.

## Consequences

- Retrieval remains explainable, auditable, and aligned with confirmed data.
- Prompts receive smaller, task-specific context.
- Embedding infrastructure and semantic-search complexity are postponed until
  supported by an observed need.
