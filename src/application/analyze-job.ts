import { confirmedFacts, scoreJobAnalysis, type JobAnalysis } from "../domain";
import type {
  AnalysisRepository,
  CareerProfileRepository,
  Clock,
  EvidenceMatcher,
  IdGenerator,
  JobDescriptionParser,
  JobRepository,
} from "./ports";

export class CareerProfileNotFoundError extends Error {
  constructor(candidateId: string) {
    super(`Career profile not found for candidate ${candidateId}`);
    this.name = "CareerProfileNotFoundError";
  }
}

export interface AnalyzeJobDependencies {
  profiles: CareerProfileRepository;
  jobs: JobRepository;
  analyses: AnalysisRepository;
  parser: JobDescriptionParser;
  matcher: EvidenceMatcher;
  ids: IdGenerator;
  clock: Clock;
}

export class AnalyzeJob {
  constructor(private readonly dependencies: AnalyzeJobDependencies) {}

  async execute(input: {
    candidateId: string;
    description: string;
  }): Promise<JobAnalysis> {
    const profile = await this.dependencies.profiles.getByCandidateId(input.candidateId);
    if (!profile) throw new CareerProfileNotFoundError(input.candidateId);

    const job = await this.dependencies.parser.parse(input);
    if (job.candidateId !== input.candidateId) {
      throw new Error("Parsed job ownership does not match the candidate");
    }

    await this.dependencies.jobs.save(job);
    const evidenceProfile = { ...profile, facts: confirmedFacts(profile) };
    const assessments = await this.dependencies.matcher.assess({
      profile: evidenceProfile,
      job,
    });
    const analysis = scoreJobAnalysis({
      id: this.dependencies.ids.generate(),
      profile,
      job,
      assessments,
      createdAt: this.dependencies.clock.now().toISOString(),
    });
    await this.dependencies.analyses.save(analysis);
    return analysis;
  }
}
