import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import * as documents from "./index";

describe("document text extraction", () => {
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
