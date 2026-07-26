export interface PdfPositionedTextItem {
  str: string;
  transform: Array<number>;
  width: number;
  height: number;
  hasEOL: boolean;
}

/**
 * Reconstructs reading lines from PDF coordinates. PDF.js returns positioned
 * fragments, not paragraphs; joining every fragment with a space destroys the
 * headings an ATS parser depends on.
 */
export function reconstructPdfPageText(
  rawItems: readonly unknown[],
): string {
  const items = rawItems.filter(isPositionedTextItem);
  if (!items.length) return "";

  const lines: string[] = [];
  let current = "";
  let previous: PdfPositionedTextItem | null = null;

  for (const item of items) {
    const value = item.str.trim();
    if (!value) {
      if (item.hasEOL && current.trim()) {
        lines.push(current.trim());
        current = "";
      }
      previous = item;
      continue;
    }

    const y = item.transform[5];
    const previousY = previous?.transform[5];
    const lineTolerance = Math.max(1.5, Math.min(item.height, previous?.height ?? item.height) * 0.35);
    const changedLine = previousY !== undefined && Math.abs(y - previousY) > lineTolerance;

    if (changedLine && current.trim()) {
      lines.push(current.trim());
      current = "";
    }

    if (current) {
      const x = item.transform[4];
      const previousEndX = previous
        ? previous.transform[4] + previous.width
        : x;
      if (x - previousEndX > -0.5) current += " ";
    }
    current += value;

    if (item.hasEOL) {
      lines.push(current.trim());
      current = "";
    }
    previous = item;
  }

  if (current.trim()) lines.push(current.trim());
  return lines.join("\n");
}

function isPositionedTextItem(value: unknown): value is PdfPositionedTextItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PdfPositionedTextItem>;
  return typeof item.str === "string" &&
    Array.isArray(item.transform) &&
    item.transform.length >= 6 &&
    typeof item.transform[4] === "number" &&
    typeof item.transform[5] === "number" &&
    typeof item.width === "number" &&
    typeof item.height === "number" &&
    typeof item.hasEOL === "boolean";
}

