import type {
  FactConfirmation,
  FactProvenance,
  ProfileFactCategory,
} from "../../domain/profile";

export interface ProfileFactDto {
  id: string;
  category: ProfileFactCategory;
  statement: string;
  tags: string[];
  confirmation: FactConfirmation;
  confidence: number;
  provenance: FactProvenance[];
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

export interface CreateManualProfileFactInput {
  candidateId: string;
  category: ProfileFactCategory;
  statement: string;
  tags?: string[];
}

export interface UpdateProfileFactValueInput {
  candidateId: string;
  factId: string;
  statement?: string;
  confirmation?: FactConfirmation;
}

export interface ListProfileFactsResult {
  facts: ProfileFactDto[];
}

export interface StoredProfileFact {
  id: string;
  candidateId: string;
  category: ProfileFactCategory;
  statement: string;
  tags: string[];
  confirmation: FactConfirmation;
  confidence: number;
  provenance: FactProvenance[];
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

export function toProfileFactDto(fact: StoredProfileFact): ProfileFactDto {
  const {
    id,
    category,
    statement,
    tags,
    confirmation,
    confidence,
    provenance,
    createdAt,
    updatedAt,
    reviewedAt,
  } = fact;
  return {
    id,
    category,
    statement,
    tags,
    confirmation,
    confidence,
    provenance,
    createdAt,
    updatedAt,
    reviewedAt,
  };
}
