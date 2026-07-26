import { createHash } from "node:crypto";

import type {
  HandoverImportStaging,
  StagedHandoverImport,
} from "../handover-import";
import {
  parseAndValidateHandoverV11,
  type HandoverDiagnostic,
} from "./handover-parser";

export type StageHandoverResult =
  | {
      status: "invalid";
      diagnostics: HandoverDiagnostic[];
    }
  | {
      status: "staged";
      diagnostics: [];
      import: StagedHandoverImport;
      contentHash: string;
    };

export async function validateAndStageHandoverV11(input: {
  markdown: string;
  candidateId: string;
  sourceDocumentId: string;
  staging: HandoverImportStaging;
}): Promise<StageHandoverResult> {
  const parsed = parseAndValidateHandoverV11(input.markdown);
  if (parsed.diagnostics.length > 0) {
    return { status: "invalid", diagnostics: parsed.diagnostics };
  }

  const contentHash = createHash("sha256")
    .update(input.markdown, "utf8")
    .digest("hex");
  const staged = await input.staging.stageProposedImport({
    candidateId: input.candidateId,
    sourceDocumentId: input.sourceDocumentId,
    specificationVersion: "1.1",
    contentHash,
    candidates: parsed.records,
    metadata: {
      format: parsed.envelope?.format,
      generated_at: parsed.envelope?.generated_at,
      generator: parsed.envelope?.generator,
    },
  });

  if (staged.candidateCount !== parsed.records.length) {
    throw new Error(
      "Staged candidate count does not match the validated handover.",
    );
  }
  return {
    status: "staged",
    diagnostics: [],
    import: staged,
    contentHash,
  };
}
