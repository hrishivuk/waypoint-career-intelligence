# Waypoint UI/UX Audit v1

## Product experience goal

Waypoint should feel like a calm personal decision workspace, not an admin
dashboard. Every page should answer three questions quickly:

1. Where am I?
2. What is the most important thing I can do here?
3. What changed after I did it?

## Existing strengths to preserve

- restrained slate/indigo visual language;
- readable card-based presentation;
- evidence and details available progressively;
- clear success, warning and error colour semantics;
- minimal interface without decorative clutter.

## Main issues

### Information architecture

- “Profile” is ambiguous; it is actually the place to add to the Master
  Profile.
- Knowledge, Profile and review utilities overlap conceptually.
- Older review screens remain accessible but should be treated as secondary
  data-management tools.

### Hierarchy and consistency

- buttons use several unrelated colours, heights and focus treatments;
- feedback messages vary between paragraphs, bordered alerts and banners;
- card padding alternates between 4, 5, 6 and 7 without a clear hierarchy;
- some page actions live in headers while others sit in standalone rows;
- empty and loading states use inconsistent language.

### Core journeys

- Overview must reflect live CV data rather than a placeholder count.
- Master Profile importing needs a clearer three-stage mental model:
  write, review, activate.
- Knowledge should optimise for scanning and editing, with technical provenance
  remaining secondary.
- CVs should show document readiness and visible coverage at a glance.
- Job Analysis should retain the two explicit stages: personal fit, then CV
  presentation.

### Accessibility and responsive behaviour

- add a keyboard skip link;
- use a stable, visible focus treatment globally;
- preserve horizontal navigation usability on small screens;
- respect reduced-motion preferences;
- maintain at least 44px touch targets for primary controls.

## Delivery order

1. Shared shell, typography, spacing, controls and feedback.
2. Overview and navigation clarity.
3. Master Profile import/review journey.
4. Knowledge scanning/editing.
5. CV library.
6. Job input and results.
7. Responsive, keyboard and screen-reader validation.

