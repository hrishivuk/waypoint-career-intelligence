import "server-only";

import {
  DOCX_MIME_TYPE,
  DocumentTextExtractionError,
  type DocumentTextExtractor,
  type DocumentToExtract,
  normaliseExtractedText,
} from "./document-text-extractor";

export interface DocxTextEngine {
  parse(bytes: Uint8Array): Promise<{ text: string }>;
}

export class DocxDocumentTextExtractor implements DocumentTextExtractor {
  constructor(private readonly engine: DocxTextEngine) {}

  supports(mimeType: string) {
    return mimeType.toLowerCase() === DOCX_MIME_TYPE;
  }

  async extract(document: DocumentToExtract) {
    try {
      const result = await this.engine.parse(document.bytes);
      const text = normaliseExtractedText(result.text);
      if (!text) {
        throw new DocumentTextExtractionError(
          "docx",
          "The DOCX contains no extractable text.",
        );
      }
      return { text };
    } catch (error) {
      if (error instanceof DocumentTextExtractionError) throw error;
      throw new DocumentTextExtractionError(
        "docx",
        "Unable to extract text from the DOCX.",
        { cause: error },
      );
    }
  }
}
