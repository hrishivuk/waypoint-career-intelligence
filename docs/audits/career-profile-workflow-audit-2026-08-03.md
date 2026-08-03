# Career Profile workflow audit — 3 August 2026

## Scope

Reviewed the Career Profile navigation and the complete narrative lifecycle:
add information, create proposals, restore a staged review, select decisions,
activate records, revisit the page, repeat an import, and load confirmed
knowledge.

## Fixed in this branch

- Activated imports no longer reload as proposed records.
- The review panel is cleared immediately after activation.
- Reopening a staged review restores explicitly confirmed selections while
  retaining the safe default for new pending records.
- Identical activated or superseded narratives cannot be reopened and mutate
  their historical provenance.
- Reopening the exact same staged narrative resumes its existing review without
  another AI call or usage charge.
- A newly created review supersedes older staged reviews after its candidates
  are saved.
- Users may reject every proposal and finish the review.
- Candidate decisions, ownership validation, and activation now execute in one
  locked database transaction. Incomplete, duplicate, stale, or cross-user
  decision sets roll back without partial changes.
- Direct authenticated access to the older non-atomic activation functions is
  removed.
- Career Profile header, tabs, and page container now persist between tabs.
- Tab-specific loading happens inside the persistent shell.
- On narrow screens the active tab scrolls into view instead of resetting to an
  off-screen position.

## Verified

- A live disposable-account integration test proves complete decision-set
  validation, rollback, tenant isolation, accepted/rejected decisions, and
  activation output.
- Existing unit, TypeScript, lint, production-build, and browser suites pass.
- Public URLs remain unchanged after introducing the shared route-group layout.

## Remaining findings

### 1. Narrative staging is still a multi-query operation — medium

Creating the import row, inserting candidates, and superseding an older staged
review are separate database requests. The route now checks every error and
never mutates an activated identical import, but a rare network/database failure
between requests can leave a staged import without all expected candidates.

Recommended follow-up: move import creation, candidate insertion, and staged-run
superseding into one authenticated PostgreSQL RPC, similar to the completed
atomic review RPC.

### 2. Mixed legacy and narrative knowledge visibility needs a product decision — medium

Once at least one confirmed `master_profile_records` row exists, the Knowledge
Library reads that source instead of merging the older typed knowledge tables.
For accounts containing both systems, older confirmed records may stop appearing
in the library even though they remain stored.

Recommended follow-up: define one canonical migration/merge policy, then either
migrate legacy records atomically or load and deduplicate both sources. Do not
merge them heuristically without provenance rules.

### 3. Route-level narrative tests remain limited — low

The live database integration protects the highest-risk activation boundary,
but GET/POST route branching is not yet covered by focused mocked route tests.

Recommended follow-up: add route-contract tests for staged-only GET, identical
staged resume, identical activated conflict, and superseding behavior.
