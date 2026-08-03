import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  JobAnalysisResult,
  JobRequirementResult,
} from "@/application/job-analysis";
import {
  createUserCareerAiGateway,
  JobDescriptionParsingSchema,
  type CareerAiGateway,
  type JobDescriptionParsing,
  type SemanticRequirementMatching,
} from "@/infrastructure/ai";

type Row = Record<string, unknown>;
const ANALYSIS_ENGINE_VERSION = "waypoint-intelligence-v5-cv2";

export async function analyzeJobDescription(
  client: SupabaseClient,
  userId: string,
  description: string,
  options: { force?: boolean; reparse?: boolean } = {},
): Promise<JobAnalysisResult> {
  const cleaned = description.trim();
  if (cleaned.length < 80) {
    throw new Error("Paste a fuller job description before analysing it.");
  }

  const knowledge = await loadKnowledge(client, userId);
  const cached = options.force
    ? null
    : await findCachedAnalysis(client, userId, cleaned, knowledge.fingerprint);
  if (cached) return cached;

  const storedParsed = options.force && !options.reparse
    ? await findStoredParsedJob(client, userId, cleaned)
    : null;
  const ai = await createUserCareerAiGateway(client, userId);
  let parsingFallback = false;
  let parsed;
  if (storedParsed) {
    parsed = {
        data: storedParsed.parsed,
        responseId: "stored-job",
        model: "stored-job-parse",
        promptVersion: "stored-job-parse-v1",
      };
  } else {
    try {
      parsed = await ai.parseJobDescription(cleaned);
    } catch (error) {
      parsingFallback = true;
      console.warn("AI job parsing failed; using deterministic parser.", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
      parsed = deterministicJobParse(cleaned);
    }
  }
  const parsedJob: JobDescriptionParsing = {
    ...parsed.data,
    role: {
      ...parsed.data.role,
      title:
        parsed.data.role.title ??
        inferRoleTitle(parsed.data.requirements),
    },
  };
  const semanticResult = await matchRequirementsSemantically(
    ai,
    parsedJob,
    knowledge,
  );
  const requirements = parsedJob.requirements.map((requirement, index) => {
    const deterministic = assessRequirement(requirement, knowledge);
    const semantic = semanticResult.matches.get(`requirement-${index}`);
    const assessed = semantic
      ? applySemanticMatch(requirement, deterministic, semantic, knowledge)
      : deterministic;
    const override = storedParsed?.criticalities[index];
    return override ? { ...assessed, criticality: override } : assessed;
  });
  const requirementsScore = weightedAverage(requirements);
  const direction = assessDirection(parsedJob, knowledge.modes);
  const preference = assessPreferences(parsedJob, knowledge.preferences);
  const blockers = requirements
    .filter(
      (item) =>
        item.outcome === "conflicts" &&
        (item.criticality === "eligibility" ||
          item.criticality === "mandatory_core"),
    )
    .map((item) => item.text);
  const knowledgeCoverage = calculateKnowledgeCoverage(requirements);
  const evidenceConfidence = calculateEvidenceConfidence(requirements);
  const eligibility = assessEligibility(requirements);
  const alignmentComponents = [
    { score: requirementsScore, weight: 0.8, assessed: true },
    { score: direction.score, weight: 0.15, assessed: direction.assessed },
    { score: preference.score, weight: 0.05, assessed: preference.assessed },
  ].filter((component) => component.assessed);
  const overallScore = Math.round(
    alignmentComponents.reduce(
      (sum, component) => sum + component.score * component.weight,
      0,
    ) /
      alignmentComponents.reduce(
        (sum, component) => sum + component.weight,
        0,
      ),
  );
  const recommendation =
    blockers.length === 0 &&
    overallScore >= 65 &&
    knowledgeCoverage >= 45
      ? "apply"
      : blockers.length === 0
        ? "investigate"
        : "skip";
  const bestCv = selectBestCv(
    knowledge.cvs,
    requirements,
    parsedJob.role.title,
  );
  const strengths = requirements
    .filter((item) => item.match === "matched")
    .map((item) => item.text);
  const gaps = requirements
    .filter(
      (item) =>
        item.outcome === "unknown" ||
        item.outcome === "conflicts" ||
        item.match === "partial",
    )
    .map((item) => item.text);
  const uncertainties = [
    ...parsedJob.ambiguities,
    ...requirements
      .filter((item) => item.match === "uncertain")
      .map((item) => item.text),
  ];
  const summary = buildSummary(
    recommendation,
    overallScore,
    strengths.length,
    blockers.length,
    gaps.length,
  );
  const ids = await persistAnalysis(client, {
    userId,
    description: cleaned,
    parsed: parsedJob,
    model: parsed.model,
    promptVersion: parsed.promptVersion,
    recommendation,
    overallScore,
    summary,
    blockers,
    strengths,
    gaps,
    uncertainties,
    requirements,
    requirementsScore,
    directionScore: direction.score,
    preferenceScore: preference.score,
    eligibilityScore: eligibility.score,
    evidenceConfidence,
    knowledgeCoverage,
    semanticStatus:
      parsingFallback && semanticResult.status === "completed"
        ? "partial_fallback"
        : semanticResult.status,
    bestCv,
    knowledgeFingerprint: knowledge.fingerprint,
  });

  return {
    ...ids,
    title: parsedJob.role.title,
    company: parsedJob.role.company,
    recommendation,
    overallScore,
    requirementsScore,
    directionScore: direction.score,
    preferenceScore: preference.score,
    eligibilityScore: eligibility.score,
    evidenceConfidence,
    knowledgeCoverage,
    semanticStatus:
      parsingFallback && semanticResult.status === "completed"
        ? "partial_fallback"
        : semanticResult.status,
    summary,
    blockers,
    strengths,
    gaps,
    uncertainties,
    requirements,
    bestCv,
  };
}

async function findStoredParsedJob(
  client: SupabaseClient,
  userId: string,
  description: string,
): Promise<{
  parsed: JobDescriptionParsing;
  criticalities: Array<JobRequirementResult["criticality"]>;
} | null> {
  const { data: jobs, error } = await client
    .from("jobs")
    .select("id,title,company,description_text,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw new Error("Unable to reload the saved job.", { cause: error });
  const job = ((jobs ?? []) as Row[]).find(
    (candidate) => candidate.description_text === description,
  );
  if (!job) return null;
  const [{ data: requirements, error: requirementError }, { data: analyses }] =
    await Promise.all([
      client
        .from("job_requirements")
        .select("kind,requirement_text,is_required,confidence,source_start,source_end,metadata,criticality")
        .eq("user_id", userId)
        .eq("job_id", String(job.id))
        .order("created_at"),
      client
        .from("analyses")
        .select("result")
        .eq("user_id", userId)
        .eq("job_id", String(job.id))
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
  if (requirementError) {
    throw new Error("Unable to reload saved job requirements.", {
      cause: requirementError,
    });
  }
  const previousResult = (analyses as Row[] | null)?.[0]?.result as
    | Record<string, unknown>
    | undefined;
  const previousRole = previousResult?.parsedRole as
    | Partial<JobDescriptionParsing["role"]>
    | undefined;
  const requirementRows = (requirements ?? []) as Row[];
  return {
    parsed: JobDescriptionParsingSchema.parse({
    role: {
      title: typeof job.title === "string" ? job.title : null,
      company: typeof job.company === "string" ? job.company : null,
      location: previousRole?.location ?? null,
      workArrangement: previousRole?.workArrangement ?? "unspecified",
      employmentType: previousRole?.employmentType ?? "unspecified",
      seniority: previousRole?.seniority ?? "unspecified",
    },
    requirements: requirementRows.map((requirement) => {
      const metadata = requirement.metadata as Record<string, unknown> | null;
      const start = numberValue(requirement.source_start);
      const end = numberValue(requirement.source_end);
      return {
        text: String(requirement.requirement_text),
        kind: storedRequirementKind(String(requirement.kind)),
        priority: priorityFromStoredRequirement(requirement, metadata),
        normalizedValue:
          typeof metadata?.normalized_value === "string"
            ? metadata.normalized_value
            : null,
        minimumYears:
          typeof metadata?.minimum_years === "number"
            ? metadata.minimum_years
            : null,
        evidence: {
          source: {
            quote: description.slice(start, end),
            startCharacter: start,
            endCharacter: Math.max(start + 1, end),
          },
          confidence: numberValue(requirement.confidence) || 0.8,
        },
      };
    }),
    responsibilities: [],
    compensation: null,
    benefits: [],
    applicationInstructions: [],
    ambiguities: [],
    parsingNotes: [],
    }),
    criticalities: requirementRows.map((requirement) => {
      const value = String(requirement.criticality ?? "");
      return [
        "eligibility",
        "mandatory_core",
        "important",
        "preferred",
        "bonus",
        "unclear",
      ].includes(value)
        ? (value as JobRequirementResult["criticality"])
        : undefined;
    }),
  };
}

function priorityFromStoredRequirement(
  requirement: Row,
  metadata: Record<string, unknown> | null,
): "required" | "preferred" | "unclear" {
  const criticality = String(requirement.criticality ?? "");
  if (criticality === "unclear") return "unclear";
  if (criticality === "preferred" || criticality === "bonus") {
    return "preferred";
  }
  if (
    criticality === "eligibility" ||
    criticality === "mandatory_core" ||
    criticality === "important"
  ) {
    return "required";
  }
  return metadata?.priority === "required" ||
    metadata?.priority === "preferred" ||
    metadata?.priority === "unclear"
    ? metadata.priority
    : requirement.is_required === true
      ? "required"
      : "preferred";
}

function storedRequirementKind(kind: string) {
  return [
    "skill",
    "experience",
    "education",
    "certification",
    "eligibility",
    "location",
    "language",
    "other",
  ].includes(kind)
    ? kind
    : "other";
}

async function findCachedAnalysis(
  client: SupabaseClient,
  userId: string,
  description: string,
  knowledgeFingerprint: string,
): Promise<JobAnalysisResult | null> {
  const { data: jobs, error: jobError } = await client
    .from("jobs")
    .select("id,title,company,description_text,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);
  if (jobError) throw new Error("Unable to check previous job analyses.", { cause: jobError });
  const job = ((jobs ?? []) as Row[]).find(
    (candidate) => candidate.description_text === description,
  );
  if (!job) return null;

  const { data: analyses, error: analysisError } = await client
    .from("analyses")
    .select("id,recommendation,overall_score,summary,result,selected_cv_version_id")
    .eq("user_id", userId)
    .eq("job_id", String(job.id))
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1);
  if (analysisError) throw new Error("Unable to load the previous job analysis.", { cause: analysisError });
  const analysis = (analyses as Row[] | null)?.[0];
  if (!analysis) return null;
  const stored = analysis.result as Record<string, unknown>;
  if (stored.analysisEngineVersion !== ANALYSIS_ENGINE_VERSION) return null;
  if (stored.knowledgeFingerprint !== knowledgeFingerprint) return null;
  const scores = stored.scores as Record<string, unknown> | undefined;
  return {
    analysisId: String(analysis.id),
    jobId: String(job.id),
    title: typeof job.title === "string" ? job.title : null,
    company: typeof job.company === "string" ? job.company : null,
    recommendation: analysis.recommendation as JobAnalysisResult["recommendation"],
    overallScore: numberValue(analysis.overall_score),
    requirementsScore: numberValue(scores?.requirements),
    directionScore: numberValue(scores?.careerDirection),
    preferenceScore: numberValue(scores?.preferences),
    eligibilityScore: numberValue(scores?.eligibility),
    evidenceConfidence: numberValue(scores?.evidenceConfidence),
    knowledgeCoverage: numberValue(scores?.knowledgeCoverage),
    semanticStatus:
      stored.semanticStatus === "completed" ||
      stored.semanticStatus === "partial_fallback"
        ? stored.semanticStatus
        : "deterministic_only",
    summary: String(analysis.summary ?? ""),
    blockers: stringArray(stored.blockers),
    strengths: stringArray(stored.strengths),
    gaps: stringArray(stored.gaps),
    uncertainties: stringArray(stored.uncertainties),
    requirements: Array.isArray(stored.requirements)
      ? stored.requirements as JobRequirementResult[]
      : [],
    bestCv:
      stored.bestCv && typeof stored.bestCv === "object"
        ? stored.bestCv as JobAnalysisResult["bestCv"]
        : null,
  };
}

async function loadKnowledge(client: SupabaseClient, userId: string) {
  const [
    masterProfileResult,
    skillsResult,
    evidenceResult,
    modesResult,
    preferencesResult,
    capabilitiesResult,
    skillAliasesResult,
    competenciesResult,
    competencyAssessmentsResult,
    skillRelationshipsResult,
    skillEvidenceResult,
    competencyEvidenceResult,
    cvsResult,
  ] = await Promise.all([
    client.from("master_profile_records").select("id,record_type,title,statement,structured_data,confidence,updated_at").eq("user_id", userId).eq("status", "confirmed"),
    client.from("skills").select("id,name,aliases,description,primary_category,updated_at").eq("user_id", userId).eq("status", "confirmed"),
    client.from("evidence_records").select("id,title,narrative,organisation,kind,attributes,updated_at").eq("user_id", userId).eq("status", "confirmed"),
    client.from("career_modes").select("id,name,purpose,target_role_families,updated_at").eq("user_id", userId).eq("status", "confirmed").eq("is_active", true),
    client.from("typed_preferences").select("id,subject,value,strength,reason,updated_at").eq("user_id", userId).eq("status", "confirmed"),
    client.from("capability_assessments").select("skill_id,current_level,proficiency_level,assessment_confidence,is_self_assessed,context,updated_at").eq("user_id", userId).eq("status", "confirmed"),
    client.from("skill_aliases").select("skill_id,alias").eq("user_id", userId),
    client.from("professional_competencies").select("id,name,canonical_slug,category,description,updated_at").eq("user_id", userId).eq("status", "confirmed"),
    client.from("competency_assessments").select("id,competency_id,proficiency_level,updated_at").eq("user_id", userId).eq("status", "confirmed"),
    client.from("skill_relationships").select("id,source_skill_id,target_skill_id,relationship,updated_at").eq("user_id", userId).eq("status", "confirmed"),
    client.from("skill_evidence").select("skill_id,evidence_record_id,evidence_role,strength,created_at").eq("user_id", userId),
    client.from("competency_evidence").select("competency_assessment_id,evidence_record_id,created_at").eq("user_id", userId),
    client.from("cv_documents_v2").select("id,display_name,intended_roles,processing_status,extracted_text,updated_at").eq("user_id", userId),
  ]);
  const results = [
    ["Master Profile", masterProfileResult],
    ["skills", skillsResult],
    ["evidence", evidenceResult],
    ["career directions", modesResult],
    ["preferences", preferencesResult],
    ["skill levels", capabilitiesResult],
    ["skill aliases", skillAliasesResult],
    ["professional competencies", competenciesResult],
    ["competency levels", competencyAssessmentsResult],
    ["skill relationships", skillRelationshipsResult],
    ["skill evidence", skillEvidenceResult],
    ["competency evidence", competencyEvidenceResult],
    ["CV library", cvsResult],
  ] as const;
  const failure = results.find(([, result]) => result.error);
  if (failure?.[1].error) {
    throw new Error(`Unable to load ${failure[0]} for job analysis.`, {
      cause: failure[1].error,
    });
  }

  const aliasesBySkill = new Map<string, string[]>();
  for (const alias of (skillAliasesResult.data ?? []) as Row[]) {
    const skillId = String(alias.skill_id);
    aliasesBySkill.set(skillId, [
      ...(aliasesBySkill.get(skillId) ?? []),
      String(alias.alias),
    ]);
  }
  const legacySkills: Row[] = ((skillsResult.data ?? []) as Row[]).map(
    (skill): Row => ({
      ...skill,
      aliases: [
        ...new Set([
          ...((skill.aliases as string[] | null) ?? []),
          ...(aliasesBySkill.get(String(skill.id)) ?? []),
        ]),
      ],
    }),
  );
  const legacyEvidence = (evidenceResult.data ?? []) as Row[];
  const legacyCapabilityLevels = new Map(
    ((capabilitiesResult.data ?? []) as Row[]).map((assessment) => [
      String(assessment.skill_id),
      String(assessment.proficiency_level ?? assessment.current_level),
    ]),
  );
  const legacyCompetencyLevels = new Map(
    ((competencyAssessmentsResult.data ?? []) as Row[]).map((assessment) => [
      String(assessment.competency_id),
      String(assessment.proficiency_level),
    ]),
  );
  const legacyCompetencies = (competenciesResult.data ?? []) as Row[];
  const legacyModes = (modesResult.data ?? []) as Row[];
  const legacyPreferences = (preferencesResult.data ?? []) as Row[];
  const masterRecords = (masterProfileResult.data ?? []) as Row[];
  const useMasterProfile = masterRecords.length > 0;
  const masterByType = (type: string) =>
    masterRecords.filter((record) => record.record_type === type);
  const skills: Row[] = useMasterProfile
    ? masterByType("skill").map((record) => ({
        id: record.id,
        name: record.title,
        aliases: stringArray(
          (record.structured_data as Row | null)?.tags,
        ),
        description: record.statement,
        primary_category: "master_profile",
        updated_at: record.updated_at,
      }))
    : legacySkills;
  const capabilityLevels = useMasterProfile
    ? new Map(
        masterByType("skill").map((record) => [
          String(record.id),
          String(
            (record.structured_data as Row | null)?.proficiency ?? "unknown",
          ),
        ]),
      )
    : legacyCapabilityLevels;
  const competencies: Row[] = useMasterProfile
    ? masterByType("competency").map((record) => ({
        id: record.id,
        name: record.title,
        canonical_slug: normalise(String(record.title)),
        category: "master_profile",
        description: record.statement,
        updated_at: record.updated_at,
      }))
    : legacyCompetencies;
  const competencyLevels = useMasterProfile
    ? new Map(
        masterByType("competency").map((record) => [
          String(record.id),
          String(
            (record.structured_data as Row | null)?.proficiency ?? "working",
          ),
        ]),
      )
    : legacyCompetencyLevels;
  const evidence: Row[] = useMasterProfile
    ? masterRecords
        .filter((record) =>
          ["experience", "project", "education", "achievement", "stable_fact", "eligibility"].includes(
            String(record.record_type),
          ),
        )
        .map((record) => ({
          id: record.id,
          title: record.title,
          narrative: record.statement,
          organisation:
            (record.structured_data as Row | null)?.organization ?? null,
          kind: record.record_type,
          attributes: record.structured_data,
          updated_at: record.updated_at,
        }))
    : legacyEvidence;
  const modes: Row[] = useMasterProfile
    ? masterByType("career_direction").map((record) => ({
        id: record.id,
        name: record.title,
        purpose: record.statement,
        target_role_families:
          (record.structured_data as Row | null)?.tags ?? [],
        updated_at: record.updated_at,
      }))
    : legacyModes;
  const preferences: Row[] = useMasterProfile
    ? masterRecords
        .filter((record) =>
          ["preference", "eligibility", "decision_policy"].includes(
            String(record.record_type),
          ),
        )
        .map((record) => ({
          id: record.id,
          subject: record.title,
          value: record.statement,
          strength:
            (record.structured_data as Row | null)?.strength ?? "preferred",
          reason: record.statement,
          updated_at: record.updated_at,
        }))
    : legacyPreferences;
  const fingerprintRows = [
    ...masterRecords,
    ...skills,
    ...evidence,
    ...modes,
    ...preferences,
    ...((capabilitiesResult.data ?? []) as Row[]),
    ...competencies,
    ...((competencyAssessmentsResult.data ?? []) as Row[]),
    ...((skillRelationshipsResult.data ?? []) as Row[]),
    ...((skillEvidenceResult.data ?? []) as Row[]),
    ...((competencyEvidenceResult.data ?? []) as Row[]),
    ...((skillAliasesResult.data ?? []) as Row[]),
    ...((cvsResult.data ?? []) as Row[]),
  ]
    .map((row) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(row).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        ),
      ),
    )
    .sort()
    .join("|");
  return {
    skills,
    evidence,
    capabilityLevels,
    competencies,
    competencyLevels,
    competencyAssessments: useMasterProfile
      ? []
      : (competencyAssessmentsResult.data ?? []) as Row[],
    modes,
    preferences,
    skillRelationships: useMasterProfile
      ? []
      : (skillRelationshipsResult.data ?? []) as Row[],
    skillEvidence: useMasterProfile
      ? []
      : (skillEvidenceResult.data ?? []) as Row[],
    competencyEvidence: useMasterProfile
      ? []
      : (competencyEvidenceResult.data ?? []) as Row[],
    fingerprint: createHash("sha256").update(fingerprintRows).digest("hex"),
    cvs: ((cvsResult.data ?? []) as Row[]).map((cv) => ({
      ...cv,
      name: cv.display_name,
      snapshotStatus: cv.processing_status,
      snapshotText:
        cv.processing_status === "ready"
          ? normalise(String(cv.extracted_text ?? ""))
          : "",
    })),
  };
}

async function matchRequirementsSemantically(
  ai: CareerAiGateway,
  parsedJob: JobDescriptionParsing,
  knowledge: Awaited<ReturnType<typeof loadKnowledge>>,
) {
  const matches = new Map<
    string,
    SemanticRequirementMatching["requirements"][number]
  >();
  let failedBatches = 0;
  const allIndexed = parsedJob.requirements.map((requirement, index) => ({
      id: `requirement-${index}`,
      requirement,
    }));
  const indexed = allIndexed
    .filter(
      ({ requirement }) =>
        assessRequirement(requirement, knowledge).match !== "matched",
    )
    .slice(0, 8);

  for (let offset = 0; offset < indexed.length; offset += 2) {
    const batch = indexed.slice(offset, offset + 2);
    const relevant = retrieveRelevantKnowledge(
      batch.map((item) => item.requirement.text).join(" "),
      knowledge,
      10,
    );
    try {
      const result = await ai.matchJobRequirements({
        requirements: batch.map(({ id, requirement }) => ({
          id,
          text: requirement.text,
          kind: requirement.kind,
          required: requirement.priority === "required",
        })),
        knowledge: relevant,
      });
      const validIds = new Set(batch.map((item) => item.id));
      for (const item of result.data.requirements) {
        if (validIds.has(item.requirementId) && item.aspects.length > 0) {
          matches.set(item.requirementId, item);
        }
      }
    } catch (error) {
      failedBatches += 1;
      console.warn("Semantic requirement batch failed.", {
        offset,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  return {
    matches,
    status:
      matches.size === 0
        ? ("deterministic_only" as const)
        : failedBatches > 0 ||
            matches.size < indexed.length ||
            indexed.length < allIndexed.length
          ? ("partial_fallback" as const)
          : ("completed" as const),
  };
}

function retrieveRelevantKnowledge(
  requirementText: string,
  knowledge: Awaited<ReturnType<typeof loadKnowledge>>,
  limit: number,
) {
  const queryWords = new Set(expandRetrievalWords(significantWords(requirementText)));
  const scoreText = (value: string) => {
    const words = significantWords(value);
    return words.reduce(
      (score, word) =>
        score +
        (queryWords.has(word) ? 6 : [...queryWords].some((q) => q.includes(word) || word.includes(q)) ? 2 : 0),
      0,
    );
  };
  const skillScores = new Map<string, number>();
  for (const skill of knowledge.skills) {
    skillScores.set(
      String(skill.id),
      scoreText(
        `${skill.name ?? ""} ${((skill.aliases as string[] | null) ?? []).join(" ")} ${skill.description ?? ""}`,
      ),
    );
  }
  for (const relationship of knowledge.skillRelationships) {
    const source = String(relationship.source_skill_id);
    const target = String(relationship.target_skill_id);
    const sourceScore = skillScores.get(source) ?? 0;
    const targetScore = skillScores.get(target) ?? 0;
    if (sourceScore > 0) skillScores.set(target, Math.max(targetScore, sourceScore * 0.6));
    if (targetScore > 0) skillScores.set(source, Math.max(sourceScore, targetScore * 0.6));
  }
  const evidenceScores = new Map(
    knowledge.evidence.map((evidence) => [
      String(evidence.id),
      scoreText(
        `${evidence.title ?? ""} ${evidence.narrative ?? ""} ${evidence.organisation ?? ""}`,
      ),
    ]),
  );
  for (const link of knowledge.skillEvidence) {
    const skillScore = skillScores.get(String(link.skill_id)) ?? 0;
    if (skillScore <= 0 || link.evidence_role === "contradicts") continue;
    const evidenceId = String(link.evidence_record_id);
    evidenceScores.set(
      evidenceId,
      Math.max(evidenceScores.get(evidenceId) ?? 0, skillScore * 0.85),
    );
  }
  const competencyByAssessment = new Map(
    [...knowledge.competencyLevels.keys()].map((competencyId) => [
      competencyId,
      competencyId,
    ]),
  );
  for (const assessment of knowledge.competencyAssessments) {
    competencyByAssessment.set(
      String(assessment.id),
      String(assessment.competency_id),
    );
  }
  const competencyScores = new Map(
    knowledge.competencies.map((competency) => [
      String(competency.id),
      scoreText(
        `${competency.name ?? ""} ${competency.canonical_slug ?? ""} ${competency.description ?? ""}`,
      ),
    ]),
  );
  for (const link of knowledge.competencyEvidence) {
    const competencyId = competencyByAssessment.get(
      String(link.competency_assessment_id),
    );
    const competencyScore = competencyId
      ? competencyScores.get(competencyId) ?? 0
      : 0;
    if (competencyScore <= 0) continue;
    const evidenceId = String(link.evidence_record_id);
    evidenceScores.set(
      evidenceId,
      Math.max(evidenceScores.get(evidenceId) ?? 0, competencyScore * 0.85),
    );
  }

  const records = [
    ...knowledge.skills.map((skill) => ({
      id: String(skill.id),
      type: "skill" as const,
      name: String(skill.name),
      level: knowledge.capabilityLevels.get(String(skill.id)) ?? null,
      aliases: (skill.aliases as string[] | null) ?? [],
      summary:
        typeof skill.description === "string"
          ? skill.description.slice(0, 180)
          : null,
      relevance: skillScores.get(String(skill.id)) ?? 0,
    })),
    ...knowledge.competencies.map((competency) => ({
      id: String(competency.id),
      type: "competency" as const,
      name: String(competency.name),
      level: knowledge.competencyLevels.get(String(competency.id)) ?? null,
      aliases: [],
      summary:
        typeof competency.description === "string"
          ? competency.description.slice(0, 180)
          : null,
      relevance: competencyScores.get(String(competency.id)) ?? 0,
    })),
    ...knowledge.evidence.map((evidence) => ({
      id: String(evidence.id),
      type: "evidence" as const,
      name: String(evidence.title),
      level: null,
      aliases: [],
      summary:
        typeof evidence.narrative === "string"
          ? evidence.narrative.slice(0, 240)
          : null,
      relevance: evidenceScores.get(String(evidence.id)) ?? 0,
    })),
  ];
  return records
    .filter((record) => record.relevance > 0)
    .sort((left, right) => right.relevance - left.relevance)
    .slice(0, limit)
    .map((record) => ({
      id: record.id,
      type: record.type,
      name: record.name,
      level: record.level,
      aliases: record.aliases,
      summary: record.summary,
    }));
}

const RETRIEVAL_SYNONYMS: Record<string, string[]> = {
  ai: ["cursor", "codex", "claude", "mcp", "assisted"],
  cursor: ["ai", "assisted", "codex", "mcp"],
  codex: ["ai", "assisted", "cursor", "mcp"],
  authorization: ["authorisation", "permission", "visa", "stamp"],
  authorisation: ["authorization", "permission", "visa", "stamp"],
  permission: ["authorisation", "authorization", "visa", "stamp"],
  collaboration: ["cross", "functional", "teamwork", "stakeholder"],
  ambiguity: ["growth", "mindset", "adaptability", "learning"],
  maintenance: ["codebase", "refactoring", "debt", "legacy"],
};

function expandRetrievalWords(words: string[]) {
  return [
    ...new Set(
      words.flatMap((word) => [word, ...(RETRIEVAL_SYNONYMS[word] ?? [])]),
    ),
  ];
}

export function applySemanticMatch(
  requirement: JobDescriptionParsing["requirements"][number],
  deterministic: ReturnType<typeof assessRequirement>,
  semantic: SemanticRequirementMatching["requirements"][number],
  knowledge: Awaited<ReturnType<typeof loadKnowledge>>,
): ReturnType<typeof assessRequirement> {
  const records = new Map<
    string,
    {
      id: string;
      type: "skill" | "competency" | "evidence";
      name: string;
      level: string | null;
    }
  >([
    ...knowledge.skills.map((skill) => [
      String(skill.id),
      {
        id: String(skill.id),
        type: "skill" as const,
        name: String(skill.name),
        level: knowledge.capabilityLevels.get(String(skill.id)) ?? null,
      },
    ] as const),
    ...knowledge.competencies.map((competency) => [
      String(competency.id),
      {
        id: String(competency.id),
        type: "competency" as const,
        name: String(competency.name),
        level:
          knowledge.competencyLevels.get(String(competency.id)) ?? null,
      },
    ] as const),
    ...knowledge.evidence.map((evidence) => [
      String(evidence.id),
      {
        id: String(evidence.id),
        type: "evidence" as const,
        name: String(evidence.title),
        level: null,
      },
    ] as const),
  ]);

  const validAspects = semantic.aspects.map((aspect) => {
    const citations = aspect.citations
      .map((citation) => {
        const record = records.get(citation.recordId);
        return record ? { ...citation, record } : null;
      })
      .filter((citation): citation is NonNullable<typeof citation> =>
        Boolean(citation),
      );
    const score = citations.length
      ? Math.max(
          ...citations.map((citation) =>
            semanticCitationScore(
              requirement.text,
              citation.record.level,
              citation.record.type,
              citation.relation,
              citation.confidence,
            ),
          ),
        )
      : 0;
    return {
      ...aspect,
      citations,
      score:
        aspect.status === "unsupported"
          ? 0
          : aspect.status === "uncertain"
            ? Math.min(score, 45)
            : aspect.status === "partial"
              ? Math.min(score, 69)
              : score,
    };
  });
  if (!validAspects.length) return deterministic;

  let score = Math.round(
    validAspects.reduce((sum, aspect) => sum + aspect.score, 0) /
      validAspects.length,
  );
  if (
    requirement.minimumYears !== null &&
    deterministic.match !== "matched"
  ) {
    score = Math.min(score, 69);
  }
  const match: JobRequirementResult["match"] =
    score >= 70
      ? "matched"
      : score >= 35
        ? "partial"
        : validAspects.some((aspect) => aspect.status === "uncertain")
          ? "uncertain"
          : "gap";
  const citations = validAspects.flatMap((aspect) => aspect.citations);
  if (citations.length === 0 || score <= deterministic.score) {
    return deterministic;
  }
  const matchedSkillIds = [
    ...new Set(
      citations
        .filter((citation) => citation.record.type === "skill")
        .map((citation) => citation.record.id),
    ),
  ];
  const matchedEvidenceIds = [
    ...new Set(
      citations
        .filter((citation) => citation.record.type === "evidence")
        .map((citation) => citation.record.id),
    ),
  ];
  const evidence = [
    ...new Map(
      citations.map((citation) => {
        const level = citation.record.level;
        const label = `${humaniseWord(citation.record.type)}: ${citation.record.name}${
          level ? ` (${humaniseLevel(level)})` : ""
        } — ${semanticRelationExplanation(
          citation.relation,
          citation.record.name,
        )}`;
        return [citation.record.id, label];
      }),
    ).values(),
  ].slice(0, 8);
  const unsupported = validAspects
    .filter((aspect) => aspect.score < 35)
    .map((aspect) => aspect.text);
  const supportedCount = validAspects.filter(
    (aspect) => aspect.score >= 70,
  ).length;

  return {
    ...deterministic,
    match,
    score,
    outcome:
      match === "matched"
        ? "supported"
        : match === "partial"
          ? "partially_supported"
          : "unknown",
    confidence: average(
      citations.map((citation) => citation.confidence),
    ),
    explanation:
      unsupported.length === 0
        ? `Semantic comparison found confirmed support for ${supportedCount} of ${validAspects.length} requirement aspects.`
        : `Confirmed knowledge supports ${supportedCount} of ${validAspects.length} aspects. Still unsupported: ${unsupported.join("; ")}.`,
    evidence,
    matchedSkillIds,
    matchedEvidenceIds,
  };
}

function semanticRelationExplanation(
  relation:
    | "direct"
    | "version_variant"
    | "parent_child"
    | "transferable"
    | "supporting_evidence",
  recordName: string,
) {
  return {
    direct: `${recordName} directly supports this aspect`,
    version_variant: `${recordName} covers the named version or variant`,
    parent_child: `${recordName} covers the related parent or child capability`,
    transferable: `${recordName} provides related transferable experience`,
    supporting_evidence: `${recordName} provides confirmed supporting evidence`,
  }[relation];
}

function semanticCitationScore(
  requirementText: string,
  level: string | null,
  recordType: "skill" | "competency" | "evidence",
  relation:
    | "direct"
    | "version_variant"
    | "parent_child"
    | "transferable"
    | "supporting_evidence",
  confidence: number,
) {
  const relationCoverage = {
    direct: 1,
    version_variant: 0.98,
    parent_child: 0.9,
    transferable: 0.6,
    supporting_evidence: 0.85,
  }[relation];
  const proficiency =
    recordType === "evidence"
      ? 0.75
      : capabilityStrength(level ?? undefined) ?? 0.65;
  let score =
    (relationCoverage * 70 + proficiency * 30) *
    Math.max(0.7, Math.min(1, confidence));
  const asksForAdvanced = /\b(expert|expertise|advanced|deep|strong proficiency|highly proficient)\b/i.test(
    requirementText,
  );
  if (asksForAdvanced && level) {
    const cap = {
      learning: 35,
      basic: 50,
      working: 70,
      strong: 92,
      expert: 100,
    }[level];
    if (cap !== undefined) score = Math.min(score, cap);
  }
  return Math.round(score);
}

export function assessRequirement(
  requirement: JobDescriptionParsing["requirements"][number],
  knowledge: Awaited<ReturnType<typeof loadKnowledge>>,
): JobRequirementResult & { matchedSkillIds: string[]; matchedEvidenceIds: string[] } {
  const requirementText = normalise(
    `${requirement.text} ${requirement.normalizedValue ?? ""}`,
  );
  const concepts = CONCEPTS.filter((concept) =>
    concept.jobTerms.some((term) => requirementText.includes(normalise(term))),
  );
  const skillText = (skill: Row) =>
    normalise(
      [skill.name, ...((skill.aliases as string[] | null) ?? [])].join(" "),
    );
  const evidenceText = (item: Row) =>
    normalise(
      [
        item.title,
        item.narrative,
        item.organisation,
        JSON.stringify(item.attributes ?? {}),
      ].join(" "),
    );
  const competencyText = (competency: Row) =>
    normalise(`${competency.name ?? ""} ${competency.canonical_slug ?? ""}`);
  const matchedSkills = new Map<string, Row>();
  const matchedEvidence = new Map<string, Row>();
  const matchedCompetencies = new Map<string, Row>();
  let coveredConcepts = 0;
  let conceptStrengthTotal = 0;

  for (const concept of concepts) {
    const aliases = concept.evidenceTerms.map(normalise);
    const conceptSkills = knowledge.skills.filter((skill) =>
      aliases.some((alias) => skillText(skill).includes(alias)),
    );
    const conceptEvidence = knowledge.evidence.filter((item) =>
      aliases.some((alias) => evidenceText(item).includes(alias)),
    );
    const conceptCompetencies = knowledge.competencies.filter((competency) =>
      aliases.some((alias) => competencyText(competency).includes(alias)),
    );
    if (
      conceptSkills.length ||
      conceptEvidence.length ||
      conceptCompetencies.length
    ) {
      coveredConcepts += 1;
      const assessedStrengths = [
        ...conceptSkills.map((skill) =>
          capabilityStrength(
            knowledge.capabilityLevels.get(String(skill.id)),
          ),
        ),
        ...conceptCompetencies.map((competency) =>
          capabilityStrength(
            knowledge.competencyLevels.get(String(competency.id)),
          ),
        ),
      ]
        .filter((strength): strength is number => strength !== null);
      const skillStrength = assessedStrengths.length
        ? Math.max(...assessedStrengths)
        : conceptSkills.length || conceptCompetencies.length
          ? 0.7
          : 0;
      const evidenceStrength = conceptEvidence.length ? 0.75 : 0;
      conceptStrengthTotal += assessedStrengths.length
        ? Math.max(skillStrength, conceptEvidence.length ? 0.5 : 0)
        : Math.max(skillStrength, evidenceStrength);
    }
    for (const skill of conceptSkills) matchedSkills.set(String(skill.id), skill);
    for (const item of conceptEvidence) matchedEvidence.set(String(item.id), item);
    for (const competency of conceptCompetencies) {
      matchedCompetencies.set(String(competency.id), competency);
    }
  }

  const experienceMatch =
    requirement.kind === "experience" &&
    /frontend|front end/.test(requirementText) &&
    hasSufficientFrontendExperience(knowledge.evidence, requirement.minimumYears);
  if (experienceMatch) {
    coveredConcepts = Math.max(1, coveredConcepts);
    conceptStrengthTotal = Math.max(1, conceptStrengthTotal);
    for (const item of knowledge.evidence.filter((evidence) =>
      /front ?end/.test(evidenceText(evidence)),
    )) {
      matchedEvidence.set(String(item.id), item);
    }
  }

  // Canonical names and aliases allow newly reviewed skills to match without
  // requiring a code change to the concept dictionary.
  for (const skill of knowledge.skills) {
    const names = [
      String(skill.name ?? ""),
      ...((skill.aliases as string[] | null) ?? []),
    ];
    if (names.some((name) => containsPhrase(requirementText, name))) {
      matchedSkills.set(String(skill.id), skill);
    }
  }
  for (const competency of knowledge.competencies) {
    if (containsPhrase(requirementText, String(competency.name ?? ""))) {
      matchedCompetencies.set(String(competency.id), competency);
    }
  }

  const denominator = Math.max(1, concepts.length);
  let score = Math.round((conceptStrengthTotal / denominator) * 100);
  if (experienceMatch) score = 100;
  if (
    concepts.length === 0 &&
    (matchedSkills.size > 0 || matchedCompetencies.size > 0)
  ) {
    const strengths = [
      ...[...matchedSkills.keys()].map((id) =>
        capabilityStrength(knowledge.capabilityLevels.get(id)),
      ),
      ...[...matchedCompetencies.keys()].map((id) =>
        capabilityStrength(knowledge.competencyLevels.get(id)),
      ),
    ]
      .filter((strength): strength is number => strength !== null);
    score = Math.round(
      100 * (strengths.length ? Math.max(...strengths) : 0.7),
    );
  }
  const genericTesting =
    concepts.some((concept) => concept.key === "testing-frameworks") &&
    knowledge.skills.some((skill) => /software testing/.test(skillText(skill)));
  if (score === 0 && genericTesting) score = 55;
  if (
    requirement.kind === "experience" &&
    requirement.minimumYears !== null &&
    !experienceMatch
  ) {
    score = Math.min(score, 45);
  }

  const match: JobRequirementResult["match"] =
    score >= 75
      ? "matched"
      : score >= 25
        ? "partial"
        : "uncertain";
  const skills = [...matchedSkills.values()];
  const records = [...matchedEvidence.values()];
  const competencies = [...matchedCompetencies.values()];
  const evidence = [
    ...skills.slice(0, 5).map((skill) => {
      const level = knowledge.capabilityLevels.get(String(skill.id));
      return `Skill: ${skill.name}${level ? ` (${humaniseLevel(level)})` : " (level not assessed)"}`;
    }),
    ...competencies.slice(0, 3).map((competency) => {
      const level = knowledge.competencyLevels.get(String(competency.id));
      return `Competency: ${competency.name}${level ? ` (${humaniseLevel(level)})` : " (level not assessed)"}`;
    }),
    ...records.slice(0, 4).map((item) => String(item.title)),
  ];
  return {
    text: requirement.text,
    kind: requirement.kind,
    required: requirement.priority === "required",
    match,
    score,
    outcome:
      match === "matched"
        ? "supported"
        : match === "partial"
          ? "partially_supported"
          : "unknown",
    criticality: requirementCriticality(requirement),
    confidence:
      match === "uncertain"
        ? 0
        : Math.min(1, 0.55 + evidence.length * 0.08),
    explanation: match === "matched"
      ? `Confirmed skills, competencies and evidence support ${coveredConcepts || 1} of ${denominator} relevant areas, adjusted for your assessed proficiency.`
      : match === "partial"
        ? "Related evidence exists, but part of this combined requirement still needs strengthening."
        : "No confirmed evidence was found. This remains unknown and is not proof that you lack the capability.",
    evidence,
    matchedSkillIds: [...matchedSkills.keys()],
    matchedEvidenceIds: [...matchedEvidence.keys()],
  };
}

function requirementCriticality(
  requirement: JobDescriptionParsing["requirements"][number],
): NonNullable<JobRequirementResult["criticality"]> {
  if (
    requirement.kind === "eligibility" ||
    requirement.kind === "location" ||
    requirement.kind === "language"
  ) {
    return "eligibility";
  }
  if (requirement.priority === "preferred") return "preferred";
  if (requirement.priority === "unclear") return "unclear";
  return ["skill", "experience", "education", "certification"].includes(
    requirement.kind,
  )
    ? "mandatory_core"
    : "important";
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function capabilityStrength(level: string | undefined): number | null {
  if (!level) return null;
  return {
    learning: 0.25,
    basic: 0.45,
    working: 0.65,
    strong: 0.85,
    expert: 1,
  }[level] ?? null;
}

function humaniseLevel(level: string) {
  return level === "working" ? "Working proficiency" : humaniseWord(level);
}

function humaniseWord(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function assessDirection(parsed: JobDescriptionParsing, modes: Row[]) {
  const role = normalise(`${parsed.role.title ?? ""} ${parsed.role.seniority}`);
  const targets = modes.flatMap((mode) => [
    String(mode.name ?? ""),
    String(mode.purpose ?? ""),
    ...((mode.target_role_families as unknown[] | null) ?? []).map((target) =>
      typeof target === "object" && target !== null && "name" in target
        ? String((target as { name: unknown }).name)
        : String(target),
    ),
  ]);
  const matches = targets.filter((target) =>
    significantWords(target).some((word) => role.includes(word)),
  );
  return {
    score: matches.length ? 90 : 50,
    assessed: matches.length > 0,
  };
}

const CONCEPTS = [
  { key: "frontend", jobTerms: ["frontend", "front end"], evidenceTerms: ["frontend", "front end"] },
  { key: "customer-ui", jobTerms: ["customer-facing", "customer facing"], evidenceTerms: ["onboarding", "authentication", "payment", "responsive interface", "user experience"] },
  { key: "javascript", jobTerms: ["javascript"], evidenceTerms: ["javascript"] },
  { key: "typescript", jobTerms: ["typescript"], evidenceTerms: ["typescript"] },
  { key: "react", jobTerms: ["react"], evidenceTerms: ["react"] },
  { key: "html", jobTerms: ["html"], evidenceTerms: ["html5", "html"] },
  { key: "css", jobTerms: ["css"], evidenceTerms: ["css", "tailwind"] },
  { key: "performance", jobTerms: ["performance", "lighthouse", "core web vitals"], evidenceTerms: ["performance optimisation", "performance optimization", "browser performance"] },
  { key: "accessibility", jobTerms: ["accessibility", "wcag"], evidenceTerms: ["accessibility", "wcag"] },
  { key: "api", jobTerms: ["backend api", "apis", "api integration"], evidenceTerms: ["rest api", "apis", "api integration"] },
  { key: "design-systems", jobTerms: ["design system"], evidenceTerms: ["design system", "component based architecture", "reusable component"] },
  { key: "mobile", jobTerms: ["mobile app", "mobile application"], evidenceTerms: ["react native", "coachcanvas", "mobile"] },
  { key: "testing-frameworks", jobTerms: ["jest", "cypress", "testing library", "testing framework"], evidenceTerms: ["jest", "cypress", "testing library"] },
  { key: "testing", jobTerms: ["testing", "tested"], evidenceTerms: ["software testing", "testing"] },
  { key: "deployment", jobTerms: ["deploying", "deployment", "deployed"], evidenceTerms: ["firebase hosting", "hosting", "deployed"] },
  { key: "usability", jobTerms: ["usability"], evidenceTerms: ["ux research", "usability", "user flows"] },
  { key: "responsive", jobTerms: ["responsiveness", "responsive"], evidenceTerms: ["responsive ui", "responsive web"] },
  { key: "visual-polish", jobTerms: ["visual polish", "attention to detail"], evidenceTerms: ["ui design", "figma", "design system", "adobe xd"] },
  { key: "localisation", jobTerms: ["localization", "internationalization", "i18n"], evidenceTerms: ["localization", "internationalization", "i18n"] },
  { key: "ux", jobTerms: ["ui/ux", "ux", "user experience"], evidenceTerms: ["ux research", "creative digital media and ux", "ui design", "user flows"] },
  { key: "design-collaboration", jobTerms: ["partner closely with design", "collaborate with designers", "work closely with designers"], evidenceTerms: ["cross functional collaboration", "figma", "design system", "ux research"] },
  { key: "observability", jobTerms: ["observability", "sentry"], evidenceTerms: ["sentry", "observability"] },
  { key: "backend", jobTerms: ["backend", "full stack"], evidenceTerms: ["backend concepts", "rest api", "firebase", "supabase"] },
  { key: "agile", jobTerms: ["agile environment", "agile team", "agile"], evidenceTerms: ["agile scrum", "agile"] },
  { key: "cross-functional", jobTerms: ["cross-functional", "cross functional", "collaborate effectively"], evidenceTerms: ["cross functional collaboration", "cross-functional collaboration"] },
  { key: "codebase-maintenance", jobTerms: ["existing codebase", "living codebase", "technical debt", "non-trivial codebase", "non trivial codebase"], evidenceTerms: ["codebase navigation", "technical debt", "legacy code", "refactoring", "code maintenance"] },
] as const;

function hasSufficientFrontendExperience(
  evidence: Row[],
  minimumYears: number | null,
) {
  const dated = evidence
    .filter((item) => /front ?end/.test(normalise(`${item.title} ${item.narrative}`)))
    .flatMap((item) => {
      const attributes = item.attributes as {
        dates?: { start?: unknown; end?: unknown; isCurrent?: unknown };
      } | null;
      const start = parseMonth(attributes?.dates?.start);
      const end =
        attributes?.dates?.isCurrent === true
          ? new Date().getUTCFullYear() * 12 + new Date().getUTCMonth()
          : parseMonth(attributes?.dates?.end);
      return start !== null && end !== null ? [{ start, end }] : [];
    });
  if (!dated.length) {
    return minimumYears === null &&
      evidence.some((item) =>
        /front ?end/.test(normalise(`${item.title} ${item.narrative}`)),
      );
  }
  const ranges = dated
    .sort((left, right) => left.start - right.start)
    .reduce<Array<{ start: number; end: number }>>((merged, range) => {
      const previous = merged.at(-1);
      if (previous && range.start <= previous.end + 1) {
        previous.end = Math.max(previous.end, range.end);
      } else {
        merged.push({ ...range });
      }
      return merged;
    }, []);
  const months = ranges.reduce(
    (total, range) => total + range.end - range.start + 1,
    0,
  );
  return months >= (minimumYears ?? 2) * 12;
}

function parseMonth(value: unknown) {
  if (typeof value !== "string") return null;
  const year = Number(value.match(/\b(19|20)\d{2}\b/)?.[0]);
  if (!year) return null;
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const monthName = value.slice(0, 3).toLowerCase();
  const month = monthNames.indexOf(monthName);
  return year * 12 + Math.max(month, 0);
}

function deterministicJobParse(description: string) {
  const requirementHeading =
    /^(requirements?|qualifications?|what you(?:'|’)ll bring|what we(?:'|’)re looking for|about you|your experience|skills(?: and experience)?|who you are)\s*:?\s*$/i;
  const stopHeading =
    /^(responsibilities|what you(?:'|’)ll do|the role|about (?:us|the company|the team)|benefits|what we offer|compensation|salary|how to apply|application)\s*:?\s*$/i;
  const explicitRequirement =
    /\b(must|required|essential|minimum|at least|proficien|experience (?:with|in)|knowledge of|familiar(?:ity)? with|ability to|capable of|degree|certification|eligible|authori[sz]ation|work permit)\b/i;
  const headingLike = /^[A-Z][A-Za-z &/'’()-]{2,50}:?$/;
  const candidates: Array<{
    text: string;
    startCharacter: number;
  }> = [];
  let inRequirementSection = false;
  const linePattern = /[^\r\n]+/g;
  for (const match of description.matchAll(linePattern)) {
    const raw = match[0];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (requirementHeading.test(trimmed)) {
      inRequirementSection = true;
      continue;
    }
    if (stopHeading.test(trimmed)) {
      inRequirementSection = false;
      continue;
    }
    const bullet = trimmed.match(/^(?:[•*▪◦‣–—-]|\d+[.)])\s+/);
    const text = bullet ? trimmed.slice(bullet[0].length).trim() : trimmed;
    const isCandidate =
      text.length >= 12 &&
      text.length <= 500 &&
      !headingLike.test(text) &&
      (inRequirementSection || explicitRequirement.test(text));
    if (!isCandidate) continue;
    const rawStart = match.index ?? 0;
    const textOffset = raw.indexOf(text);
    candidates.push({
      text,
      startCharacter: rawStart + Math.max(0, textOffset),
    });
  }

  if (candidates.length === 0) {
    for (const sentence of description.matchAll(/[^.!?\r\n]+[.!?]?/g)) {
      const text = sentence[0].trim();
      if (text.length < 12 || !explicitRequirement.test(text)) continue;
      const offset = sentence[0].indexOf(text);
      candidates.push({
        text,
        startCharacter: (sentence.index ?? 0) + Math.max(0, offset),
      });
    }
  }

  const requirements = candidates
    .slice(0, 18)
    .map(({ text, startCharacter }) => {
      const normalized = normalise(text);
      const priority = /\b(must|required|essential|minimum|need to)\b/.test(
        normalized,
      )
        ? ("required" as const)
        : /\b(preferred|nice to have|bonus|advantage)\b/.test(normalized)
          ? ("preferred" as const)
          : ("unclear" as const);
      const years = text.match(
        /\b(?:at least|minimum of)?\s*(\d+(?:\.\d+)?)\+?\s+years?\b/i,
      );
      return {
        text,
        kind: deterministicRequirementKind(normalized),
        priority,
        normalizedValue: null,
        minimumYears: years ? Number(years[1]) : null,
        evidence: {
          source: {
            quote: text,
            startCharacter,
            endCharacter: startCharacter + text.length,
          },
          confidence: 0.55,
        },
      };
    });
  const data = JobDescriptionParsingSchema.parse({
    role: {
      title: null,
      company: null,
      location: null,
      workArrangement: /\bremote\b/i.test(description)
        ? "remote"
        : /\bhybrid\b/i.test(description)
          ? "hybrid"
          : /\bonsite|on-site|in office\b/i.test(description)
            ? "onsite"
            : "unspecified",
      employmentType: "unspecified",
      seniority: "unspecified",
    },
    requirements,
    responsibilities: [],
    compensation: null,
    benefits: [],
    applicationInstructions: [],
    ambiguities: [
      "AI parsing was unavailable; requirement structure was recovered deterministically.",
    ],
    parsingNotes: ["waypoint-deterministic-job-parser-v1"],
  });
  return {
    data,
    responseId: "deterministic-fallback",
    model: "deterministic-parser",
    promptVersion: "waypoint-deterministic-job-parser-v1",
  };
}

function deterministicRequirementKind(
  text: string,
): JobDescriptionParsing["requirements"][number]["kind"] {
  if (/\bvisa|work permit|authori[sz]ation|eligible|eligibility\b/.test(text)) {
    return "eligibility";
  }
  if (/\blocation|onsite|on site|office|relocat/.test(text)) return "location";
  if (/\bdegree|bachelor|master|phd|education\b/.test(text)) return "education";
  if (/\byears?|commercial|professional experience|worked\b/.test(text)) {
    return "experience";
  }
  if (/\bcertification|certified\b/.test(text)) return "certification";
  return "skill";
}

function inferRoleTitle(
  requirements: JobDescriptionParsing["requirements"],
) {
  const text = normalise(requirements.map((item) => item.text).join(" "));
  if (text.includes("frontend") || text.includes("front end")) {
    return "Frontend Software Engineer";
  }
  if (text.includes("product design")) return "Product Designer";
  if (text.includes("ux")) return "UX role";
  return "Role title not stated";
}

function assessPreferences(
  parsed: JobDescriptionParsing,
  preferences: Row[],
) {
  const job = normalise(
    `${parsed.role.location ?? ""} ${parsed.role.workArrangement} ${parsed.role.employmentType}`,
  );
  let score = 50;
  let assessed = false;
  for (const preference of preferences) {
    const values = preferenceValues(preference.value);
    const matched = values.find((value) => job.includes(normalise(value)));
    if (!matched) continue;
    assessed = true;
    const strength = String(preference.strength);
    score += ["required", "strongly_preferred", "preferred"].includes(strength)
      ? 15
      : ["undesirable", "prohibited"].includes(strength)
        ? -30
        : 0;
  }
  return {
    score: Math.max(0, Math.min(100, score)),
    assessed,
  };
}

function preferenceValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((item) => preferenceValues(item));
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return Object.entries(record)
      .filter(([key]) => !["rank", "reason", "notes"].includes(key))
      .flatMap(([, nested]) => preferenceValues(nested));
  }
  return [];
}

export function selectBestCv(
  cvs: Array<Row & { snapshotStatus: unknown; snapshotText: string }>,
  requirements: Array<JobRequirementResult & { matchedSkillIds: string[]; matchedEvidenceIds: string[] }>,
  roleTitle: string | null,
) {
  const readyCvs = cvs.filter(
    (cv) => cv.snapshotStatus === "ready" && cv.snapshotText.trim().length > 0,
  );
  if (!readyCvs.length) return null;
  const ranked = readyCvs.map((cv) => {
    const eligibleRequirements = requirements.filter(
      (requirement) =>
        requirement.outcome === "supported" ||
        requirement.outcome === "partially_supported",
    );
    const linked = eligibleRequirements.filter((requirement) =>
      requirementIsVisibleInCv(requirement.text, cv.snapshotText),
    );
    const possibleWeight = eligibleRequirements.reduce(
      (sum, item) => sum + criticalityWeight(item.criticality),
      0,
    );
    const linkedWeight = linked.reduce(
      (sum, item) =>
        sum +
        criticalityWeight(item.criticality) *
          (item.outcome === "supported" ? 1 : 0.5),
      0,
    );
    const targetWords = significantWords(
      ((cv.intended_roles as string[] | null) ?? []).join(" "),
    );
    const roleBonus =
      roleTitle &&
      significantWords(roleTitle).some((word) => targetWords.includes(word))
        ? 8
        : 0;
    const score = Math.min(
      100,
      Math.round((possibleWeight ? linkedWeight / possibleWeight : 0) * 100) +
        roleBonus,
    );
    const missingImportantKnowledge = eligibleRequirements
      .filter(
        (requirement) =>
          ["eligibility", "mandatory_core", "important"].includes(
            requirement.criticality ?? "important",
          ) && !linked.includes(requirement),
      )
      .map((requirement) => requirement.text)
      .slice(0, 5);
    return {
      id: String(cv.id),
      name: String(cv.name),
      score,
      primary: cv.is_primary === true,
      reason:
        `${linked.length} of ${eligibleRequirements.length} profile-supported requirements are visibly represented in this CV.`,
      representedRequirements: linked.map((item) => item.text),
      representedCount: linked.length,
      relevantCount: eligibleRequirements.length,
      missingImportantKnowledge,
      suggestedChanges: missingImportantKnowledge.map(
        (item) => `Add verified evidence for: ${item}`,
      ),
    };
  });
  ranked.sort((a, b) => b.score - a.score || Number(b.primary) - Number(a.primary));
  const best = ranked[0];
  return {
    id: best.id,
    name: best.name,
    score: best.score,
    reason: best.reason,
    representedRequirements: best.representedRequirements,
    missingImportantKnowledge: best.missingImportantKnowledge,
    suggestedChanges: best.suggestedChanges,
    representedCount: best.representedCount,
    relevantCount: best.relevantCount,
  };
}

function requirementIsVisibleInCv(
  requirementText: string,
  snapshotText: string,
) {
  if (!snapshotText) return false;
  const requirement = normalise(requirementText);
  const visibleText = normalise(snapshotText);
  const knownConcepts = CONCEPTS.filter((concept) =>
    concept.jobTerms.some((term) => requirement.includes(term)),
  );
  if (knownConcepts.length) {
    return knownConcepts.some((concept) =>
      concept.evidenceTerms.some((term) => visibleText.includes(term)),
    );
  }
  const words = significantWords(requirementText).filter(
    (word) =>
      ![
        "ability",
        "experience",
        "knowledge",
        "required",
        "preferred",
        "strong",
        "using",
        "working",
      ].includes(word),
  );
  if (!words.length) return false;
  const visible = words.filter((word) => visibleText.includes(word)).length;
  return visible >= Math.min(2, words.length);
}

function weightedAverage(requirements: JobRequirementResult[]) {
  const assessed = requirements.filter(
    (requirement) => requirement.outcome !== "unknown",
  );
  if (!assessed.length) return 0;
  const totalWeight = assessed.reduce(
    (sum, item) => sum + criticalityWeight(item.criticality),
    0,
  );
  return Math.round(
    assessed.reduce(
      (sum, item) => sum + item.score * criticalityWeight(item.criticality),
      0,
    ) / totalWeight,
  );
}

function criticalityWeight(
  criticality: JobRequirementResult["criticality"],
) {
  return {
    eligibility: 4,
    mandatory_core: 3,
    important: 2,
    preferred: 1,
    bonus: 0.5,
    unclear: 1,
  }[criticality ?? "important"];
}

function calculateKnowledgeCoverage(requirements: JobRequirementResult[]) {
  if (!requirements.length) return 0;
  const known = requirements.filter(
    (requirement) => requirement.outcome !== "unknown",
  );
  return Math.round((known.length / requirements.length) * 100);
}

function calculateEvidenceConfidence(requirements: JobRequirementResult[]) {
  const known = requirements.filter(
    (requirement) => requirement.outcome !== "unknown",
  );
  return Math.round(average(known.map((item) => item.confidence ?? 0)) * 100);
}

function assessEligibility(requirements: JobRequirementResult[]) {
  const eligibility = requirements.filter(
    (item) => item.criticality === "eligibility",
  );
  if (!eligibility.length) return { score: 50 };
  if (eligibility.some((item) => item.outcome === "conflicts")) {
    return { score: 0 };
  }
  if (eligibility.some((item) => item.outcome === "unknown")) {
    return { score: 50 };
  }
  return { score: 100 };
}

async function persistAnalysis(client: SupabaseClient, input: {
  userId: string;
  description: string;
  parsed: JobDescriptionParsing;
  model: string;
  promptVersion: string;
  recommendation: "apply" | "investigate" | "skip";
  overallScore: number;
  summary: string;
  blockers: string[];
  strengths: string[];
  gaps: string[];
  uncertainties: string[];
  requirements: Array<JobRequirementResult & { matchedSkillIds: string[]; matchedEvidenceIds: string[] }>;
  requirementsScore: number;
  directionScore: number;
  preferenceScore: number;
  eligibilityScore: number;
  evidenceConfidence: number;
  knowledgeCoverage: number;
  semanticStatus: "completed" | "partial_fallback" | "deterministic_only";
  bestCv: JobAnalysisResult["bestCv"];
  knowledgeFingerprint: string;
}) {
  const jobId = randomUUID();
  const analysisId = randomUUID();
  const { error: jobError } = await client.from("jobs").insert({
    id: jobId,
    user_id: input.userId,
    title: input.parsed.role.title,
    company: input.parsed.role.company,
    description_text: input.description,
  });
  if (jobError) throw new Error("Unable to save the job.", { cause: jobError });

  const requirementRows = input.parsed.requirements.map((requirement, index) => ({
    id: randomUUID(),
    user_id: input.userId,
    job_id: jobId,
    kind: databaseRequirementKind(requirement.kind),
    requirement_text: requirement.text,
    is_required: requirement.priority === "required",
    confidence: requirement.evidence.confidence,
    source_start: requirement.evidence.source.startCharacter,
    source_end: requirement.evidence.source.endCharacter,
    metadata: {
      normalized_value: requirement.normalizedValue,
      minimum_years: requirement.minimumYears,
      priority: requirement.priority,
    },
    atomic_statement: requirement.text,
    criticality:
      input.requirements[index]?.criticality ??
      requirementCriticality(requirement),
    requested_concept: requirement.normalizedValue,
    requested_context:
      requirement.kind === "experience" ? "professional" : "familiarity",
    criticality_is_explicit: requirement.priority !== "unclear",
    parser_confidence: requirement.evidence.confidence,
  }));
  if (requirementRows.length) {
    const { error } = await client.from("job_requirements").insert(requirementRows);
    if (error) throw new Error("Unable to save job requirements.", { cause: error });
  }
  const result = {
    blockers: input.blockers,
    strengths: input.strengths,
    gaps: input.gaps,
    uncertainties: input.uncertainties,
    requirements: input.requirements.map((requirement) => ({
      text: requirement.text,
      kind: requirement.kind,
      required: requirement.required,
      match: requirement.match,
      score: requirement.score,
      outcome: requirement.outcome,
      criticality: requirement.criticality,
      confidence: requirement.confidence,
      explanation: requirement.explanation,
      evidence: requirement.evidence,
    })),
    scores: {
      requirements: input.requirementsScore,
      careerDirection: input.directionScore,
      preferences: input.preferenceScore,
      eligibility: input.eligibilityScore,
      evidenceConfidence: input.evidenceConfidence,
      knowledgeCoverage: input.knowledgeCoverage,
    },
    semanticStatus: input.semanticStatus,
    parsedRole: input.parsed.role,
    bestCv: input.bestCv,
    knowledgeFingerprint: input.knowledgeFingerprint,
    analysisEngineVersion: ANALYSIS_ENGINE_VERSION,
  };
  const { error: analysisError } = await client.from("analyses").insert({
    id: analysisId,
    user_id: input.userId,
    job_id: jobId,
    // CV System v2 is intentionally separate from the retired cv_versions FK.
    selected_cv_version_id: null,
    recommendation: input.recommendation,
    overall_score: input.overallScore,
    confidence: input.evidenceConfidence / 100,
    summary: input.summary,
    result,
    status: "completed",
    model_id: input.model,
    prompt_version: input.promptVersion,
    schema_version: "job-analysis-v2",
    scoring_policy_version: "waypoint-evidence-aware-v2",
    completed_at: new Date().toISOString(),
  });
  if (analysisError) throw new Error("Unable to save the analysis.", { cause: analysisError });
  return { jobId, analysisId };
}

function databaseRequirementKind(kind: string) {
  if (["eligibility", "experience", "skill", "education"].includes(kind)) return kind;
  if (kind === "location" || kind === "language") return "eligibility";
  return "other";
}

function buildSummary(
  recommendation: "apply" | "investigate" | "skip",
  score: number,
  strengths: number,
  blockers: number,
  gaps: number,
) {
  const action =
    recommendation === "apply"
      ? "This looks worth applying for."
      : recommendation === "investigate"
        ? "Investigate the open questions before deciding."
        : "This is currently a weak fit.";
  const gapSummary =
    blockers > 0
      ? `${blockers} required ${plural(blockers, "area")} still need confirmed evidence`
      : gaps > 0
        ? `${gaps} ${plural(gaps, "area")} need further evidence`
        : "no unresolved evidence concerns";
  return `${action} The evidence-based fit score is ${score}/100, with ${strengths} clear ${plural(strengths, "strength")} and ${gapSummary}.`;
}

function significantWords(value: string) {
  return normalise(value)
    .split(" ")
    .filter(
      (word) =>
        word.length >= 3 &&
        !["and", "the", "with", "for", "you", "your", "years", "experience", "knowledge"].includes(word),
    );
}

function normalise(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\bfront end\b/g, "frontend")
    .trim();
}

function containsPhrase(text: string, candidate: string) {
  const phrase = normalise(candidate);
  if (phrase.length < 2) return false;
  return ` ${text} `.includes(` ${phrase} `);
}

function plural(count: number, singular: string) {
  return count === 1 ? singular : `${singular}s`;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
