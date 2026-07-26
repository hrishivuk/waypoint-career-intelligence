# Waypoint skill model v2 — frozen proposal

Status: proposed for schema installation; no taxonomy merge or proficiency
import is approved by this document.

## Purpose

The model separates five questions that the original flat list mixed together:

1. What is the canonical skill?
2. What kind of skill is it?
3. How is it related to broader or narrower skills?
4. What confirmed evidence supports it?
5. What is the user's current, time-bound proficiency?

Professional behaviours use a separate competency model because their evidence
and assessment rubrics differ from technical and design skills.

## Canonical categories

`programming_language`, `framework`, `library`, `tool`, `platform`,
`database`, `cloud_service`, `design_tool`, `ux_method`, `design_skill`,
`technical_skill`, `architecture`, `methodology`, `domain_knowledge`.

Every canonical skill has one primary category. Tags and relationships provide
secondary classification without making category assignment ambiguous.

## Relationships

Skills form a graph, not a strict tree. Supported relationships are
`parent_of`, `related_to`, `uses`, `supersedes`, and `alias_of`.

Examples:

- Firebase `parent_of` Firestore, Firebase Authentication, Firebase Hosting.
- React `related_to` State Management and Component-Based Architecture.
- Figma `related_to` Auto Layout, Components & Variants, and Prototyping.
- API Integration `parent_of` REST API Integration and OAuth Integration.

## Proficiency

Allowed levels are `learning`, `basic`, `working`, `strong`, and `expert`.
An absent assessment means not assessed. Proficiency is never inferred from
record confidence.

Each current assessment retains context, evidence, source, assessment
confidence, confirmation state, and timestamps. Every change also creates an
append-only assessment event for progression history.

## Professional competencies

Competencies include collaboration, communication, problem solving, attention
to detail, independent delivery, stakeholder communication, presentation,
learning agility, time management, and product thinking.

They are stored separately but can be combined with skills through an
application-level capability view during job matching.

## Migration principles

- Schema changes are additive.
- Existing IDs and provenance are preserved.
- Duplicate records are superseded only after an explicit reviewed plan.
- Proposed additions remain proposed until user confirmation.
- Imported assessments target canonical IDs, never display-name guesses.
- Conflicting assessments, including Angular `strong`, remain blocked.

