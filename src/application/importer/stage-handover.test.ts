import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { HandoverImportStaging } from "../handover-import";
import { validateAndStageHandoverV11 } from "./stage-handover";

const fixture = readFileSync(
  join(
    process.cwd(),
    "src/application/importer/fixtures/handover-v1.1-public.md",
  ),
  "utf8",
);

describe("validateAndStageHandoverV11", () => {
  it("stages the public-safe fixture only after complete validation", async () => {
    const stageProposedImport = vi.fn().mockResolvedValue({
      importRunId: "run-id",
      alreadyStaged: false,
      candidateCount: 83,
    });
    const result = await validateAndStageHandoverV11({
      markdown: fixture,
      candidateId: "candidate-id",
      sourceDocumentId: "document-id",
      staging: { stageProposedImport },
    });

    expect(result).toMatchObject({
      status: "staged",
      import: { candidateCount: 83 },
    });
    expect(stageProposedImport).toHaveBeenCalledWith(
      expect.objectContaining({
        specificationVersion: "1.1",
        candidates: expect.arrayContaining([
          expect.objectContaining({
            id: "primary-career",
            status: "proposed",
          }),
        ]),
      }),
    );
    expect(
      stageProposedImport.mock.calls[0][0].candidates,
    ).toHaveLength(83);
  });

  it("performs no write when document validation fails", async () => {
    const staging: HandoverImportStaging = {
      stageProposedImport: vi.fn(),
    };
    const result = await validateAndStageHandoverV11({
      markdown: fixture.replace("status: proposed", "status: confirmed"),
      candidateId: "candidate-id",
      sourceDocumentId: "document-id",
      staging,
    });

    expect(result.status).toBe("invalid");
    expect(staging.stageProposedImport).not.toHaveBeenCalled();
  });
});
