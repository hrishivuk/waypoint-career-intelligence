---
format: waypoint-career-handover
version: "1.1"
generated_at: 2026-07-24T15:02:33+01:00
subject: user
generator: ChatGPT
---


# Stable facts

```yaml
type: stable_fact
id: fact-education-msc-tud
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: 'Career history summary: MSc completed at TU Example City with First Class Honours'
  basis: mixed
category: education
statement: Completed an MSc in Creative Digital Media and UX at Example University with First Class Honours.
evidence_refs:
- evidence-education-msc-tud
tags:
- education
- ux
- tuexample-city
```

```yaml
type: stable_fact
id: fact-education-btech-cse
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: 'Career history summary: B.Tech Computer Science and Engineering'
  basis: mixed
category: education
statement: Completed a B.Tech in Computer Science and Engineering.
evidence_refs:
- evidence-education-btech
tags:
- education
- computer-science
```

```yaml
type: stable_fact
id: fact-employment-frontend-experience
status: proposed
confidence: medium
criticality: important
provenance:
  source_type: chat
  source_ref: Repeated CV and job-search discussions describing nearly three years of frontend experience
  basis: mixed
category: employment
statement: Has substantial professional frontend-development experience across Northstar Systems, Example Product Studio, and freelance work; exact total duration requires date reconciliation.
evidence_refs:
- evidence-employment-northstar-associate
- evidence-employment-pixel-forge
- evidence-employment-freelance
tags:
- frontend
- employment
```

```yaml
type: stable_fact
id: fact-eligibility-stamp-1g
status: proposed
confidence: high
criticality: critical
provenance:
  source_type: chat
  source_ref: User confirmed holding example graduate work permission in late June 2026
  basis: explicitly_stated
category: eligibility
statement: example graduate work permission permission was confirmed as held in late June 2026. Current validity and factual expiry are unknown and must not be assumed.
tags:
- example-country
- work-authorisation
- visa
```

```yaml
type: stable_fact
id: fact-location-example-city
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: 'Repeated job-search and CV discussions: based in Example City, Example Country'
  basis: explicitly_stated
category: other
statement: Based in Example City, Example Country.
tags:
- location
- example-city
- example-country
```

```yaml
type: stable_fact
id: fact-career-goal-product-frontend
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Repeated career-planning discussions through July 2026
  basis: explicitly_stated
category: career_goal
statement: Long-term career direction combines frontend engineering, UX, product design, and product-building work.
tags:
- career-goal
- frontend
- ux
- product
```

```yaml
type: stable_fact
id: fact-interest-product-building
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Portfolio, FlexSave, Project Atlas, and startup-product discussions
  basis: explicitly_stated
category: interest
statement: Enjoys building digital products from early ideas through design and implementation.
tags:
- product-building
- design
- development
```

```yaml
type: stable_fact
id: fact-backend-positioning
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: User clarified that backend work is mostly AI-assisted and not professional backend experience
  basis: explicitly_stated
category: technology
statement: Has basic backend understanding and has built integrations with AI coding assistance, but should not be represented as having professional backend-engineering experience.
tags:
- backend
- positioning
- accuracy
```


# Career modes

```yaml
type: career_mode
id: primary-career
status: proposed
confidence: high
criticality: important
provenance:
  source_type: other
  source_ref: Waypoint approved mode content in v1.1 regeneration prompt
  basis: documented
name: Primary Career
purpose: Build a long-term career combining frontend engineering, UX, product design, and product thinking.
priority: 1
target_role_families:
- role: Frontend Engineer
  priority: 1
- role: Product Engineer
  priority: 2
- role: UX Engineer
  priority: 3
- role: Product Designer
  priority: 4
- role: UX Designer
  priority: 5
- role: UI Designer
  priority: 6
prohibited_role_families: []
active: true
tags:
- primary-career
```

```yaml
type: career_mode
id: temporary-income
status: proposed
confidence: high
criticality: important
provenance:
  source_type: other
  source_ref: Waypoint approved mode content in v1.1 regeneration prompt
  basis: documented
name: Temporary Income
purpose: Professional office-based income while the primary career search continues.
priority: 2
target_role_families:
- role: Trust and Safety
  priority: 1
- role: Operations
  priority: 2
- role: Business Support
  priority: 3
- role: Digital Analyst
  priority: 4
- role: Technical Support
  priority: 5
- role: Quality Assurance
  priority: 6
- role: Non-sales Customer Success
  priority: 7
- role: Other professional office or technology-adjacent work
  priority: 8
prohibited_role_families:
- Retail
- Restaurants
- Supermarkets
- Shops
- Warehouse work
- Delivery work
- Caretaking
- Manual labour
active: true
tags:
- temporary-income
- office-work
```


# Preferences and constraints

```yaml
type: preference
id: preference-location-example-country
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Repeated job-search discussions
  basis: explicitly_stated
mode: primary-career
subject: work_location
value: Example Country
strength: strongly_preferred
reason: The user is based in Example City and is actively targeting the Irish market.
tags:
- location
- example-country
```

```yaml
type: preference
id: preference-remote-worldwide
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: User repeatedly stated openness to EU and remote work
  basis: explicitly_stated
mode: primary-career
subject: remote_scope
value: Worldwide remote roles
strength: preferred
reason: The user is open to remote opportunities beyond Example Country when legally and operationally feasible.
tags:
- remote
```

```yaml
type: preference
id: preference-work-arrangement
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Career preference discussions indicating hybrid preference over fully remote
  basis: inferred
mode: primary-career
subject: work_arrangement
ordered_values:
- value: Hybrid
  rank: 1
- value: Onsite
  rank: 2
- value: Remote
  rank: 3
strength: preferred
reason: The user has generally shown greater interest in hybrid or onsite collaboration than fully remote work.
tags:
- work-arrangement
```

```yaml
type: preference
id: preference-startup-environment
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Repeated interest in startup, founding, and product-engineering roles
  basis: inferred
mode: primary-career
subject: company_environment
value: Startup or product-led environment
strength: preferred
reason: The user is attracted to ownership, product impact, and broad contribution.
tags:
- startup
- product-led
```

```yaml
type: preference
id: preference-meaningful-product-work
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Repeated statements about preferring creative and meaningful product work
  basis: explicitly_stated
mode: primary-career
subject: work_content
value: Meaningful product-building work
strength: strongly_preferred
reason: The user prefers work that combines problem solving, design, implementation, and visible product impact.
tags:
- meaningful-work
- product
```

```yaml
type: preference
id: preference-pure-backend
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: User prefers frontend and creative product work and plans to learn backend later
  basis: inferred
mode: primary-career
subject: role_focus
value: Pure backend-only work
strength: undesirable
reason: The user's present strengths and interests are more aligned with frontend, UX, and product work.
tags:
- backend
- role-focus
```

```yaml
type: preference
id: constraint-temporary-office-work
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: 21 July 2026 temporary-role discussion
  basis: explicitly_stated
mode: temporary-income
subject: temporary_work_setting
value: Professional office or technology-adjacent work
strength: required
reason: The temporary job should provide income without returning to shop, retail, or unrelated manual work.
tags:
- temporary-income
- office-work
```

```yaml
type: preference
id: constraint-no-retail
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: 21 July 2026 temporary-role discussion
  basis: explicitly_stated
mode: temporary-income
subject: job_family
value: Retail
strength: prohibited
reason: The user explicitly does not want to return to retail work.
tags:
- temporary-income
- prohibited
```

```yaml
type: preference
id: constraint-no-restaurant-work
status: proposed
confidence: high
criticality: important
provenance:
  source_type: other
  source_ref: Waypoint approved temporary-income mode content
  basis: documented
mode: temporary-income
subject: job_family
value: Restaurants
strength: prohibited
reason: Restaurant work is outside the approved temporary-income strategy.
tags:
- temporary-income
- prohibited
```

```yaml
type: preference
id: constraint-no-warehouse-work
status: proposed
confidence: high
criticality: important
provenance:
  source_type: other
  source_ref: Waypoint approved temporary-income mode content
  basis: documented
mode: temporary-income
subject: job_family
value: Warehouse work
strength: prohibited
reason: Warehouse work is outside the approved temporary-income strategy.
tags:
- temporary-income
- prohibited
```

```yaml
type: preference
id: preference-consumer-products
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Portfolio and sector-preference discussions
  basis: explicitly_stated
mode: primary-career
subject: product_domain
value: Consumer digital products
strength: preferred
reason: The user has shown recurring interest in consumer apps and engaging interactive products.
tags:
- consumer-products
```

```yaml
type: preference
id: preference-sportstech
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Project Atlas, FindAside, and portfolio sector discussions
  basis: explicitly_stated
mode: primary-career
subject: industry
value: Sports technology
strength: preferred
reason: The user has relevant projects and personal interest in sports-related digital products.
tags:
- sportstech
```


# Decision policies

```yaml
type: decision_policy
id: policy-evidence-integrity
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Repeated instruction to keep applications and CVs truthful
  basis: explicitly_stated
policy_type: evidence-integrity
rule: Never invent, exaggerate, or imply experience, evidence, outcomes, or capability that is not supported.
enforcement: hard_rule
task_scopes:
- job_analysis
- cv_selection
- cv_rewrite
- cover_letter
- interview_preparation
- career_coaching
priority: 1
decision_key: evidence_supported
operator: equals
condition_value: false
effect: block
exceptions: []
tags:
- truthfulness
- evidence
```

```yaml
type: decision_policy
id: policy-backend-positioning
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: User clarification about AI-assisted backend work
  basis: explicitly_stated
policy_type: representation
rule: Do not present AI-assisted backend integrations as professional backend-engineering experience.
enforcement: hard_rule
task_scopes:
- job_analysis
- cv_selection
- cv_rewrite
- cover_letter
- interview_preparation
priority: 2
decision_key: backend_experience_claim
operator: equals
condition_value: professional_backend_engineering
effect: block
exceptions: []
tags:
- backend
- truthfulness
```

```yaml
type: decision_policy
id: policy-role-alignment
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Repeated job-description evaluation workflow
  basis: explicitly_stated
policy_type: career-fit
rule: Evaluate opportunities primarily against the active career mode and its ordered role families.
enforcement: model_guidance
task_scopes:
- job_analysis
- career_coaching
priority: 10
decision_key: career_mode_alignment
effect: guidance_only
tags:
- job-analysis
- career-mode
```

```yaml
type: decision_policy
id: policy-wishlist-vs-blocker
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Repeated request to distinguish essential requirements from employer wish lists
  basis: explicitly_stated
policy_type: requirement-interpretation
rule: Distinguish genuine blockers from preferred or wishlist requirements before rejecting a role.
enforcement: model_guidance
task_scopes:
- job_analysis
- career_coaching
priority: 11
decision_key: requirement_classification
effect: guidance_only
tags:
- requirements
- job-analysis
```

```yaml
type: decision_policy
id: policy-transferable-evidence
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Job-analysis discussions across frontend, UX, product, and office-tech roles
  basis: explicitly_stated
policy_type: transferability
rule: Credit relevant transferable experience when direct title matching is absent, while clearly labelling the transfer.
enforcement: model_guidance
task_scopes:
- job_analysis
- cv_selection
- cv_rewrite
- cover_letter
- interview_preparation
priority: 12
decision_key: transferable_evidence
effect: guidance_only
tags:
- transferable-skills
```

```yaml
type: decision_policy
id: policy-realistic-stretch
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Repeated concern about whether to apply when some requirements are missing
  basis: explicitly_stated
policy_type: application-threshold
rule: Recommend realistic stretch applications when core work is aligned and gaps appear learnable rather than fundamental.
enforcement: model_guidance
task_scopes:
- job_analysis
- career_coaching
priority: 13
decision_key: stretch_feasibility
effect: guidance_only
tags:
- stretch-role
- applications
```

```yaml
type: decision_policy
id: policy-growth-over-small-salary-difference
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Career strategy discussions prioritising long-term growth and relevant experience
  basis: inferred
policy_type: trade-off
rule: Prefer stronger learning, role alignment, and career growth over a small salary difference when financial needs are still met.
enforcement: model_guidance
task_scopes:
- job_analysis
- career_coaching
priority: 20
decision_key: long_term_growth
effect: guidance_only
tags:
- growth
- salary
```

```yaml
type: decision_policy
id: policy-salary-contextual
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: User asked for salary to be evaluated contextually rather than through a universal fixed threshold
  basis: explicitly_stated
policy_type: compensation
rule: Evaluate salary in the context of role type, location, contract terms, career value, and current financial need.
enforcement: model_guidance
task_scopes:
- job_analysis
- career_coaching
priority: 21
decision_key: salary_context
effect: guidance_only
tags:
- salary
- trade-off
```

```yaml
type: decision_policy
id: policy-enterprise-exception
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Discussions accepting less-perfect role alignment for credible enterprise opportunities
  basis: inferred
policy_type: exception
rule: A credible enterprise role may remain worth considering when it offers strong training, stability, brand value, or internal mobility.
enforcement: model_guidance
task_scopes:
- job_analysis
- career_coaching
priority: 22
decision_key: enterprise_value
effect: guidance_only
tags:
- enterprise
- exception
```

```yaml
type: decision_policy
id: policy-temporary-income-opportunity-cost
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Temporary-income strategy discussion on 21 July 2026
  basis: explicitly_stated
mode: temporary-income
policy_type: temporary-work
rule: Explain how a temporary role affects income, time, energy, interview preparation, and continued primary-career search.
enforcement: model_guidance
task_scopes:
- job_analysis
- career_coaching
priority: 15
decision_key: primary_search_opportunity_cost
effect: guidance_only
tags:
- temporary-income
- trade-off
```


# Working style and personality

```yaml
type: working_style
id: working-style-ownership
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Repeated project and portfolio discussions
  basis: inferred
trait: Ownership
description: Prefers taking responsibility for a product or feature from problem understanding through implementation.
career_relevance: Supports startup, product-engineering, UX-engineering, and end-to-end product roles.
tags:
- ownership
```

```yaml
type: working_style
id: working-style-focused-sessions
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Study-plan and project-planning discussions
  basis: inferred
trait: Focused work sessions
description: Can dedicate long focused sessions when working toward a concrete learning or project goal.
career_relevance: Useful for project delivery, portfolio work, and structured skill development.
tags:
- focus
```

```yaml
type: working_style
id: working-style-multidisciplinary
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Combined frontend, UX, product, and design-system work
  basis: mixed
trait: Multidisciplinary collaboration
description: Works across design and development concerns and values understanding both user experience and implementation.
career_relevance: Supports bridge roles such as UX Engineer, Product Engineer, and design-oriented Frontend Engineer.
tags:
- multidisciplinary
```

```yaml
type: working_style
id: working-style-learning-motivation
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Repeated requests for intensive learning plans and interview preparation
  basis: inferred
trait: Active learning orientation
description: Regularly seeks structured plans, practice projects, and feedback to close skill gaps.
career_relevance: Supports growth in fast-changing frontend, product, and AI-assisted development environments.
tags:
- learning
```


# Coaching profile

```yaml
type: decision_policy
id: coaching-challenge-assumptions
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: User requested challenge rather than automatic agreement
  basis: explicitly_stated
policy_type: coaching-behaviour
rule: Challenge assumptions and suggest alternatives instead of automatically agreeing.
enforcement: model_guidance
task_scopes:
- career_coaching
priority: 5
decision_key: coaching_challenge_level
effect: guidance_only
tags:
- coaching
```

```yaml
type: decision_policy
id: coaching-no-flattery
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: User preference for honest career guidance
  basis: explicitly_stated
policy_type: coaching-behaviour
rule: Avoid empty reassurance or flattery; give grounded and direct feedback.
enforcement: model_guidance
task_scopes:
- career_coaching
- job_analysis
- interview_preparation
priority: 6
decision_key: coaching_honesty
effect: guidance_only
tags:
- coaching
- honesty
```

```yaml
type: decision_policy
id: coaching-explain-tradeoffs
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Repeated request to explain suitability, risks, gaps, and alternatives
  basis: explicitly_stated
policy_type: coaching-behaviour
rule: Explain important risks, trade-offs, and consequences behind recommendations.
enforcement: model_guidance
task_scopes:
- career_coaching
- job_analysis
priority: 7
decision_key: tradeoff_explanation
effect: guidance_only
tags:
- coaching
- trade-offs
```

```yaml
type: decision_policy
id: coaching-confidence-vs-capability
status: proposed
confidence: high
criticality: important
provenance:
  source_type: other
  source_ref: Waypoint approved architecture and v1.1 regeneration rules
  basis: documented
policy_type: coaching-behaviour
rule: Distinguish temporary confidence or recall problems from durable capability.
enforcement: hard_rule
task_scopes:
- career_coaching
- job_analysis
- interview_preparation
priority: 3
decision_key: confidence_capability_conflation
operator: equals
condition_value: true
effect: block
tags:
- coaching
- capability
```


# Skills and capability assessments

```yaml
type: skill
id: skill-react
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Employment, project, and interview-preparation history
  basis: mixed
name: React
category: frontend-development
aliases:
- React.js
tags:
- frontend
```

```yaml
type: skill
id: skill-nextjs
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Example Product Studio, freelance, HouseWars, and portfolio discussions
  basis: mixed
name: Next.js
category: frontend-development
tags:
- frontend
```

```yaml
type: skill
id: skill-typescript
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Employment, Project Atlas, and interview-preparation history
  basis: mixed
name: TypeScript
category: programming-language
tags:
- frontend
```

```yaml
type: skill
id: skill-javascript
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Professional frontend history and practice projects
  basis: mixed
name: JavaScript
category: programming-language
tags:
- frontend
```

```yaml
type: skill
id: skill-css
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Professional responsive UI work and interview preparation
  basis: mixed
name: CSS
category: frontend-development
aliases:
- CSS3
tags:
- frontend
- styling
```

```yaml
type: skill
id: skill-responsive-ui
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Example Product Studio, Northstar, freelance, and portfolio work
  basis: mixed
name: Responsive UI implementation
category: frontend-development
tags:
- frontend
- responsive-design
```

```yaml
type: skill
id: skill-angular
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Northstar employment history
  basis: mixed
name: Angular
category: frontend-development
tags:
- frontend
```

```yaml
type: skill
id: skill-vue
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Northstar employment history
  basis: mixed
name: Vue.js
category: frontend-development
aliases:
- Vue
tags:
- frontend
```

```yaml
type: skill
id: skill-react-native
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Project Atlas project history
  basis: mixed
name: React Native
category: mobile-development
tags:
- mobile
- frontend
```

```yaml
type: skill
id: skill-figma
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: MSc, FlexSave, portfolio, and Figma-learning discussions
  basis: mixed
name: Figma
category: product-design
tags:
- design
```

```yaml
type: skill
id: skill-ux-research
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: MSc and UX case-study discussions
  basis: mixed
name: UX Research
category: product-design
tags:
- ux
- research
```

```yaml
type: skill
id: skill-design-systems
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Professional and portfolio design-system discussions
  basis: mixed
name: Design Systems
category: product-design
tags:
- design-systems
```

```yaml
type: skill
id: skill-tailwind
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Example Product Studio, freelance, portfolio, and project history
  basis: mixed
name: Tailwind CSS
category: frontend-development
tags:
- frontend
- styling
```

```yaml
type: skill
id: skill-backend-concepts
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: University studies and AI-assisted full-stack project discussions
  basis: mixed
name: Backend concepts
category: software-engineering
tags:
- backend
```

```yaml
type: capability_assessment
id: capability-react
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Repeated professional React work and current interview preparation
  basis: inferred
skill_ref: skill-react
current_level: proficient
assessment_date:
  value: '2026-07-24'
  precision: day
context: Proposed estimate based on repeated professional and project use; requires explicit user calibration.
target_level: advanced
evidence_refs:
- evidence-employment-northstar-associate
- evidence-employment-pixel-forge
- evidence-project-project-atlas
development_objective: Strengthen advanced React architecture, performance, testing, and interview explanation.
tags:
- capability
```

```yaml
type: capability_assessment
id: capability-typescript
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Professional and project TypeScript use plus interview preparation
  basis: inferred
skill_ref: skill-typescript
current_level: working
assessment_date:
  value: '2026-07-24'
  precision: day
context: Proposed estimate reflecting practical frontend use; formal depth requires explicit calibration.
target_level: proficient
evidence_refs:
- evidence-project-project-atlas
- evidence-employment-pixel-forge
development_objective: Improve advanced typing, generics, narrowing, API contracts, and confident verbal explanation.
tags:
- capability
```

```yaml
type: capability_assessment
id: capability-backend-concepts
status: proposed
confidence: low
criticality: normal
provenance:
  source_type: chat
  source_ref: User described basic understanding and AI-assisted implementation
  basis: inferred
skill_ref: skill-backend-concepts
current_level: beginner
assessment_date:
  value: '2026-07-24'
  precision: day
context: Proposed conservative estimate; it must not be interpreted as professional backend-engineering capability.
target_level: working
evidence_refs:
- evidence-project-housewars
- evidence-project-project-atlas
development_objective: Build independent understanding of APIs, databases, authentication, server logic, and testing.
tags:
- capability
- backend
```


# Employment and education evidence

```yaml
type: evidence
id: evidence-employment-northstar-associate
status: proposed
confidence: medium
criticality: important
provenance:
  source_type: chat
  source_ref: Repeated CV content and career history; associate start date remains disputed
  basis: mixed
evidence_type: employment
title: Associate Front End Developer at Northstar Systems
summary: Worked on frontend applications using React, Angular, Vue, TypeScript, UI libraries, REST APIs, and Git across multiple business domains.
organisation: Northstar Systems
start_date:
  value: 2022-11
  precision: month
end_date:
  value: 2024-08
  precision: month
technologies:
- React
- Angular
- Vue.js
- TypeScript
- JavaScript
- REST APIs
- Git
tags:
- employment
- frontend
```

```yaml
type: evidence
id: evidence-employment-northstar-intern
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Career history includes exact internship dates
  basis: mixed
evidence_type: employment
title: Front End Intern at Northstar Systems
summary: Completed a frontend-development internship before or during transition into the associate role; overlap with the associate dates requires confirmation.
organisation: Northstar Systems
start_date:
  value: '2022-12-05'
  precision: day
end_date:
  value: '2023-03-03'
  precision: day
technologies:
- Frontend Development
tags:
- employment
- internship
```

```yaml
type: evidence
id: evidence-employment-pixel-forge
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Repeated CV and FindAside project discussions
  basis: mixed
evidence_type: employment
title: Frontend Developer contract at Example Product Studio
summary: Built responsive React interfaces, reusable components, state and API integrations, and onboarding, authentication, payment, and marketing-site experiences for FindAside.
organisation: Example Product Studio
start_date:
  value: 2025-05
  precision: month
end_date:
  value: 2025-10
  precision: month
technologies:
- React
- Next.js
- Tailwind CSS
- REST APIs
- Firebase Hosting
tags:
- employment
- frontend
- contract
```

```yaml
type: evidence
id: evidence-employment-freelance
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Career history summary
  basis: mixed
evidence_type: employment
title: Freelance frontend-development work
summary: Completed small React and Next.js projects involving responsive UI, layouts, routing, API features, and basic SEO.
start_date:
  value: 2024-10
  precision: month
end_date:
  value: 2025-03
  precision: month
technologies:
- React
- Next.js
- Responsive UI
- APIs
- SEO
tags:
- employment
- freelance
```

```yaml
type: evidence
id: evidence-education-msc-tud
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Repeated education and graduation discussions
  basis: mixed
evidence_type: education
title: MSc Creative Digital Media and UX
summary: Completed a master's degree at Example University with First Class Honours.
organisation: Example University
start_date:
  value: 2024-09
  precision: month
end_date:
  value: 2025-11
  precision: month
outcome: First Class Honours
tags:
- education
- ux
```

```yaml
type: evidence
id: evidence-education-btech
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Career history summary
  basis: mixed
evidence_type: education
title: B.Tech Computer Science and Engineering
summary: Completed an undergraduate degree in Computer Science and Engineering.
organisation: Example Institute of Technology
start_date:
  value: '2018'
  precision: year
end_date:
  value: '2022'
  precision: year
tags:
- education
- computer-science
```


# Project and achievement evidence

```yaml
type: evidence
id: evidence-project-project-atlas
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: MSc final-project discussions and portfolio planning
  basis: mixed
evidence_type: project
title: Project Atlas
summary: Designed and developed a React Native football team-management application with authentication, clubs, events, availability, lineups, schedules, and game-mode tracking.
start_date:
  value: '2025'
  precision: year
end_date:
  value: 2025-11
  precision: month
outcome: Submitted as the MSc final project and presented at Meet the Masters.
technologies:
- React Native
- TypeScript
- Firebase Authentication
- Firestore
tags:
- project
- mobile
- product-design
- frontend
```

```yaml
type: evidence
id: evidence-project-brightspace-pulse
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: University project and case-study discussions
  basis: mixed
evidence_type: project
title: Brightspace Pulse CV and portfolio extension
summary: Contributed to a three-person university project exploring CV, portfolio, and job-readiness features inside the Brightspace Pulse experience.
technologies:
- UX Research
- User Flows
- Wireframing
- UI Design
tags:
- project
- ux
- education
```

```yaml
type: evidence
id: evidence-project-flexsave
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Extensive July 2026 FlexSave product-design discussions
  basis: mixed
evidence_type: design_work
title: FlexSave buyer experience
summary: Developed the product strategy, information architecture, design-system foundations, components, and buyer discovery concepts for a local-offers platform.
start_date:
  value: 2026-07
  precision: month
technologies:
- Figma
tags:
- project
- product-design
- ux
- design-system
```

```yaml
type: evidence
id: evidence-project-housewars
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: June 2026 project discussions
  basis: mixed
evidence_type: project
title: HouseWars
summary: Built a Next.js application with Supabase-backed profiles, houses, games, points, leaderboards, and weekly reset concepts using AI-assisted development.
start_date:
  value: 2026-06
  precision: month
technologies:
- Next.js
- Supabase
tags:
- project
- frontend
- ai-assisted
```

```yaml
type: evidence
id: evidence-project-spotify-organizer
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: June 2026 project discussions
  basis: mixed
evidence_type: project
title: Spotify Liked Songs Organizer
summary: Built a Next.js project that authenticated with Spotify and retrieved liked songs.
start_date:
  value: 2026-06
  precision: month
technologies:
- Next.js
- Spotify OAuth
tags:
- project
- frontend
```

```yaml
type: evidence
id: evidence-project-findaside
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Example Product Studio and FindAside scope clarification
  basis: mixed
evidence_type: project
title: FindAside frontend implementation
summary: Implemented frontend experiences for a sports game-management product, including responsive interfaces, reusable components, API integration, onboarding, authentication, payments, and a Next.js marketing site.
organisation: Example Product Studio
start_date:
  value: 2025-05
  precision: month
end_date:
  value: 2025-10
  precision: month
technologies:
- React
- Next.js
- Tailwind CSS
- REST APIs
tags:
- project
- frontend
- sportstech
```


# CV strategy and artefacts

```yaml
type: uncertainty
id: uncertainty-cv-artifacts
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: CV variants have been discussed, but no actual CV file is available in this regeneration context
  basis: mixed
topic: CV artefact availability
description: Frontend, UX or Product, and Software Engineer CV variants have been discussed, but no supplied file can be identified as a verified cv_artifact in this handover.
resolution_needed: Upload or identify each current CV file and its revision before creating cv_artifact records or referencing them in CV-selection policies.
candidate_values:
- Frontend CV
- UX or Product CV
- Software Engineer CV
tags:
- cv
- uncertainty
```


# Writing and communication preferences

```yaml
type: preference
id: preference-writing-natural-voice
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Repeated email and application-writing feedback
  basis: explicitly_stated
subject: writing_tone
value: Natural conversational voice
strength: strongly_preferred
reason: The user wants professional writing to sound like how they naturally communicate rather than overly polished or generic.
tags:
- writing
- tone
```

```yaml
type: preference
id: preference-writing-concise
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Repeated requests for shorter emails and application answers
  basis: explicitly_stated
subject: writing_length
value: Concise
strength: preferred
reason: The user prefers messages that are easy to read and quick for recipients to answer.
tags:
- writing
- concise
```

```yaml
type: preference
id: preference-writing-formality
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Email-writing discussions describing a formal-casual style
  basis: explicitly_stated
subject: writing_formality
value: Professional but casually warm
strength: preferred
reason: The user wants communication to remain respectful without sounding stiff or unlike them.
tags:
- writing
- tone
```


# Temporary state

No supported records found.


# Historical observations

```yaml
type: historical_observation
id: history-temporary-income-strategy
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: Temporary office-tech job discussion
  basis: explicitly_stated
observed_at:
  value: '2026-07-21'
  precision: day
observation: The user introduced a temporary-income strategy focused on office-based or technology-adjacent work while continuing the primary career search.
decision: Maintain a separate Temporary Income career mode.
related_refs:
- temporary-income
tags:
- history
- temporary-income
```

```yaml
type: historical_observation
id: history-matchai-removed
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: User correction on 8 July 2026
  basis: explicitly_stated
observed_at:
  value: '2026-07-08'
  precision: day
observation: The user clarified that MatchAI was incomplete and dropped.
decision: Do not treat MatchAI as a completed portfolio project.
tags:
- history
- portfolio
```

```yaml
type: historical_observation
id: history-findaside-scope-correction
status: proposed
confidence: high
criticality: normal
provenance:
  source_type: chat
  source_ref: User correction on 8 July 2026
  basis: explicitly_stated
observed_at:
  value: '2026-07-08'
  precision: day
observation: The user clarified that FindAside should be treated as a frontend contract project only.
decision: Do not claim UX, UI, or product-design ownership for FindAside without new evidence.
related_refs:
- evidence-project-findaside
tags:
- history
- scope-correction
```

```yaml
type: historical_observation
id: history-flexsave-product-direction
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: July 2026 FlexSave discussions
  basis: mixed
observed_at:
  value: 2026-07
  precision: month
observation: FlexSave evolved through both startup-product and portfolio-case-study framings.
decision: Current use and positioning should be confirmed before presenting it externally.
related_refs:
- evidence-project-flexsave
tags:
- history
- flexsave
```


# Uncertain, stale or contradictory information

```yaml
type: uncertainty
id: uncertainty-visa-expiry
status: proposed
confidence: high
criticality: critical
provenance:
  source_type: chat
  source_ref: example graduate work permission confirmed, expiry date not supplied
  basis: mixed
topic: example graduate work permission expiry
description: example graduate work permission was confirmed as held in late June 2026, but current validity and the factual expiry date are unknown.
resolution_needed: Confirm the exact expiry date from the current Irish Residence Permit before using this fact to establish future work eligibility.
tags:
- visa
- eligibility
```

```yaml
type: uncertainty
id: uncertainty-northstar-dates
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Career history contains overlapping internship and associate dates
  basis: mixed
topic: Northstar employment chronology
description: The associate role is recorded as starting in November 2022, while the internship is recorded from 5 December 2022 to 3 March 2023.
resolution_needed: Confirm the correct associate start date and whether the roles overlapped, transitioned, or were recorded incorrectly.
contradicts:
- evidence-employment-northstar-associate
- evidence-employment-northstar-intern
tags:
- employment
- dates
```

```yaml
type: uncertainty
id: uncertainty-capability-levels
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Capability levels were inferred from use history rather than explicitly self-rated
  basis: mixed
topic: Capability calibration
description: React, TypeScript, and backend-concepts levels are proposed estimates and have not been explicitly confirmed by the user.
resolution_needed: Review each capability assessment using recent practical tasks, interview performance, and explicit self-assessment.
tags:
- capability
- calibration
```

```yaml
type: uncertainty
id: uncertainty-current-financial-minimum
status: proposed
confidence: high
criticality: important
provenance:
  source_type: chat
  source_ref: Salary preferences have varied by role and context
  basis: mixed
topic: Current minimum acceptable compensation
description: No single current minimum salary or hourly rate is confirmed for all permanent, contract, and temporary-income decisions.
resolution_needed: Confirm the minimum acceptable compensation for the specific role type and decision when salary becomes material.
tags:
- salary
- financial
```

```yaml
type: uncertainty
id: uncertainty-temporary-state-review-dates
status: proposed
confidence: high
criticality: important
provenance:
  source_type: other
  source_ref: v1 validation report and v1.1 temporary-state rules
  basis: documented
topic: Temporary-state review dates
description: Current availability, urgency, interview confidence, portfolio readiness, and active learning focus are discussed, but no factual expiry or user-approved review date is available.
resolution_needed: Confirm a factual expiry or explicit review date before importing any of these as temporary_state records.
tags:
- temporary-state
```

```yaml
type: uncertainty
id: uncertainty-education-metrics
status: proposed
confidence: medium
criticality: normal
provenance:
  source_type: chat
  source_ref: Reported GPA and undergraduate percentage appear in career memory but no source document is attached here
  basis: mixed
topic: Education metrics
description: An MSc GPA of 3.8 out of 4 and a B.Tech result of 72 percent have been discussed but are not reused as evidence in this handover.
resolution_needed: Verify the values against transcripts or supplied documents before using them in applications.
tags:
- education
- verification
```
