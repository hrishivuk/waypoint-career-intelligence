# AI Career Finder — Project Report

**Status date:** 24 July 2026  
**Current stage:** Foundation and manual Career Intelligence Profile complete  
**Next stage:** Personal knowledge, ChatGPT handover, and CV import

## 1. What we are building

This project is a personal AI career coach. Its purpose is not only to compare
keywords from a CV and job description. It should understand:

- what work genuinely interests the user;
- career direction, ambitions, preferences, and deal-breakers;
- eligibility constraints such as location, visa, availability, and salary;
- verified skills, experience, projects, and achievements;
- the purpose and strengths of each CV version;
- the user's preferred writing and decision-making style;
- patterns from previous job decisions, applications, and feedback.

For each job, the completed system should recommend whether to **apply**,
**investigate further**, or **skip**. It should explain the recommendation,
select the most appropriate CV, identify necessary changes, and prepare the
next application steps without inventing experience.

## 2. How the system is designed

The user's confirmed profile and supporting evidence are the source of truth.
OpenAI is used to extract, organise, compare, and reason over that information;
the model is not allowed to silently create new career facts.

Personal information has three possible states:

- **Proposed:** extracted or inferred and waiting for review.
- **Confirmed:** accepted by the user and available as trusted evidence.
- **Rejected:** explicitly marked incorrect or unsuitable.

The application is separated into four layers:

1. **Domain:** career concepts, evidence rules, and deterministic scoring.
2. **Application:** workflows such as creating profile facts and analysing jobs.
3. **Infrastructure:** Supabase, OpenAI, storage, and identity integrations.
4. **UI/API:** replaceable screens and HTTP endpoints.

This separation allows the minimal UI to be redesigned later without rewriting
the database, career logic, or AI workflows.

## 3. What is complete and working

### Application foundation

- Next.js and TypeScript application runs locally.
- Environment configuration supports OpenAI and Supabase securely.
- OpenAI and Supabase credentials are detected successfully.
- Production compilation, TypeScript checks, and lint checks pass.
- A health endpoint reports whether services are configured without exposing
  secret values.

### Database and privacy foundation

- Supabase is connected and its initial migration has been applied.
- The database can store users, documents, CV versions, profile facts, jobs,
  parsed requirements, analyses, dimension scores, and evidence citations.
- Private document storage and ownership policies are defined.
- Every user-owned database record includes an owner identifier.
- The current prototype uses one fixed user behind a replaceable identity
  adapter. Supabase Auth can replace it before a public beta.

### Career Intelligence Profile

- The `/profile` page loads and reads from the real Supabase database.
- Users can manually record:
  - career goals;
  - interests;
  - preferences;
  - deal-breakers;
  - eligibility constraints;
  - skills;
  - experience;
  - achievements and evidence;
  - education;
  - writing style.
- Manual facts are treated as confirmed user input.
- Facts can be edited.
- Future AI-proposed facts can be confirmed or rejected.
- Facts are grouped into understandable categories.
- Empty, loading, saving, retry, validation, and error states are implemented.

### AI foundation

- The OpenAI Responses API integration is prepared.
- Model selection is controlled through environment configuration.
- Structured schemas exist for:
  - extracting facts from CV text;
  - parsing job descriptions.
- Extracted information includes confidence and source text locations.
- Prompts treat CVs and job descriptions as untrusted content so instructions
  hidden inside uploaded documents cannot control the application.
- OpenAI response storage is disabled in the current adapter.
- No live AI extraction workflow has been exposed through the UI yet.

### Job-decision foundation

- Six scoring dimensions are implemented:
  - eligibility;
  - requirements;
  - context;
  - impact;
  - preferences;
  - communication.
- Scores are calculated using versioned deterministic rules.
- AI may map requirements to evidence, but it does not freely invent the final
  score.
- Mandatory eligibility gaps can become blockers.
- Low-confidence or missing evidence is reported as uncertainty.
- The decision engine can return `apply`, `investigate`, or `skip`.
- Only confirmed profile facts are allowed to support an analysis.

### Verification

- 16 automated tests currently pass.
- Tests cover scoring, confirmed-evidence filtering, job-analysis orchestration,
  profile validation and lifecycle rules, and AI schemas.
- The production build passes.

## 4. What is not implemented yet

The foundations below exist, but these user workflows are not complete:

- uploading and extracting text from PDF/DOCX CVs;
- importing a Career Coach Handover from ChatGPT;
- reviewing a large batch of imported facts;
- managing multiple CV files and explaining when each should be used;
- pasting a job description through a working analysis screen;
- estimating genuine personal interest in a job;
- running the complete job scoring workflow against Supabase;
- recommending the best CV for a role;
- recommending or generating CV changes;
- generating skills summaries and tailored experience bullets;
- cover-letter generation;
- interview preparation;
- application tracking and feedback learning;
- public authentication, multiple users, export, and deletion workflows;
- polished final UI.

## 5. Personalisation strategy

An OpenAI API key does not transfer ChatGPT history, saved memories, custom
instructions, or the understanding developed in an existing ChatGPT account.
The application must receive that knowledge explicitly.

The recommended personalisation sources are:

1. A structured **Career Coach Handover** produced by the user's long-running
   ChatGPT conversation.
2. Current and previous CV versions.
3. Notes describing the purpose of each CV.
4. Examples of jobs the user liked, rejected, or felt uncertain about.
5. Examples of good and bad CV changes or application writing.
6. Portfolio, project, education, and certification material.
7. Later feedback on the application's recommendations.

The application should not blindly trust or permanently store an entire chat
export. Import should follow this flow:

1. Upload or paste selected source material.
2. Extract proposed facts, preferences, rules, and evidence.
3. Show the proposals grouped by category.
4. Let the user edit, confirm, or reject them.
5. Promote only confirmed items into the trusted profile.
6. Preserve the source and confidence for future explanation.

## 6. Information to request from ChatGPT

The Career Coach Handover should contain:

- current career situation;
- short-term and long-term goals;
- attractive roles, industries, companies, and responsibilities;
- disliked work and deal-breakers;
- location, visa, salary, availability, and travel constraints;
- preferred company stage, culture, team, and working arrangement;
- technical and non-technical skills;
- verified employment, project, and achievement evidence;
- strengths, weaknesses, and intended learning areas;
- the user's method for judging job descriptions;
- patterns from jobs previously liked or rejected;
- rules for choosing between CV versions;
- preferred CV, cover-letter, and communication style;
- relevant personal context;
- uncertain or potentially outdated information.

Important entries should state whether they were explicitly provided or
inferred, their confidence, and any available supporting context. Markdown is
the preferred initial format because it is readable by both the user and the
importer we will build.

## 7. Remaining implementation phases

### Phase 3 — Personal knowledge and CV import

- Upload ChatGPT handover and CV documents.
- Extract text and structured proposed facts.
- Add a batch-review and confirmation workflow.
- Build the CV library and reusable evidence catalogue.

### Phase 4 — Job-description analysis

- Add the JD input and parsing workflow.
- Compare requirements with confirmed evidence.
- Calculate interest, eligibility, fit, uncertainty, and blockers.
- Save and display explained recommendations.

### Phase 5 — CV selection and application strategy

- Rank existing CVs for the selected job.
- Explain which CV should be used and why.
- Identify required changes and evidence gaps.
- Produce the application action plan.

### Phase 6 — Writing tools

- Generate truthful CV summaries, skills sections, and experience bullets.
- Generate cover-letter drafts.
- Preserve the user's confirmed writing style.
- Require approval before overwriting or exporting documents.

### Phase 7 — Interview and workflow support

- Generate interview preparation from the job and confirmed profile.
- Track saved jobs, applications, decisions, and outcomes.
- Learn from explicit feedback while keeping inferred preferences reviewable.

### Phase 8 — Product hardening and final UI

- Add Supabase Auth and multi-user isolation.
- Add privacy export/deletion and retention controls.
- Expand model evaluations, security tests, and observability.
- Replace the minimal interface with the final designed UI without changing
  the domain, database, or application contracts.

## 8. Immediate next step

Before implementing Phase 3, collect the Career Coach Handover and CV material.
Review the handover yourself and remove unrelated or overly sensitive content.
Once provided, it will be used to finalise the import format and the detailed
personalisation rules before writing the importer.

