export interface KnowledgeLibraryItem {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  confidence: number | null;
  sourceType: string | null;
  tags: string[];
  details: Record<string, unknown>;
}

export interface KnowledgeLibrarySection {
  key: string;
  title: string;
  description: string;
  items: KnowledgeLibraryItem[];
}
