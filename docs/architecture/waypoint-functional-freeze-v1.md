# Waypoint Functional Freeze v1

Frozen on 26 July 2026.

## Product model

Waypoint has three deliberately separate layers:

1. **Master Profile** — confirmed knowledge about the person: skills,
   competencies, experience, projects, preferences, career direction and
   eligibility.
2. **CV library** — independent application documents. A CV is parsed only to
   understand what that particular document visibly communicates. CV content
   does not become Master Profile knowledge.
3. **Job analysis** — first evaluates the role against the Master Profile,
   then ranks ready CVs by how well their visible content represents supported
   job requirements.

## Frozen intelligence rules

- AI proposes or interprets; deterministic application code validates, scores
  and recommends.
- Missing evidence is unknown, not proof that the user lacks a capability.
- Only explicit eligibility conflicts or evidenced mandatory mismatches are
  blockers.
- Groq failure or quota exhaustion must preserve a useful deterministic result.
- Master Profile changes and CV changes invalidate relevant analysis caches.
- CV tailoring may use confirmed Master Profile evidence but may not invent it.

## Frozen CV v2 rules

- PDF and DOCX text extraction is deterministic.
- ATS sections and claims retain source-backed text.
- Failed or empty CV snapshots cannot be recommended.
- Original files and parsed snapshots remain deletable.
- CV v2 does not write to legacy CV tables or personal knowledge tables.

## Change control during UI/UX phase

The intelligence architecture, schemas and scoring policy are not to be
redesigned during visual refinement. Functional changes are limited to:

- correctness or security defects;
- accessibility defects;
- clearly misleading labels or feedback;
- presentation-only additions that expose existing information.

New intelligence capabilities should be recorded for a later product phase.

