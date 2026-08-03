# Waypoint — AI-Assisted Development Case Study

> Historical case study: this document describes the earlier private/demo
> milestone and is not the current public-product source of truth. Use
> `docs/LINKEDIN_PROJECT_ANALYSIS.md` for current claims before publishing.

## Portfolio card

**Category:** AI Engineering / Full-Stack Development / 2026  
**Title:** Waypoint  
**Subtitle:** Evidence-Grounded Career Intelligence Platform

**Summary:**  
I built a full-stack career intelligence platform that converts confirmed career knowledge into explainable job-fit decisions and CV recommendations. The system combines deterministic business rules, replaceable AI providers, structured validation, Supabase persistence, private authentication, and a provider-free public demo.

**Suggested tags:** Next.js · TypeScript · React · Supabase · Groq · Zod · AI Integration · System Architecture · Testing

**CTA:** View development case study

---

## Hero content

### AI-assisted engineering showcase

# WAYPOINT

## EVIDENCE-GROUNDED CAREER INTELLIGENCE

Waypoint is a full-stack application that structures personal career knowledge, evaluates job descriptions requirement by requirement, recommends the most suitable stored CV, and prepares reusable application content. AI supports extraction and semantic interpretation, while deterministic application code owns validation, evidence, scoring, permissions, and final decisions.

| Timeline | Role | Build |
| --- | --- | --- |
| Iterative personal project · 2026 | Product Owner · Full-Stack Developer · AI Systems Designer | Solo, developed with Codex and ChatGPT as engineering collaborators |

**Technology:** Next.js 16 · React 19 · TypeScript · Supabase · PostgreSQL · Groq · OpenAI-compatible SDK · Zod · Vitest · Tailwind CSS

**Suggested CTAs:** Launch guided demo · View GitHub · View UX case study

---

## Overview

# TURNING AI OUTPUT INTO A RELIABLE PRODUCT.

### What it is

Waypoint is a private career intelligence application with five connected capabilities:

1. Build a confirmed career profile from narrative information.
2. Store canonical skills, competencies, experience, projects, preferences, and evidence.
3. Parse job descriptions into atomic requirements.
4. Compare requirements with relevant evidence and calculate an explainable fit.
5. Select the best stored CV and identify targeted improvements.

### Engineering problem

An early implementation relied too heavily on large AI prompts. This caused schema failures, rate-limit errors, inconsistent semantic matching, invented source quotes, repeated results that changed, and excessive review work.

### Engineering solution

I rebuilt the pipeline around a strict responsibility boundary:

`Source → deterministic blocks → AI extraction → validation → canonical knowledge → evidence retrieval → AI comparison → deterministic scoring`

AI performs bounded inference. Application code owns truth and decisions.

---

## My contribution and use of AI

# AI-ASSISTED, HUMAN-DIRECTED DEVELOPMENT.

I used Codex and ChatGPT throughout development for implementation support, debugging, architecture critique, test generation, and documentation. I remained responsible for:

- Defining the product requirements and changing them when the working model was wrong.
- Approving the data model, security model, privacy boundaries, and provider strategy.
- Evaluating failures using real application outputs.
- Choosing which AI suggestions to accept, reject, or redesign.
- Running migrations and testing workflows against the live development database.
- Directing major rebuilds instead of continuing with unreliable prompt patches.
- Confirming the final personal and public experiences.

This project demonstrates AI-assisted development as an engineering workflow—not prompt-to-app generation. The final system emerged through iterative diagnosis, architecture changes, migrations, tests, and product decisions.

---

## Architecture

# PROVIDER-INDEPENDENT BY DESIGN.

### Domain layer

Contains business entities, knowledge states, scoring concepts, and deterministic rules. It does not depend on Groq, OpenAI, Supabase, or the UI.

### Application layer

Contains use cases and ports for profile import, knowledge review, CV management, extraction, and job analysis.

### Infrastructure layer

Implements replaceable adapters for:

- Supabase/PostgreSQL persistence
- Supabase Storage
- Supabase Auth
- Groq structured inference
- Optional OpenAI-compatible inference
- PDF and DOCX extraction

### Delivery layer

Next.js App Router provides server-rendered pages, client interactions, route handlers, middleware-style proxy protection, and responsive UI.

This separation allows AI providers or UI implementations to change without rewriting the career domain.

---

## Intelligence pipeline

# SMALL CAPABILITIES, STRONG VALIDATION.

### 1. Deterministic document processing

PDF and DOCX content is extracted before AI inference. Documents are represented as ordered source blocks so evidence can be copied from the original source instead of asking a model to reproduce exact quotes.

### 2. Structured AI extraction

Groq receives bounded content and a strict schema. It proposes structured candidates and source-block references rather than writing directly to the database.

### 3. Candidate-level validation

Each candidate is independently validated. One malformed or unsupported claim is quarantined without destroying the valid remainder of an extraction run.

### 4. Canonical knowledge

Skills, competencies, experience, projects, preferences, and eligibility remain separate concepts. Aliases and relationships support semantic variants such as React and React 19 without pretending that a skill name proves years of commercial experience.

### 5. Relevant evidence retrieval

The matcher does not send the entire personal profile to the model. It retrieves a small set of relevant canonical skills, relationships, projects, experience, and evidence for each requirement.

### 6. Semantic comparison

AI can identify transferable or related evidence, but accepted results must cite supplied record IDs. Unsupported citations are discarded.

### 7. Deterministic scoring

Application code calculates coverage, confidence, career alignment, preferences, eligibility, and overall fit. Missing evidence becomes unknown; it does not automatically become a blocker.

---

## Major engineering challenges

# FAILURES THAT CHANGED THE SYSTEM.

### Unreliable structured JSON

**Failure:** Groq occasionally returned arrays where objects were required, omitted fields, or reached output limits.  
**Resolution:** Capabilities were reduced into smaller requests with strict schemas, bounded batches, validation, retries, and useful deterministic fallbacks. Provider failure is surfaced rather than disguised as equivalent semantic analysis.

### Invented or altered source quotes

**Failure:** Model-generated evidence differed from PDF text because of punctuation, whitespace, or ligature changes. Exact string matching rejected the extraction.  
**Resolution:** The application now owns source evidence. AI returns block identifiers; exact evidence is reconstructed deterministically.

### Literal skill matching

**Failure:** Requirements such as React 19, AI-native workflows, ambiguity, or cross-functional collaboration were missed even when related evidence existed.  
**Resolution:** The knowledge model gained canonical skills, aliases, hierarchy, relationships, competency evidence, context, and proficiency. Requirement-specific retrieval supplies relevant evidence for semantic comparison.

### Token and rate limits

**Failure:** Large profile dumps exceeded Groq token-per-minute or daily limits.  
**Resolution:** Requests use smaller capabilities, compact relevant evidence, batching, provider metadata, deterministic fallback, and no AI calls in the public demo.

### Ambiguous database relationships

**Failure:** Supabase/PostgREST found multiple relationships between CV versions and documents.  
**Resolution:** Queries now specify explicit foreign-key relationships instead of relying on ambiguous embedding.

### PDF worker incompatibility

**Failure:** Server-side PDF extraction attempted to load an unavailable browser worker in the Next.js build.  
**Resolution:** The document extraction adapter was changed for the server runtime and separated from AI processing.

### Evolving CV responsibility

**Failure:** Extracting personal knowledge from every uploaded CV duplicated information and created a heavy review flow.  
**Resolution:** CV processing was rebuilt as deterministic ATS-style document mapping. The canonical profile owns personal knowledge; CVs are evaluated only for visible job-specific coverage.

---

## Data integrity and lifecycle

# AI NEVER WRITES TRUST DIRECTLY.

Knowledge follows explicit lifecycle rules:

- Proposed
- Confirmed or automatically activated after deterministic validation
- Corrected
- Rejected
- Quarantined when conflicting or unverifiable

Important safeguards include:

- Immutable source documents
- Exact source blocks and hashes
- Canonical IDs
- Duplicate detection and deterministic merging
- Evidence-backed skill and competency links
- Versioned prompts, schemas, models, and pipelines
- Knowledge fingerprints for analysis reproducibility
- Archive migrations before major rebuilds

This keeps generated content traceable and allows the system to explain why a decision was made.

---

## Job-analysis model

# EXPLAINABLE MATCHING IN TWO STAGES.

### Stage 1: Is this role suitable for the person?

Job descriptions are decomposed into atomic requirements with:

- Requirement type
- Criticality
- Explicit or inferred importance
- Skill or concept
- Experience or proficiency threshold
- Context
- Parser confidence

Each requirement is classified as:

- Supported
- Partially supported
- Unknown
- Conflicting

Only explicit eligibility conflicts or strongly evidenced mandatory mismatches become blockers.

### Stage 2: Which CV should represent the person?

Stored CVs are ranked using:

- Intended roles
- Relevant visible skills
- Represented projects and evidence
- Requirement importance
- Missing high-value knowledge

The output includes the best starting CV, why it is strongest, and specific tailoring recommendations.

---

## Privacy and security

# PRIVATE BY DEFAULT, DEMONSTRABLE BY DESIGN.

### Personal workspace

- Supabase email/password authentication
- Auth users explicitly linked to owned profile records
- Server-side identity validation
- HTTP-only workspace mode cookie
- Service-role credentials remain server-only
- Personal CVs, career knowledge, and analyses remain inaccessible to demo visitors

### Public showcase

- Fictional candidate and prepared data
- No Supabase personal-data access
- No Groq or OpenAI calls
- Route-level separation from personal pages
- Browser-local tour state only
- Guided six-step walkthrough

The public experience demonstrates the workflow without exposing private data or consuming personal API credits.

---

## Testing and verification

# ENGINEERING CONFIDENCE BEYOND THE HAPPY PATH.

The project includes **101 automated tests across 23 test files**, covering areas such as:

- Handover parsing and schema validation
- Knowledge lifecycle rules
- Import staging and projection
- Skill-model behaviour
- Document extraction
- Deterministic CV parsing
- Job-analysis scoring and matching
- Groq gateway behaviour
- Workspace isolation
- Demo fixture privacy

Every completed release is checked with:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The final feature branch passed TypeScript, ESLint, all 101 tests, and a Next.js production build before merge.

---

## Key technical features

# PRODUCTION-MINDED FOUNDATIONS.

- Modular domain/application/infrastructure architecture
- Provider-independent AI capability boundary
- Groq structured output integration
- Zod input and output validation
- Evidence-aware canonical knowledge graph
- Deterministic scoring and blocker policy
- PDF and DOCX document processing
- ATS-style CV mapping
- Supabase PostgreSQL persistence
- Supabase Storage for private documents
- Supabase SSR authentication
- Ownership-aware API routes
- Responsive Next.js App Router UI
- Provider-free fictional demo workspace
- Accessible guided product tour
- Automated unit and integration tests

---

## Outcome

# FROM UNSTABLE PROMPTS TO AN EXPLAINABLE SYSTEM.

The final application:

- Maintains a confirmed and editable career profile.
- Separates knowledge, job requirements, evidence, and CV presentation.
- Produces repeatable deterministic scores around bounded AI inference.
- Handles unknown evidence without creating false blockers.
- Recommends the best CV only after assessing personal fit.
- Protects the private workspace through real authentication.
- Provides a safe public demonstration without provider cost.
- Passes a production build and a 101-test automated suite.

The strongest outcome is not simply that AI was integrated. It is that AI was placed inside a controlled system where its output can be validated, corrected, traced, replaced, or ignored.

---

## Reflection

# WHAT I LEARNED.

- Large prompts can appear productive while hiding fragile architecture.
- Structured output is only useful when application code validates meaning and evidence.
- Retrieval quality matters more than sending every known fact to a model.
- Missing evidence and negative evidence must be different states.
- Provider limits are product constraints and should influence system design.
- A public AI demo should not depend on a personal paid API key.
- AI coding tools accelerate implementation, but product ownership still requires persistent evaluation and deliberate decisions.

### Future improvements

- Provider-level observability dashboard for cost, latency, retries, and fallbacks
- Embedding-assisted retrieval behind the existing retrieval interface
- Broader regression fixture set across job families
- Analysis-history comparison between knowledge versions
- End-to-end browser tests for authenticated and demo flows
- Production deployment monitoring and privacy review

---

## Suggested portfolio visuals

1. Architecture diagram showing deterministic core and replaceable AI/persistence adapters.
2. Intelligence pipeline from source blocks to scoring.
3. Knowledge entity diagram: skills, competencies, evidence, experience, and CV links.
4. Job-analysis output with evidence and unknown states.
5. CV ranking and tailoring output.
6. Supabase authentication flow.
7. Personal versus public workspace isolation diagram.
8. Test-suite terminal output showing 101 passing tests.
9. Git history or selected migrations showing iterative rebuilds.
10. Guided public demo screen.

## Short interview explanation

“I used AI extensively while developing Waypoint, but I did not allow AI to define truth inside the product. Early versions exposed the usual weaknesses: malformed JSON, invented quotes, literal matching, and token limits. I responded by redesigning the system around deterministic source blocks, canonical knowledge, bounded AI capabilities, evidence retrieval, Zod validation, and deterministic scoring. Codex and ChatGPT accelerated implementation and debugging, while I owned the product requirements, architecture decisions, testing, privacy model, and final acceptance.”
