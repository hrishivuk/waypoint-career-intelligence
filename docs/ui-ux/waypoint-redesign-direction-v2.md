# Waypoint UX/UI Redesign Direction v2

## Status

Research-backed product and visual direction for discussion and implementation.
This document does not change the product UI by itself.

## Product promise

Waypoint helps a job seeker decide whether a role is worth pursuing using
career evidence they have reviewed, then helps them prepare the strongest
truthful application.

The primary product flow is:

```text
Career history
  -> trusted Career Profile
  -> job-fit decision
  -> CV selection and coverage
  -> application preparation
```

## Experience principles

1. Lead with the user's next decision, not database counts.
2. Treat the Career Profile as the source of truth; a CV is one presentation of
   that truth, not the user's identity.
3. Make AI activity inspectable, correctable, and explicitly user-controlled.
4. Use one dominant action per screen and progressively disclose advanced
   controls.
5. Explain statuses in user language and never communicate status by colour
   alone.
6. Prefer calm, readable working surfaces over a grid of decorative cards.
7. Preserve task context when users leave a flow to fix missing information.

## Primary user hypothesis

The initial target is an active, self-directed job seeker who manages multiple
roles or CV variants, already uses AI, dislikes repeatedly supplying career
context, and values truthful evidence and privacy. Career switchers and
multi-disciplinary applicants are important secondary hypotheses.

These are hypotheses derived from the product rather than validated external
research. Interviews and usability tests remain future validation work.

## Revised information architecture

```text
Public
|- Landing
|- Sign in / Create account / Password recovery
|- Privacy / Terms

Authenticated
|- Home
|- Career Profile
|  |- Overview
|  |- Add information
|  |- Review changes
|  |- Insights
|  `- Needs attention
|- CVs
|  |- Library
|  |- Upload
|  `- CV detail / readiness / coverage
|- Jobs
|  |- Saved analyses
|  |- New analysis
|  `- Job detail
|     |- Decision
|     |- Requirements and evidence
|     `- CV choice and tailoring
|- Application Kit
|- Settings
|  |- AI provider and privacy
|  `- Account and data
`- Onboarding (resumable, hidden from primary navigation after completion)
```

Primary navigation labels are Home, Career Profile, CVs, Jobs, and Application
Kit. Settings and sign-out live in the user area. "Analyse a job" is a primary
action rather than a permanent substitute for a Jobs workspace.

## Visual direction: Deep Mineral Workspace

Waypoint will use a dark structural shell around tinted, highly readable work
surfaces. It will not be a pure-white SaaS dashboard and it will not be an
all-dark interface.

### Starting colour roles

| Role | Starting value | Purpose |
| --- | --- | --- |
| Shell | `#111827` | Persistent sidebar and structural framing |
| Canvas | `#DCE4E8` | Mineral blue-grey workspace background |
| Surface | `#EAF0F2` | Default reading and form surface |
| Surface raised | `#F3F6F7` | Selectively elevated content; never pure white |
| Surface inset | `#D3DEE3` | Filters, secondary panels, grouped metadata |
| Border | `#B7C5CC` | Separation without heavy shadows |
| Primary | `#066975` | Main actions and selected states |
| Primary soft | `#C8E7E8` | Selected and informative backgrounds |
| AI accent | `#4F46A5` | AI-specific actions only, used sparingly |

These values are starting points. Every foreground/background pair must be
contrast-tested before release. Semantic success, warning, and danger states
use an icon and label as well as colour.

### Type and density

- IBM Plex Sans is the proposed product typeface; IBM Plex Mono is reserved for
  scores and compact source metadata.
- Default body text is 16px; dense rows and metadata may use 14px.
- Controls maintain a minimum 44px pointer target.
- Reading content uses a constrained line length.
- Default density is comfortable; evidence comparison rows may be compact.

### Surface rules

- Use three elevation levels only: canvas, primary surface, temporary overlay.
- Use spacing, type, and separators before adding another card border.
- Long narratives, CV content, and evidence remain on mineral-light surfaces.
- Shadows are shallow and limited to overlays; tonal contrast provides normal
  elevation.
- The sidebar is dark, but content is not placed in repeated black cards.

## Component-system decision

Use shadcn/ui with Base UI primitives, Tailwind CSS v4, semantic CSS variables,
and Waypoint-owned composite components.

This choice is not a commitment to shadcn's default visual style. It provides
editable component source and accessible interaction behaviour while Waypoint
owns its tokens, typography, layouts, copy, and product patterns.

Base UI directly and React Aria Components are viable alternatives, but would
require substantially more styling and component assembly. Mantine, Chakra UI,
and Material UI are more visually and architecturally prescriptive and would
replace more of the existing Tailwind/server-component foundation.

Likely primitives include Button, Field, Input, Textarea, Select, Checkbox,
Card, Badge, Alert, Progress, Skeleton, Dialog, Alert Dialog, Dropdown Menu,
Sheet, Tabs, Tooltip, Separator, and Toast. Waypoint retains custom composites
for onboarding, readiness, evidence review, job decisions, requirement matches,
and CV coverage.

## Low-fidelity screen structure

### Onboarding

```text
+----------------+--------------------------------------------------+
| Setup          | Step 2 of 4                                      |
| Done Welcome   | Connect your AI provider                         |
| Now  AI setup  | [ OpenAI ] [ Groq ]                              |
| Next Privacy   | [ API key .................................... ]  |
| Next First data| What is shared and how the key is protected      |
|                | [Back]          [Validate and continue]           |
+----------------+--------------------------------------------------+
```

Use Welcome, AI setup, Privacy, and First data/Ready as four conceptual steps.
Skipping states the precise consequence. The final action finishes onboarding
automatically. Leaving to add a CV or profile data preserves progress and shows
a return-to-setup affordance.

### Home

```text
Good morning, [name]                              [Analyse a job]
One-line workspace status

[Next best step]
Add career evidence so decisions have stronger support  [Add to profile]

Readiness                          Needs attention
Profile: usable                    3 changes to review
CVs: 2 ready                       1 CV needs attention
AI: connected

Recent jobs
Product Designer / Acme       Investigate 72       [Open]
Frontend Engineer / Example   Apply 84             [Open]
```

The next-best action changes with account state. Counts are supporting detail,
not the main outcome.

### Career Profile

```text
Career Profile                    [Add information] [Review (3)]
The evidence Waypoint can use in job decisions

[Overview] [Skills] [Experience] [Projects] [Preferences]

Profile health: Strong foundation / 2 areas need attention

Skills
TypeScript   Advanced   Confirmed   3 evidence items        [Edit]
Research     Working    Confirmed   2 projects               [Edit]
```

Provenance and technical details appear through disclosure, not in the primary
reading layer. Insights and Needs attention are secondary destinations.

### Add and review profile information

```text
Add to Career Profile
[1 Add information] -- [2 Review changes] -- [3 Save to profile]

[Narrative with a concrete example..............................]
0 / 12,000                                      [Create review]

12 proposed / 8 new / 2 updates / 1 duplicate / 1 conflict
[New] [Updates] [Conflicts] [Already known]

[x] Proposed statement / evidence / source / status          [Edit]

10 selected                              [Confirm 10 changes]
```

The flow makes add, review, and confirmation explicit. User-facing copy avoids
internal lifecycle terms such as stage and activate.

### Jobs list

```text
Jobs                                          [Analyse a new job]
[All] [Apply] [Investigate] [Skip]       [Search] [Sort]

Product Designer / Acme
Investigate / 72 / Best CV: Product Design / 2 questions    [Open]
------------------------------------------------------------------
Frontend Engineer / Example
Apply / 84 / Best CV: Engineering / no blockers             [Open]
```

Use a scan-friendly list, not oversized cards. Do not expand this into an
applicant tracking system without a separate product decision.

### New job analysis

```text
Analyse a job
+--------------------------------------+---------------------------+
| Complete job description             | Before analysis           |
| [                                    | Profile: ready            |
|                                      | 2 CVs ready               |
|                                      | AI: connected             |
| ]                                    | What will be shared       |
+--------------------------------------+---------------------------+
                                           [Analyse this job]
```

The preflight panel exposes dependencies without distracting from the single
task. Loading communicates meaningful stages: reading the description,
comparing evidence, and checking CV coverage.

### Job detail

```text
Back to Jobs / Product Designer / Acme                [More] [Re-run]
[Decision] [Requirements] [CV choice]

+ Decision ----------------------+ Score --------------------------+
| INVESTIGATE                    | 72 / 100                        |
| Plain-language summary         | confidence and fallback state  |
+--------------------------------+----------------------------------+

Why it could fit                 What needs investigation
Supported evidence               Blockers and unknowns

Recommended next step: clarify location requirement
[Review requirement] [Add missing profile evidence]

Best CV: Product Design / Coverage 81             [View reasoning]
```

Decision comes first. Requirements and CV reasoning remain inspectable. Unknown
evidence never looks like proven failure, and editing evidence leads to an
explicit re-score with a summary of what changed.

## Delivery sequence

1. Validate the sitemap and wireframes against realistic tasks.
2. Define and contrast-test semantic design tokens.
3. Configure shadcn with Base UI and add only required primitives.
4. Build the responsive shell and navigation.
5. Implement onboarding and Home as the first complete vertical slice.
6. Implement Career Profile and its add/review loop.
7. Add Jobs list, new analysis, and persistent detail experience.
8. Migrate CVs, Application Kit, Settings, authentication, and public pages.
9. Standardize empty, loading, success, warning, error, and recovery states.
10. Run responsive, keyboard, screen-reader, contrast, visual-regression, and
    authenticated end-to-end testing.

## Validation tasks

Prototype testing should ask a user to:

1. Add missing career experience.
2. Correct a proposed claim.
3. Decide whether to pursue a supplied job.
4. Find which CV to use and why.
5. Understand an Unknown requirement.
6. Resume an unfinished setup.
7. Replace or remove an AI key.

Measure task completion, first-click accuracy, time/steps, understanding of
recommendations and evidence states, confidence in the result, and perceived
control of personal data.
