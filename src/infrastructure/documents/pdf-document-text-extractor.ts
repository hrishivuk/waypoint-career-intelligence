import "server-only";

import {
  DocumentTextExtractionError,
  type DocumentTextExtractor,
  type DocumentToExtract,
  PDF_MIME_TYPE,
  normaliseExtractedText,
} from "./document-text-extractor";

export interface PdfTextEngine {
  parse(bytes: Uint8Array): Promise<{
    text: string;
    pageCount?: number;
  }>;
}

export class PdfDocumentTextExtractor implements DocumentTextExtractor {
  constructor(private readonly engine: PdfTextEngine) {}

  supports(mimeType: string) {
    return mimeType.toLowerCase() === PDF_MIME_TYPE;
  }

  async extract(document: DocumentToExtract) {
    try {
      const result = await this.engine.parse(document.bytes);
      const text = normaliseExtractedText(result.text);
      if (!text) {
        throw new DocumentTextExtractionError(
          "pdf",
          "The PDF contains no extractable text.",
        );
      }
      return { text, pageCount: result.pageCount };
    } catch (error) {
      if (error instanceof DocumentTextExtractionError) throw error;
      throw new DocumentTextExtractionError(
        "pdf",
        "Unable to extract text from the PDF.",
        { cause: error },
      );
    }
  }
}
