import "server-only";

import { join } from "node:path";
import { pathToFileURL } from "node:url";

import mammoth from "mammoth";

import { DocxDocumentTextExtractor } from "./docx-document-text-extractor";
import { PdfDocumentTextExtractor } from "./pdf-document-text-extractor";
import { reconstructPdfPageText } from "./pdf-layout-text";
import { RoutedDocumentTextExtractor } from "./document-text-extractor";

const MAX_PDF_PAGES = 50;
const MAX_EXTRACTED_CHARACTERS = 200_000;
let pdfJsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | undefined;

export function createDocumentTextExtractor() {
  return new RoutedDocumentTextExtractor([
    new PdfDocumentTextExtractor({
      async parse(bytes) {
        const pdfJs = await loadPdfJs();
        const task = pdfJs.getDocument({
          data: bytes,
          isEvalSupported: false,
          useSystemFonts: true,
          useWorkerFetch: false,
        });
        const document = await task.promise;
        try {
          if (document.numPages > MAX_PDF_PAGES) {
            throw new Error("PDF page limit exceeded.");
          }
          const pages: string[] = [];
          for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
            const page = await document.getPage(pageNumber);
            const content = await page.getTextContent();
            pages.push(reconstructPdfPageText(content.items));
          }
          const text = pages.join("\n\n");
          if (text.length > MAX_EXTRACTED_CHARACTERS) {
            throw new Error("PDF text limit exceeded.");
          }
          return { text, pageCount: document.numPages };
        } finally {
          await document.destroy();
        }
      },
    }),
    new DocxDocumentTextExtractor({
      async parse(bytes) {
        const result = await mammoth.extractRawText({
          buffer: Buffer.from(bytes),
        });
        if (result.value.length > MAX_EXTRACTED_CHARACTERS) {
          throw new Error("DOCX text limit exceeded.");
        }
        return { text: result.value };
      },
    }),
  ]);
}

async function loadPdfJs() {
  pdfJsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfJs) => {
    pdfJs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      join(
        process.cwd(),
        "node_modules",
        "pdfjs-dist",
        "legacy",
        "build",
        "pdf.worker.mjs",
      ),
    ).href;
    return pdfJs;
  });
  return pdfJsPromise;
}
