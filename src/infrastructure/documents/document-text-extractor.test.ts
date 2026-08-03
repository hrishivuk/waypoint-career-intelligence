import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import * as documents from "./index";
import { createDocumentTextExtractor } from "./create-document-text-extractor";

describe("document text extraction", () => {
  it("extracts text through the real lazy-loaded PDF.js engine", async () => {
    await expect(createDocumentTextExtractor().extract({
      bytes: createTextPdf("Waypoint PDF extraction"),
      mimeType: documents.PDF_MIME_TYPE,
    })).resolves.toMatchObject({
      text: "Waypoint PDF extraction",
      pageCount: 1,
    });
  });

  it("routes a PDF and normalises extracted text", async () => {
    const parse = vi.fn(async () => ({
      text: "  Jane\r\n\r\n\r\nSoftware\t Engineer  ",
      pageCount: 2,
    }));
    const pdf = new documents.PdfDocumentTextExtractor({ parse });
    const router = new documents.RoutedDocumentTextExtractor([pdf]);

    await expect(
      router.extract({
        bytes: new Uint8Array([1, 2]),
        mimeType: documents.PDF_MIME_TYPE,
      }),
    ).resolves.toEqual({
      text: "Jane\n\nSoftware Engineer",
      pageCount: 2,
    });
    expect(parse).toHaveBeenCalledWith(new Uint8Array([1, 2]));
  });

  it("routes a DOCX and normalises extracted text", async () => {
    const docx = new documents.DocxDocumentTextExtractor({
      parse: async () => ({ text: "Experience \n Acme" }),
    });
    const router = new documents.RoutedDocumentTextExtractor([docx]);

    await expect(
      router.extract({
        bytes: new Uint8Array([3]),
        mimeType: documents.DOCX_MIME_TYPE,
      }),
    ).resolves.toEqual({ text: "Experience\nAcme" });
  });

  it("reports unsupported document types", async () => {
    const router = new documents.RoutedDocumentTextExtractor([]);
    await expect(
      router.extract({
        bytes: new Uint8Array(),
        mimeType: "text/plain",
      }),
    ).rejects.toBeInstanceOf(documents.UnsupportedDocumentTypeError);
  });

  it("creates exact deterministic source blocks", () => {
    const text =
      "Experience\nAcme — Frontend Engineer\nBuilt accessible React products.\n\nSkills\nReact, TypeScript";
    const blocks = documents.createDocumentTextBlocks(text, 60);

    expect(blocks.length).toBeGreaterThan(1);
    for (const block of blocks) {
      expect(text.slice(block.startCharacter, block.endCharacter)).toBe(
        block.text,
      );
    }
    expect(documents.createDocumentTextBlocks(text, 60)).toEqual(blocks);
  });

  it.each([
    ["pdf", documents.PDF_MIME_TYPE],
    ["docx", documents.DOCX_MIME_TYPE],
  ] as const)("wraps %s parser failures without leaking details", async (format, mimeType) => {
    const parse = async () => {
      throw new Error("parser internals");
    };
    const extractor =
      format === "pdf"
        ? new documents.PdfDocumentTextExtractor({ parse })
        : new documents.DocxDocumentTextExtractor({ parse });

    const error = await extractor
      .extract({ bytes: new Uint8Array([1]), mimeType })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(documents.DocumentTextExtractionError);
    expect(error).toMatchObject({ format });
    expect((error as Error).message).not.toContain("parser internals");
    expect((error as Error & { cause?: unknown }).cause).toBeInstanceOf(Error);
  });

  it.each([
    [
      new documents.PdfDocumentTextExtractor({
        parse: async () => ({ text: " \n " }),
      }),
      documents.PDF_MIME_TYPE,
    ],
    [
      new documents.DocxDocumentTextExtractor({
        parse: async () => ({ text: "\t" }),
      }),
      documents.DOCX_MIME_TYPE,
    ],
  ])("rejects documents with no extractable text", async (extractor, mimeType) => {
    await expect(
      extractor.extract({ bytes: new Uint8Array([1]), mimeType }),
    ).rejects.toThrow(/no extractable text/i);
  });
});

function createTextPdf(text: string) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
