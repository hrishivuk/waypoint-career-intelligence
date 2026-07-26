import type { StoredProfileFact } from "./contracts";

export interface ProfileFactRepository {
  listByCandidateId(candidateId: string): Promise<StoredProfileFact[]>;
  getById(candidateId: string, factId: string): Promise<StoredProfileFact | null>;
  create(fact: StoredProfileFact): Promise<StoredProfileFact>;
  update(fact: StoredProfileFact): Promise<StoredProfileFact>;
}

export interface ProfileFactIdGenerator {
  generate(): string;
}

export interface ProfileFactClock {
  now(): Date;
}
