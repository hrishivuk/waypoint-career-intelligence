# Waypoint — Complete Project Analysis and LinkedIn Preparation Brief

**Repository package name:** `ai-career-finder`  
**Current product name:** Waypoint  
**Project type:** Full-stack, AI-assisted career intelligence web application  
**Development context:** Solo personal project, built iteratively with ChatGPT and Codex as engineering collaborators  
**Verified on:** 2 August 2026

## 1. One-sentence description

Waypoint is a private, evidence-grounded career intelligence workspace that builds a confirmed Master Profile, analyses job descriptions requirement by requirement, recommends whether to apply, investigate, or skip, selects the most suitable stored CV, and prepares reusable application information without inventing experience.

## 2. The problem

Job seekers repeatedly move the same information between CVs, job descriptions, notes, application forms, and AI chats. General-purpose AI can become familiar with someone, but that understanding is difficult to inspect, correct, transfer, or use consistently. Conventional CV matchers also over-rely on keyword overlap, confuse missing evidence with missing ability, and can produce recommendations that are difficult to explain.

Waypoint addresses this by separating three concepts:

1. **Master Profile:** confirmed knowledge about the person.
2. **Job intelligence:** an evidence-aware assessment of a particular opportunity.
3. **CV presentation:** how well each CV communicates relevant, already-supported knowledge.

The key product insight is: **a CV is not the user**. A CV is a selective application document. The independent Master Profile is the source of career truth.

## 3. What the product does

### Workspace selection and public demo

- Presents a gateway between a private personal workspace and a public-safe guided showcase.
- Protects personal pages using Supabase authentication and a server-readable, HTTP-only workspace cookie.
- Redirects demo visitors away from personal routes.
- Provides a fictional candidate, prepared CVs, job analysis, and application answers.
- Runs the public demo without Supabase personal-data reads or Groq/OpenAI calls.
- Includes a guided six-step tour across Profile, Knowledge, CVs, Job Analysis, CV Selection, and Application Kit.
- Stores only tour state locally in the visitor's browser.

### Home dashboard

- Explains the three-step Waypoint workflow.
- Displays live counts for confirmed Master Profile records, projects, CV documents, and completed job analyses.
- Provides direct routes to job analysis and knowledge review.
- Links to imported-record review, skill review, and manual profile facts.

### Master Profile and narrative import

- Accepts career information as natural-language narrative rather than requiring a large form.
- Sends bounded narrative input through structured AI extraction.
- Generates reviewable candidates instead of silently treating model output as truth.
- Classifies candidates by reconciliation status, including safe additions, duplicates, and conflicts.
- Lets the user activate an import only after reviewing its proposed effect.
- Supports cumulative imports, allowing the user to add different parts of their background over time.
- Preserves source information and import history.
- Includes a repair endpoint for failed or incomplete import projection.
- Retains a manual-facts workflow for career goals, interests, preferences, deal-breakers, eligibility, skills, experience, achievements, education, and writing style.
- Supports editing, confirmation, and rejection lifecycle operations.

### Knowledge library

- Organises confirmed career information into readable sections.
- Supports searching across skills, projects, experience, preferences, and other facts.
- Shows skill category, proficiency, evidence count, confidence, and relevant summaries.
- Displays professional competencies, projects, experience, career direction, preferences, and eligibility.
- Allows records to be edited directly from the library.
- Separates user-facing career information from internal IDs and technical metadata through progressive disclosure.
- Provides dedicated imported-record, skill-model, exceptions, and insights views.
- Supports reviewing skill taxonomy changes individually or in batches.
- Supports projecting approved review decisions into the canonical model.
- Maintains an exceptions queue for conflicts, weak inferences, or unverifiable records.

### Canonical knowledge model

- Stores stable skill identities separately from changing assessments of proficiency.
- Supports skill aliases, categories, hierarchies, and relationships.
- Represents professional competencies separately from tool or technology skills.
- Links skills and competencies to reusable experience, project, education, and achievement evidence.
- Models career modes, typed preferences, constraints, decision policies, temporary state, historical observations, and uncertainty.
- Uses lifecycle states such as proposed, confirmed, rejected, superseded, stale, and quarantined where applicable.
- Tracks provenance, confidence, source references, validity, review timing, tags, and version information.
- Uses relational and tag-based retrieval; embeddings and a vector database are deliberately excluded from the current design.

### CV library and ATS-style parsing

- Uploads PDF and DOCX CV files.
- Accepts a display name, intended roles, and notes describing when a CV should be used.
- Extracts document text using dedicated PDF and DOCX adapters.
- Normalises line endings and preserves source offsets.
- Detects common CV sections such as summary, experience, education, skills, projects, and certifications.
- Converts visible content into deterministic, source-backed claims.
- Stores the original file metadata, parsed text, sections, claims, parser version, and parse status.
- Marks empty or failed snapshots as unusable so they cannot be recommended.
- Lists stored CVs with parse status and summary metrics.
- Allows CV deletion, including its associated stored document data.
- Keeps CV content separate from Master Profile knowledge; uploading a CV does not redefine the user's identity.

### Job-description analysis

- Accepts a pasted job description and rejects input that is too short for meaningful analysis.
- Uses AI to decompose the description into atomic requirements.
- Captures requirement type, priority, criticality, normalised value, minimum years, source quote offsets, and parser confidence.
- Falls back to a useful deterministic parser if AI parsing fails or quota is unavailable.
- Retrieves a compact, requirement-specific subset of relevant profile knowledge rather than dumping the full profile into a prompt.
- Uses semantic AI comparison to find direct, related, or transferable evidence.
- Requires semantic matches to cite supplied record IDs; unsupported citations are discarded.
- Falls back to deterministic matching if semantic comparison fails.
- Classifies each requirement as supported, partially supported, unknown, or conflicting.
- Distinguishes eligibility, mandatory-core, important, preferred, bonus, and unclear criticality.
- Lets the user correct incorrectly classified criticality and then re-score the result.
- Lets the user add missing knowledge discovered during analysis.
- Allows re-scoring against the latest Master Profile without unnecessarily re-parsing the job.
- Allows an explicit full re-parse when the stored requirement interpretation needs replacement.
- Caches analysis only while the job text and knowledge fingerprint remain unchanged.

### Scoring and recommendation method

- Calculates requirement coverage using importance-weighted outcomes.
- Measures knowledge coverage and evidence confidence separately.
- Assesses eligibility, career-direction alignment, and preference alignment.
- In the current v5 analysis engine, the assessed overall alignment weights are:
  - requirements coverage: 80%;
  - career direction: 15%;
  - preferences: 5%.
- Omits an unavailable alignment component from the denominator instead of pretending it was assessed.
- Returns `apply` when there are no blockers, the score is at least 65, and knowledge coverage is at least 45.
- Returns `investigate` when there is no confirmed blocker but the evidence or threshold is insufficient.
- Returns `skip` when a confirmed eligibility or mandatory-core conflict is present.
- Treats missing evidence as unknown, not proof that the user lacks a skill.
- Exposes strengths, gaps, uncertainties, blockers, confidence, coverage, and semantic-provider status.
- Persists the analysis, atomic requirements, scores, citations, selected CV, provider metadata, and knowledge fingerprint.

### CV recommendation and tailoring

- Ranks ready CVs only after evaluating the person's fit for the job.
- Compares visible CV claims with supported job requirements.
- Considers intended roles and the coverage of important requirements.
- Identifies the strongest starting CV.
- Explains what the selected CV already represents.
- Identifies relevant confirmed knowledge that is missing from the document.
- Produces targeted tailoring suggestions without upgrading or inventing experience.
- Excludes failed and empty CV snapshots from recommendation.

### Application Kit

- Stores reusable application sections and answers.
- Supports static details such as portfolio and LinkedIn links.
- Supports reusable long-form answers such as “Tell us about yourself” and “Why should we hire you?”
- Allows section titles, labels, and values to be edited.
- Provides one-click copy interactions.
- Tracks basic section/item metrics.
- Persists items per user with ownership controls.

## 4. How the intelligence works

The core pipeline is:

`Source → deterministic source blocks → bounded AI extraction → schema validation → canonical knowledge → relevant evidence retrieval → semantic comparison → deterministic scoring`

The division of responsibility is deliberate:

- **AI proposes and interprets.** It extracts candidates, parses ambiguous job language, and identifies semantic or transferable relationships.
- **Application code validates.** Zod schemas, source-block checks, canonical IDs, and candidate-level validation reject malformed or unsupported output.
- **Deterministic rules decide.** Code owns blockers, score aggregation, recommendation thresholds, cache invalidation, and whether evidence is allowed to support a claim.
- **The user owns truth.** Imported personal knowledge must be reviewed or deterministically reconciled before becoming trusted.

This design was adopted after practical failures with large, prompt-heavy workflows: inconsistent JSON, token limits, provider quotas, altered quotations, literal keyword matching, and repeated results that changed without a clear reason.

## 5. Technical architecture

### Domain layer — `src/domain`

Provider-independent business entities and rules: knowledge lifecycle, career modes, evidence, preferences, capabilities, CV artifacts, jobs, scoring, recommendations, and workspace isolation.

### Application layer — `src/application`

Use cases and ports: profile facts, handover parsing/staging/review/projection, narrative import, job analysis contracts, and knowledge-library workflows.

### Infrastructure layer — `src/infrastructure`

Adapters for Supabase/PostgreSQL, Supabase Auth, OpenAI, Groq, PDF/DOCX extraction, deterministic CV parsing, analysis persistence, and server workspace assembly.

### Delivery layer — `src/app` and `src/components`

Next.js App Router pages, server-rendered views, interactive React client components, route handlers, responsive UI, and route protection through the Next.js proxy convention.

### Main technology stack

- Next.js 16.2.11 with App Router and Turbopack
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4
- Supabase/PostgreSQL, Storage, Row Level Security, and Auth
- OpenAI SDK 6.49 with a provider-independent gateway
- Groq using OpenAI-compatible structured inference
- Zod 4 for runtime validation
- PDF.js for PDF extraction
- Mammoth for DOCX extraction
- Vitest 3 for automated testing
- ESLint 9 with Next.js configuration

## 6. Provider and prompt safeguards

- AI provider is selected using `AI_PROVIDER=groq|openai`.
- Separate models can be configured for CV extraction, job parsing, and requirement matching.
- Groq defaults to `openai/gpt-oss-20b`; OpenAI defaults to `gpt-5-mini` when no override is supplied.
- Prompts and schemas are versioned.
- Uploaded documents and job descriptions are treated as untrusted content, preventing instructions embedded in them from controlling the application.
- Exact evidence is reconstructed from source blocks instead of trusting the model to reproduce quotations.
- Structured outputs are validated before use.
- Unsupported record IDs and citations are ignored.
- Model failure is exposed through semantic status and deterministic fallback rather than disguised.
- Personal APIs are never called from the public demo.
- Service-role and provider secrets remain server-only.

## 7. Persistence, privacy, and integrity

- PostgreSQL migrations define users, source documents, profile knowledge, jobs, requirements, analyses, scores, citations, review events, CV systems, narrative imports, and Application Kit data.
- User-owned tables include an owner ID and Row Level Security policies.
- Source documents, source locators, extraction metadata, confidence, and lifecycle status support auditability.
- Database functions provide atomic staging, review, projection, CV registration, profile activation, and archival operations.
- Major intelligence rebuilds are additive and can create immutable archives before derived records are replaced.
- Personal routes require both personal workspace mode and an authenticated Supabase user linked to the private prototype profile.
- The present authentication model is intentionally a single linked personal profile, not a general multi-tenant signup product.

## 8. Important engineering decisions

1. **Hybrid knowledge model:** simple facts remain simple; behaviorally important concepts use typed records.
2. **Explicit career modes:** a job must be assessed in a selected context; content does not silently switch modes.
3. **Deterministic, multi-axis recommendations:** AI does not freely choose the final decision.
4. **Relational retrieval before embeddings:** canonical records, relationships, tags, and evidence links are sufficient for the current workflows.
5. **Proposed before confirmed:** imported information cannot bypass review merely because a model sounds confident.
6. **CVs are presentation artifacts:** CV parsing evaluates visible communication and does not populate personal truth.
7. **Graceful degradation:** provider failure should still return a useful, clearly labelled deterministic result.
8. **Public/private separation:** the portfolio demo is fictional, isolated, and provider-free.

## 9. What is verified as working

The following checks were run against the current repository on 2 August 2026:

- TypeScript: passed (`npm run typecheck`).
- ESLint: passed (`npm run lint`).
- Automated tests: **101 passed across 23 test files** (`npm test`).
- Next.js production build: passed (`npm run build`).
- Build output recognises 42 dynamic pages/API routes plus the route-protection proxy.

Automated coverage includes handover parsing and validation, lifecycle and review rules, import staging and projection, skill-model behavior, document extraction, PDF layout handling, deterministic CV parsing, job analysis and fallback behavior, AI schemas and gateway selection, persistence adapters, workspace isolation, and demo-fixture privacy.

## 10. Honest limitations and current risks

- This is a portfolio-ready personal product, not a production SaaS with open registration and multiple independent customers.
- Authentication is limited to a Supabase account explicitly linked to the private prototype profile.
- A real deployment still requires correct Supabase migrations, storage configuration, auth settings, environment variables, and an AI-provider key.
- The current overall job score is still displayed even though the frozen architecture prefers multi-axis explanation over reliance on one opaque number; the UI should continue to foreground the component evidence.
- Formal usability research with external job seekers has not yet been conducted; validation is primarily repeated first-party task testing.
- There are no stated automated end-to-end browser tests, accessibility audit results, performance budgets, or production monitoring checks in the present verification suite.
- The production build succeeds but prints non-fatal server-side PDF polyfill warnings for `DOMMatrix`, `ImageData`, and `Path2D`. This should be investigated or documented before presenting the build as warning-free.
- The top-level `README.md` and `PROJECT_STATUS.md` describe an older milestone and materially understate current functionality.
- The repository package is still named AI Career Finder while the UI and case studies use Waypoint; naming should be made consistent before public launch.
- The repository is marked `private` in `package.json`; public GitHub visibility, licensing, sanitisation, and deployment status must be decided separately.
- Application Kit content is reusable and editable, but the current code should not be described as a complete AI cover-letter/interview/application-tracking suite.
- The demo uses prepared deterministic data; it demonstrates the workflow, not live AI inference.

## 11. What to complete before posting on LinkedIn

### Must do

- Choose one public name and use it consistently: recommended **Waypoint** with “AI Career Finder” as a descriptive subtitle.
- Rewrite the top-level README to match the current product, screenshots, architecture, setup, demo, privacy model, and verified test count.
- Remove or clearly label historical status documents so visitors do not conclude that major workflows are unfinished.
- Decide whether the GitHub repository will be public. If yes, audit the full Git history and tracked files for personal data, CV content, email addresses, IDs, screenshots, logs, and secrets.
- Add a licence and contribution/contact expectations appropriate for a portfolio project.
- Deploy the public-safe demo and test every tour step in the production environment.
- Confirm the private workspace cannot be accessed by an unauthenticated or demo-mode visitor.
- Verify the demo makes zero AI-provider calls and reads no private Supabase records.
- Capture clean desktop and mobile screenshots using only fictional data.
- Record a short product video showing the problem, Master Profile, job analysis, evidence, CV decision, and Application Kit.
- Investigate the PDF polyfill build warnings and confirm PDF/DOCX upload behavior in the actual deployment runtime.
- Run the complete quality gate once more from a clean checkout before posting.

### Strongly recommended

- Add end-to-end tests for workspace selection, login protection, narrative import, CV upload/delete, job analysis, correction/re-score, and the full demo tour.
- Run an accessibility audit covering keyboard navigation, focus management, labels, contrast, reduced motion, and screen-reader announcements.
- Run responsive checks on common phone, tablet, laptop, and wide desktop sizes.
- Add error monitoring and minimal privacy-safe operational logging for the deployed demo.
- Add Open Graph metadata, favicon/brand artwork, a social preview image, and a clear portfolio CTA.
- Add architecture and workflow diagrams to the README or case study.
- Show one transparent example of a requirement moving through retrieval, semantic interpretation, deterministic validation, and scoring.
- Document AI assistance honestly: what Codex/ChatGPT helped with and which product, architecture, privacy, and acceptance decisions remained yours.
- Ask two or three people to complete the demo without coaching and note where terminology or navigation is unclear.

### Optional next product work

- Analysis history and comparison over time.
- Multi-user onboarding and account lifecycle.
- Privacy export and deletion UX.
- Job/application tracking and outcome feedback.
- Job-specific generated answers, cover letters, and interview preparation grounded in confirmed evidence.
- Mobile refinements for long evidence and requirement lists.
- Evaluation datasets for semantic matching quality and provider comparisons.

## 12. Recommended LinkedIn story structure

Use the post to tell one engineering/product story rather than listing every feature:

1. **Hook:** “A CV is not the user.”
2. **Problem:** career context is fragmented across CVs, notes, job descriptions, forms, and AI conversations.
3. **Insight:** create a confirmed Master Profile, then assess the person first and the CV second.
4. **System:** AI handles bounded interpretation; deterministic code owns validation, evidence, blockers, and final recommendations.
5. **Hard lessons:** unreliable structured output, altered quotations, literal skill matching, token/rate limits, and privacy requirements forced architectural changes.
6. **Result:** a private workspace plus a fictional, zero-AI-cost public demo.
7. **Proof:** 101 tests, TypeScript, lint, and production build pass.
8. **Reflection:** explain what you would validate with real users next.
9. **CTA:** invite feedback on evidence-based AI UX, career tools, or the public demo.

## 13. Short LinkedIn-ready project description

I built **Waypoint**, an evidence-grounded career intelligence workspace that turns confirmed skills, experience, projects, preferences, and eligibility into explainable job decisions.

Instead of treating a CV as the complete source of truth, Waypoint maintains an independent Master Profile. It parses a job description into atomic requirements, retrieves relevant evidence, uses AI for bounded semantic interpretation, and applies deterministic rules to recommend whether to apply, investigate, or skip. It then compares stored CVs, recommends the strongest starting version, and identifies truthful tailoring opportunities.

The project uses Next.js 16, React 19, TypeScript, Supabase/PostgreSQL, Groq/OpenAI-compatible inference, Zod, PDF.js, Mammoth, Tailwind CSS, and Vitest. The current repository passes TypeScript, ESLint, 101 automated tests across 23 files, and a production build.

The most important lesson was learning where AI should stop: models can propose and interpret, but the product must own evidence, validation, permissions, scoring, and final decisions.

## 14. Copy-ready prompt for planning the final LinkedIn launch with ChatGPT

Paste this document into ChatGPT with the following instruction:

> Act as a senior product marketer, technical portfolio reviewer, and LinkedIn content strategist. Use the attached Waypoint project analysis as the factual source of truth. Do not invent users, metrics, production scale, research findings, or features. First identify the strongest positioning for the audiences I want to reach: recruiters, frontend/full-stack engineering teams, product engineering teams, and product/UX design teams. Then create: (1) a gap analysis of what must be completed before publishing, ranked by launch risk and portfolio value; (2) a seven-day execution plan; (3) three LinkedIn post variants—technical, product/UX, and balanced; (4) a carousel outline of no more than ten slides; (5) a 60–90 second demo-video script and shot list; (6) a GitHub README outline; (7) suggested screenshots and captions; (8) honest wording for explaining my use of ChatGPT and Codex; and (9) a final evidence checklist that verifies every public claim against the project. Ask me for my target roles, live demo URL, GitHub visibility, screenshots, and preferred tone before finalising the copy.

## 15. Claims that are safe to make now

- “Built a full-stack evidence-grounded career intelligence application.”
- “Designed and implemented a private workspace and isolated public demo.”
- “Used AI for structured extraction and semantic interpretation, with deterministic validation and scoring.”
- “Implemented PDF/DOCX CV parsing, job-requirement analysis, CV recommendation, and reusable application content.”
- “Used Next.js, React, TypeScript, Supabase/PostgreSQL, Groq/OpenAI-compatible inference, Zod, and Vitest.”
- “101 automated tests across 23 test files pass.”
- “Type checking, linting, and the production build pass.”
- “Developed solo with ChatGPT and Codex as engineering collaborators.”

## 16. Claims to avoid unless additional evidence is collected

- “Production-ready SaaS.”
- “Used by job seekers” or any user count.
- “Improves hiring outcomes,” “increases interview rate,” or “saves X hours.”
- “Bias-free,” “hallucination-free,” or “100% accurate.”
- “Fully accessible” without an audit.
- “Secure” as an absolute; describe the implemented controls instead.
- “Complete career platform” if referring to tracking, cover letters, interviews, or outcome learning.
- “AI chooses the best career” or “AI makes the final decision.”
- “Live AI demo” when showing the prepared public showcase.
