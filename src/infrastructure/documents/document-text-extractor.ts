import "server-only";

export const PDF_MIME_TYPE = "application/pdf";
export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface DocumentToExtract {
  bytes: Uint8Array;
  mimeType: string;
  filename?: string;
}

export interface ExtractedDocumentText {
  text: string;
  pageCount?: number;
}

export interface DocumentTextBlock {
  id: string;
  order: number;
  text: string;
  startCharacter: number;
  endCharacter: number;
}

export interface DocumentTextExtractor {
  supports(mimeType: string): boolean;
  extract(document: DocumentToExtract): Promise<ExtractedDocumentText>;
}

export class UnsupportedDocumentTypeError extends Error {
  constructor(mimeType: string) {
    super(`Document type "${mimeType}" is not supported.`);
    this.name = "UnsupportedDocumentTypeError";
  }
}

export class DocumentTextExtractionError extends Error {
  constructor(
    public readonly format: "pdf" | "docx",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DocumentTextExtractionError";
  }
}

export class RoutedDocumentTextExtractor implements DocumentTextExtractor {
  constructor(private readonly extractors: readonly DocumentTextExtractor[]) {}

  supports(mimeType: string) {
    return this.extractors.some((extractor) => extractor.supports(mimeType));
  }

  async extract(document: DocumentToExtract) {
    const extractor = this.extractors.find((candidate) =>
      candidate.supports(document.mimeType),
    );
    if (!extractor) {
      throw new UnsupportedDocumentTypeError(document.mimeType);
    }
    return extractor.extract(document);
  }
}

export function normaliseExtractedText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v\u00a0]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Produces stable source blocks while retaining exact offsets into the
 * normalised document. AI receives block IDs; application code owns excerpts.
 */
export function createDocumentTextBlocks(
  text: string,
  maximumCharacters = 1200,
): DocumentTextBlock[] {
  if (!text.trim()) return [];
  const blocks: DocumentTextBlock[] = [];
  let cursor = 0;

  for (const paragraph of text.split(/\n{2,}/)) {
    const paragraphStart = text.indexOf(paragraph, cursor);
    if (paragraphStart < 0) continue;
    cursor = paragraphStart + paragraph.length;

    let localStart = 0;
    while (localStart < paragraph.length) {
      let localEnd = Math.min(
        paragraph.length,
        localStart + maximumCharacters,
      );
      if (localEnd < paragraph.length) {
        const boundary = Math.max(
          paragraph.lastIndexOf("\n", localEnd),
          paragraph.lastIndexOf(". ", localEnd),
          paragraph.lastIndexOf("; ", localEnd),
          paragraph.lastIndexOf(" ", localEnd),
        );
        if (boundary > localStart + Math.floor(maximumCharacters * 0.5)) {
          localEnd = boundary + (paragraph[boundary] === "." ? 1 : 0);
        }
      }
      const raw = paragraph.slice(localStart, localEnd);
      const leading = raw.length - raw.trimStart().length;
      const trailing = raw.length - raw.trimEnd().length;
      const startCharacter = paragraphStart + localStart + leading;
      const endCharacter = paragraphStart + localEnd - trailing;
      if (endCharacter > startCharacter) {
        blocks.push({
          id: `block-${String(blocks.length + 1).padStart(4, "0")}`,
          order: blocks.length,
          text: text.slice(startCharacter, endCharacter),
          startCharacter,
          endCharacter,
        });
      }
      localStart = Math.max(localEnd, localStart + 1);
    }
  }
  return blocks;
}
