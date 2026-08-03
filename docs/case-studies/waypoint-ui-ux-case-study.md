# Waypoint — UI/UX and Product Design Case Study

> Historical case study: this document describes the earlier private/demo
> milestone and is not the current public-product source of truth. Use
> `docs/LINKEDIN_PROJECT_ANALYSIS.md` for current claims before publishing.

## Portfolio card

**Category:** UX / Product Design / 2026  
**Title:** Waypoint  
**Subtitle:** Personal Career Intelligence Workspace

**Summary:**  
I designed a private career workspace that turns fragmented career information into clear, evidence-based decisions. Waypoint helps users understand their professional profile, compare it with a job description, choose the right CV, and prepare an application without losing control of their personal data.

**Suggested tags:** Product Design · UX Strategy · Information Architecture · Interaction Design · AI UX · Responsive UI · Accessibility

**CTA:** View case study

---

## Hero content

### Product design showcase

# WAYPOINT

## PERSONAL CAREER INTELLIGENCE WORKSPACE

Job applications often involve repeating the same work across CVs, job descriptions, notes, and AI conversations. I designed Waypoint as one connected workspace that understands a user through confirmed career knowledge, explains job fit using evidence, recommends the most suitable CV, and keeps reusable application information ready to copy.

| Timeline | Role | Team |
| --- | --- | --- |
| Iterative personal project · 2026 | Product Designer · UX/UI Designer · Product Owner | Solo project with AI-assisted development |

**Skills:** Product Strategy · User Flows · Information Architecture · Interaction Design · Responsive UI · AI UX · Accessibility · Usability Evaluation

**Suggested CTAs:** Launch guided demo · View development case study · View GitHub

---

## Overview

# FROM REPEATED AI CHATS TO A TRUSTED CAREER SYSTEM.

### What it is

Waypoint is a personal career intelligence workspace. It stores confirmed skills, experience, projects, preferences, eligibility information, CVs, and reusable application answers. It then uses this information to produce explainable job-fit analysis and CV recommendations.

### Problem

General AI chat tools can become familiar with a user over time, but that understanding is difficult to inspect, correct, reuse, or transfer into a dedicated product. Job analysis may also change between repeated prompts, confuse missing evidence with a genuine weakness, or recommend a CV without checking what that document actually communicates.

### Solution

I separated the experience into three clear layers:

1. **Personal knowledge:** what is known and confirmed about the user.
2. **Job intelligence:** how that knowledge compares with a specific opportunity.
3. **CV presentation:** which stored CV communicates the relevant evidence most effectively.

This structure makes the reasoning visible and gives the user control over corrections.

---

## My role

# PRODUCT DIRECTION TO WORKING EXPERIENCE.

I treated Waypoint as both its target user and product owner. My contribution included:

- Defining the original problem from my own repeated job-application workflow.
- Deciding what the product should know, what it should infer, and what always requires confirmation.
- Separating personal knowledge from CV content after identifying that they serve different purposes.
- Designing the application structure, terminology, hierarchy, workflows, states, and visual patterns.
- Reviewing working builds continuously and correcting confusing or misleading interactions.
- Directing AI-assisted implementation while making the final product, privacy, architecture, and UX decisions.
- Testing the personal workspace and the isolated public portfolio demo.

This was an iterative design-and-build process rather than a formal client research project. Product decisions were informed by repeated use of the application on real career tasks and by evaluating failures in the working system.

---

## Key insight

# A CV IS NOT THE USER.

An early version treated the CV as a source for building personal knowledge. During testing, I recognised that this created the wrong mental model.

A user may have several CVs for frontend engineering, product design, UX consulting, or junior full-stack roles. Each CV is a selective presentation of the same person, not the complete source of truth.

The revised model became:

`Confirmed profile → Job-fit analysis → Best CV selection → Tailoring advice`

This made the product easier to understand and improved the quality of its recommendations.

---

## Information architecture

# A WORKFLOW BUILT AROUND REAL APPLICATION TASKS.

### Master Profile

Users add career narratives in natural language. Waypoint structures the content into reviewable knowledge and asks permission before replacing conflicting information.

### Knowledge

Career information is organised into meaningful groups such as:

- Skills and proficiency
- Professional competencies
- Experience and supporting evidence
- Projects
- Career direction
- Preferences and eligibility

The default view prioritises information that influences career decisions. Technical metadata stays hidden unless needed.

### CV Library

CVs remain separate application documents. Each document is parsed into visible sections and content so Waypoint can evaluate what it communicates without treating it as the user’s complete identity.

### Job Analysis

The product first evaluates personal fit using confirmed knowledge. It then compares available CVs, recommends the best starting document, and identifies important information that should be added or emphasised.

### Application Kit

Static details and reusable answers reduce repetitive form filling. Job-specific answers can later be generated from the confirmed profile and selected job.

---

## Interaction design

# KEEP AI VISIBLE, CORRECTABLE, AND UNDER CONTROL.

### Review before trust

AI-generated information is presented as a proposal rather than silently becoming truth. The user can confirm, reject, or correct it.

### Unknown is not a weakness

The interface distinguishes:

- Supported by evidence
- Partially supported
- Unknown
- Conflicting

Missing evidence is described as something to investigate, not proof that the user lacks a capability.

### Editing at the point of confusion

When a job requirement exposes incorrect or missing knowledge, the user can update the relevant record and rerun the analysis. Edit actions were moved directly onto knowledge cards to remove unnecessary accordion interactions.

### Progressive disclosure

Cards show the most useful information at a glance—name, category, level, status, and evidence summary. Internal IDs, timestamps, source-document identifiers, and system behaviour remain outside the main reading flow.

### Clear ownership of actions

The public demo uses a guided overlay. When the tour is active, competing page actions are hidden and keyboard focus moves to the tour’s primary action. This prevents two different “Next” actions from competing for attention.

---

## Visual design

# CALM UI FOR COMPLEX CAREER INFORMATION.

The interface uses a restrained visual system so that evidence and decisions remain more prominent than decoration.

- Indigo identifies primary actions, active navigation, and guided-tour focus.
- Green communicates confirmed or supported information.
- Amber communicates uncertainty or investigation.
- Red is reserved for genuine errors, rejection, or conflict.
- Rounded cards group related content without turning every section into a heavy dashboard.
- Consistent page widths, spacing, headings, and card padding create a stable rhythm.
- Persistent scrollbar behaviour prevents layout shifting between short and long pages.
- Responsive grids move naturally into single-column reading on smaller screens.

---

## Important design iterations

# LEARNING THROUGH THE WORKING PRODUCT.

### 1. Raw records → readable career knowledge

**Problem:** Early cards exposed JSON-like values, database identifiers, timestamps, and empty fields.  
**Change:** I redesigned the screen around career-relevant summaries, skill levels, grouped sections, and optional details.  
**Outcome:** Users can understand the profile at a glance without needing database knowledge.

### 2. Accordion editing → direct editing

**Problem:** Editing required opening a card, finding another edit action, then opening a form.  
**Change:** Each relevant card received a direct Edit action and its own save flow.  
**Outcome:** Corrections became faster and easier to discover.

### 3. Every proposal requires review → exception-based review

**Problem:** Reviewing every extracted CV fact created unnecessary work.  
**Change:** Safe, validated information can activate automatically while conflicts and weak inferences go to an exceptions queue.  
**Outcome:** Human control remains, but attention is focused where judgment is valuable.

### 4. CV as knowledge → CV as presentation

**Problem:** Re-extracting personal knowledge from every CV duplicated records and blurred responsibilities.  
**Change:** The Master Profile became the source of career truth; CVs became separate documents evaluated for job-specific coverage.  
**Outcome:** Multiple career directions and CV variants now fit one coherent model.

### 5. Private prototype → safe portfolio demo

**Problem:** The real product contains private career data and uses a personal AI provider key.  
**Change:** I designed a separate fictional workspace with prepared interactions, guided progression, and no external AI calls.  
**Outcome:** Recruiters can understand the product safely without seeing personal records or consuming API credits.

---

## Key product features

# ONE CONNECTED CAREER WORKFLOW.

- Narrative-based profile building
- Confirmed, editable career knowledge
- Categorised skills with proficiency levels
- Evidence-linked experience and projects
- Multiple CV storage and ATS-style content mapping
- Atomic job-requirement analysis
- Evidence-aware fit scoring
- Best-CV recommendation and tailoring guidance
- Reusable application details and answers
- Private authenticated workspace
- Provider-free fictional portfolio demo
- Six-step guided product walkthrough

---

## Validation and quality

# WHAT I EVALUATED.

I validated Waypoint through repeated task-based use rather than formal large-sample usability testing.

Key checks included:

- Can a user understand what the system knows about them?
- Can incorrect knowledge be corrected without accessing the database?
- Does the interface distinguish missing information from a real mismatch?
- Is job fit evaluated before CV quality?
- Can several CVs represent different career directions?
- Can a public visitor understand the product without instructions?
- Can the demo operate without exposing private data or calling a paid AI service?
- Do page spacing, navigation, states, and action hierarchy remain consistent?

The final public tour was tested end to end across Profile, Knowledge, CVs, Job Analysis, CV Selection, and Application Kit.

---

## Outcome

# A PRIVATE TOOL THAT CAN ALSO EXPLAIN ITSELF PUBLICLY.

Waypoint evolved from a personal experiment into a complete portfolio-ready product:

- Personal knowledge is editable, reviewable, and separate from CVs.
- Job recommendations show evidence, uncertainty, and genuine blockers.
- Multiple CVs can be compared for a specific opportunity.
- Private records are protected behind Supabase authentication.
- Public visitors receive a fictional, guided, zero-AI-cost experience.
- The interface supports both quick scanning and deeper inspection.

The project demonstrates how I approach ambiguous product problems: identify the incorrect mental model, restructure the workflow, test it in a real implementation, and refine the experience until the system becomes understandable and trustworthy.

---

## Reflection

# WHAT I WOULD DO NEXT.

With additional time and users, I would:

- Conduct moderated usability tests with active job seekers.
- Test whether users understand “unknown,” “partial,” and “conflict” without explanation.
- Measure time saved across repeated application forms.
- Add a transparent analysis-history comparison.
- Improve mobile interaction patterns for long evidence lists.
- Introduce optional onboarding paths for different career stages.

---

## Suggested portfolio visuals

Use real screenshots with all private information removed:

1. Hero: job-analysis result beside the knowledge overview.
2. Problem: fragmented workflow diagram—chat, notes, CVs, job descriptions.
3. Information architecture: Profile → Knowledge → Job Fit → CV → Application.
4. Before/after: raw knowledge card versus readable grouped card.
5. Skills: category cards and proficiency bars.
6. Job analysis: supported, unknown, and blocker states.
7. CV decision: best starting CV and tailoring recommendations.
8. Public demo: workspace choice and guided-tour overlay.
9. Responsive examples: desktop and mobile layouts.

## Short interview explanation

“Waypoint started from a problem I experienced personally: ChatGPT understood my career context, but that understanding was hidden inside conversations and was difficult to inspect or reuse reliably. I designed a structured career workspace where personal knowledge is confirmed, job analysis is evidence-based, and CVs are treated as job-specific presentations rather than the source of truth. The most important design decisions were separating those layers, treating missing evidence as unknown instead of failure, and creating a completely isolated fictional demo so the private product could be shown safely.”
