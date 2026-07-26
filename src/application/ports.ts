import type {
  CareerProfile,
  JobAnalysis,
  ParsedJob,
  RequirementAssessment,
} from "../domain";

export interface CareerProfileRepository {
  getByCandidateId(candidateId: string): Promise<CareerProfile | null>;
  save(profile: CareerProfile): Promise<void>;
}

export interface JobRepository {
  getById(jobId: string): Promise<ParsedJob | null>;
  save(job: ParsedJob): Promise<void>;
}

export interface AnalysisRepository {
  getById(analysisId: string): Promise<JobAnalysis | null>;
  listByCandidateId(candidateId: string): Promise<JobAnalysis[]>;
  save(analysis: JobAnalysis): Promise<void>;
}

export interface JobDescriptionParser {
  parse(input: {
    candidateId: string;
    description: string;
  }): Promise<ParsedJob>;
}

export interface EvidenceMatcher {
  assess(input: {
    profile: CareerProfile;
    job: ParsedJob;
  }): Promise<RequirementAssessment[]>;
}

export interface IdentityProvider {
  getCandidateId(): Promise<string>;
}

export interface IdGenerator {
  generate(): string;
}

export interface Clock {
  now(): Date;
}

