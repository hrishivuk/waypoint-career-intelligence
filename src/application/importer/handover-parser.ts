import { validateHandoverRecordsV11 } from "../../domain/knowledge";

export const HANDOVER_V11_SECTIONS = [
  "Stable facts",
  "Career modes",
  "Preferences and constraints",
  "Decision policies",
  "Working style and personality",
  "Coaching profile",
  "Skills and capability assessments",
  "Employment and education evidence",
  "Project and achievement evidence",
  "CV strategy and artefacts",
  "Writing and communication preferences",
  "Temporary state",
  "Historical observations",
  "Uncertain, stale or contradictory information",
] as const;

export interface HandoverDiagnostic {
  code: string;
  message: string;
  line?: number;
  recordId?: string;
}

export interface ParsedHandover {
  envelope?: Record<string, unknown>;
  records: Record<string, unknown>[];
  diagnostics: HandoverDiagnostic[];
}

interface SourceLine {
  text: string;
  number: number;
}

export function parseAndValidateHandoverV11(markdown: string): ParsedHandover {
  const diagnostics: HandoverDiagnostic[] = [];
  if (markdown.length > 2_000_000) {
    return {
      records: [],
      diagnostics: [{
        code: "document.too_large",
        message: "Handover exceeds the 2 MB importer limit.",
      }],
    };
  }
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const envelopeEnd = parseEnvelope(lines, diagnostics);
  const envelope =
    envelopeEnd === undefined
      ? undefined
      : parseYamlMapping(
          lines.slice(1, envelopeEnd).map((text, index) => ({
            text,
            number: index + 2,
          })),
          diagnostics,
          "envelope",
        );

  validateEnvelope(envelope, diagnostics);

  const headings: Array<{ name: string; line: number }> = [];
  for (let index = (envelopeEnd ?? -1) + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("# ")) {
      headings.push({ name: lines[index].slice(2).trim(), line: index + 1 });
    }
  }
  if (
    headings.length !== HANDOVER_V11_SECTIONS.length ||
    headings.some(
      (heading, index) => heading.name !== HANDOVER_V11_SECTIONS[index],
    )
  ) {
    diagnostics.push({
      code: "sections.invalid",
      message: `Expected exactly ${HANDOVER_V11_SECTIONS.length} ordered sections.`,
      line: headings.find(
        (heading, index) => heading.name !== HANDOVER_V11_SECTIONS[index],
      )?.line,
    });
  }

  const records: Record<string, unknown>[] = [];
  let fenceStart: number | undefined;
  for (let index = (envelopeEnd ?? -1) + 1; index < lines.length; index += 1) {
    if (lines[index] === "```yaml") {
      if (fenceStart !== undefined) {
        diagnostics.push({
          code: "yaml.nested_fence",
          message: "A YAML fence cannot start inside another YAML fence.",
          line: index + 1,
        });
      } else {
        fenceStart = index;
      }
    } else if (lines[index] === "```" && fenceStart !== undefined) {
      const parsed = parseYamlMapping(
        lines.slice(fenceStart + 1, index).map((text, offset) => ({
          text,
          number: fenceStart! + offset + 2,
        })),
        diagnostics,
        `record ${records.length + 1}`,
      );
      if (parsed) records.push(parsed);
      fenceStart = undefined;
    }
  }
  if (fenceStart !== undefined) {
    diagnostics.push({
      code: "yaml.unclosed_fence",
      message: "YAML record fence is not closed.",
      line: fenceStart + 1,
    });
  }
  if (records.length > 500) {
    diagnostics.push({
      code: "records.too_many",
      message: "Handover exceeds the 500-record importer limit.",
    });
  }

  for (const record of records) {
    if (record.status !== "proposed") {
      diagnostics.push({
        code: "lifecycle.not_proposed",
        message: "Handover records must remain proposed.",
        recordId: typeof record.id === "string" ? record.id : undefined,
      });
    }
  }
  const schema = validateHandoverRecordsV11(records);
  for (const error of schema.errors) {
    diagnostics.push({ code: "record.invalid", message: error });
  }
  validateReferences(records, diagnostics);
  validateSemantics(records, diagnostics);

  return {
    envelope,
    records,
    diagnostics: sortDiagnostics(diagnostics),
  };
}

function parseEnvelope(
  lines: string[],
  diagnostics: HandoverDiagnostic[],
): number | undefined {
  if (lines[0] !== "---") {
    diagnostics.push({
      code: "envelope.missing",
      message: "Document must begin with YAML front matter.",
      line: 1,
    });
    return undefined;
  }
  const end = lines.indexOf("---", 1);
  if (end < 0) {
    diagnostics.push({
      code: "envelope.unclosed",
      message: "YAML front matter is not closed.",
      line: 1,
    });
    return undefined;
  }
  return end;
}

function validateEnvelope(
  envelope: Record<string, unknown> | undefined,
  diagnostics: HandoverDiagnostic[],
): void {
  if (!envelope) return;
  const expected = {
    format: "waypoint-career-handover",
    version: "1.1",
    subject: "user",
  };
  for (const [field, value] of Object.entries(expected)) {
    if (String(envelope[field]) !== value) {
      diagnostics.push({
        code: `envelope.${field}`,
        message: `${field} must equal ${value}.`,
      });
    }
  }
  if (
    typeof envelope.generator !== "string" ||
    envelope.generator.trim() === ""
  ) {
    diagnostics.push({
      code: "envelope.generator",
      message: "generator is required.",
    });
  }
  if (
    typeof envelope.generated_at !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      envelope.generated_at,
    )
  ) {
    diagnostics.push({
      code: "envelope.generated_at",
      message: "generated_at must be an ISO 8601 timestamp.",
    });
  }
}

function parseYamlMapping(
  source: SourceLine[],
  diagnostics: HandoverDiagnostic[],
  label: string,
): Record<string, unknown> | undefined {
  try {
    const content = source.filter(({ text }) => text.trim() && !text.trim().startsWith("#"));
    if (content.length === 0) throw new YamlSubsetError("Mapping is empty.", source[0]?.number);
    const parser = new NarrowYamlParser(content);
    const value = parser.parse();
    if (!isMapping(value)) {
      throw new YamlSubsetError(`${label} must contain one mapping.`, content[0].number);
    }
    return value;
  } catch (error) {
    diagnostics.push({
      code: "yaml.malformed",
      message: error instanceof Error ? error.message : "Malformed YAML.",
      line: error instanceof YamlSubsetError ? error.line : source[0]?.number,
    });
    return undefined;
  }
}

class YamlSubsetError extends Error {
  constructor(message: string, readonly line?: number) {
    super(message);
  }
}

class NarrowYamlParser {
  private index = 0;

  constructor(private readonly lines: SourceLine[]) {}

  parse(): unknown {
    const value = this.parseBlock(indentation(this.lines[0]));
    if (this.index !== this.lines.length) {
      throw new YamlSubsetError("Unexpected YAML content.", this.lines[this.index].number);
    }
    return value;
  }

  private parseBlock(indent: number): unknown {
    const line = this.lines[this.index];
    if (indentation(line) !== indent) {
      throw new YamlSubsetError("Invalid indentation.", line.number);
    }
    return line.text.slice(indent).startsWith("-")
      ? this.parseSequence(indent)
      : this.parseMapping(indent);
  }

  private parseMapping(indent: number): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      const currentIndent = indentation(line);
      if (currentIndent < indent) break;
      if (currentIndent > indent) {
        throw new YamlSubsetError("Unexpected indentation.", line.number);
      }
      const text = line.text.slice(indent);
      if (text.startsWith("-")) break;
      const separator = findUnquotedColon(text);
      if (separator <= 0) {
        throw new YamlSubsetError("Expected key: value mapping.", line.number);
      }
      const key = text.slice(0, separator).trim();
      if (!/^[a-z_][a-z0-9_]*$/.test(key)) {
        throw new YamlSubsetError(`Invalid mapping key ${key}.`, line.number);
      }
      if (Object.hasOwn(result, key)) {
        throw new YamlSubsetError(`Duplicate key ${key}.`, line.number);
      }
      const raw = text.slice(separator + 1).trim();
      this.index += 1;
      if (raw) {
        result[key] = parseScalar(raw, line.number);
      } else {
        if (
          this.index < this.lines.length &&
          indentation(this.lines[this.index]) === indent &&
          this.lines[this.index].text.slice(indent).startsWith("-")
        ) {
          // YAML permits an "indentless" sequence as a mapping value.
          result[key] = this.parseSequence(indent);
          continue;
        }
        if (
          this.index >= this.lines.length ||
          indentation(this.lines[this.index]) <= indent
        ) {
          result[key] = null;
        } else {
          result[key] = this.parseBlock(indentation(this.lines[this.index]));
        }
      }
    }
    return result;
  }

  private parseSequence(indent: number): unknown[] {
    const result: unknown[] = [];
    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      if (indentation(line) !== indent) break;
      const text = line.text.slice(indent);
      if (!text.startsWith("-")) break;
      const raw = text.slice(1).trim();
      this.index += 1;
      if (!raw) {
        if (
          this.index >= this.lines.length ||
          indentation(this.lines[this.index]) <= indent
        ) {
          throw new YamlSubsetError("Sequence item cannot be empty.", line.number);
        }
        result.push(this.parseBlock(indentation(this.lines[this.index])));
        continue;
      }
      const separator = findUnquotedColon(raw);
      if (separator > 0 && /^[a-z_][a-z0-9_]*$/.test(raw.slice(0, separator))) {
        const item: Record<string, unknown> = {};
        const key = raw.slice(0, separator);
        const value = raw.slice(separator + 1).trim();
        item[key] = value ? parseScalar(value, line.number) : null;
        if (
          this.index < this.lines.length &&
          indentation(this.lines[this.index]) > indent
        ) {
          const continuation = this.parseMapping(indentation(this.lines[this.index]));
          Object.assign(item, continuation);
        }
        result.push(item);
      } else {
        result.push(parseScalar(raw, line.number));
      }
    }
    return result;
  }
}

function parseScalar(raw: string, line: number): unknown {
  if (raw === "[]") return [];
  if (raw === "{}") return {};
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.startsWith("'")) {
    if (!raw.endsWith("'")) throw new YamlSubsetError("Unclosed quoted scalar.", line);
    return raw.slice(1, -1).replace(/''/g, "'");
  }
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw);
    } catch {
      throw new YamlSubsetError("Invalid double-quoted scalar.", line);
    }
  }
  if (/[\[\]{}]|[&*!|>]/.test(raw)) {
    throw new YamlSubsetError("Unsupported YAML scalar syntax.", line);
  }
  return raw;
}

function findUnquotedColon(text: string): number {
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if ((character === "'" || character === '"') && text[index - 1] !== "\\") {
      quote = quote === character ? undefined : quote ?? character;
    } else if (character === ":" && !quote) {
      return index;
    }
  }
  return -1;
}

function indentation(line: SourceLine): number {
  const match = line.text.match(/^ */);
  const indent = match?.[0].length ?? 0;
  if (indent > 40) {
    throw new YamlSubsetError(
      "YAML nesting exceeds the importer limit.",
      line.number,
    );
  }
  if (line.text.slice(0, indent).includes("\t")) {
    throw new YamlSubsetError("Tabs are not allowed for indentation.", line.number);
  }
  return indent;
}

function validateSemantics(
  records: Record<string, unknown>[],
  diagnostics: HandoverDiagnostic[],
): void {
  const primary = records.find(
    (record) => record.type === "career_mode" && record.id === "primary-career",
  );
  if (
    primary &&
    Array.isArray(primary.prohibited_role_families) &&
    primary.prohibited_role_families.length > 0
  ) {
    diagnostics.push({
      code: "mode.primary_unsupported_prohibition",
      message: "Primary career mode cannot add unsupported prohibited families.",
      recordId: "primary-career",
    });
  }

  const temporary = records.find(
    (record) =>
      record.type === "career_mode" && record.id === "temporary-income",
  );
  if (temporary && Array.isArray(temporary.target_role_families)) {
    const roles = temporary.target_role_families.flatMap((item) =>
      isMapping(item) && typeof item.role === "string" ? [item.role] : [],
    );
    if (
      !roles.includes("Non-sales Customer Success") ||
      roles.includes("Customer Success")
    ) {
      diagnostics.push({
        code: "mode.temporary_customer_success",
        message:
          "Temporary income mode must preserve Non-sales Customer Success.",
        recordId: "temporary-income",
      });
    }
  }

  const policies = records.filter(
    (record) => record.type === "decision_policy",
  );
  const positive = new Set(["increase", "prefer"]);
  const negative = new Set(["decrease", "avoid", "block"]);
  for (let leftIndex = 0; leftIndex < policies.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < policies.length;
      rightIndex += 1
    ) {
      const left = policies[leftIndex];
      const right = policies[rightIndex];
      const sameDecision =
        left.decision_key === right.decision_key &&
        left.priority === right.priority &&
        left.mode === right.mode &&
        left.operator === right.operator &&
        left.condition_value === right.condition_value;
      const leftScopes = Array.isArray(left.task_scopes)
        ? left.task_scopes
        : [];
      const overlappingScope = Array.isArray(right.task_scopes)
        ? right.task_scopes.some((scope) => leftScopes.includes(scope))
        : false;
      const opposing =
        (positive.has(String(left.effect)) &&
          negative.has(String(right.effect))) ||
        (negative.has(String(left.effect)) &&
          positive.has(String(right.effect)));
      if (sameDecision && overlappingScope && opposing) {
        diagnostics.push({
          code: "policy.equal_priority_conflict",
          message: `Policies ${String(left.id)} and ${String(right.id)} have opposing equal-priority effects.`,
        });
      }
    }
  }
}

function validateReferences(
  records: Record<string, unknown>[],
  diagnostics: HandoverDiagnostic[],
): void {
  const byId = new Map(records.map((record) => [String(record.id), record]));
  const expectedTypes: Record<string, string | undefined> = {
    evidence_refs: "evidence",
    skill_ref: "skill",
    parent_ref: "evidence",
    related_refs: undefined,
    contradicts: undefined,
    cv_artifact_refs: "cv_artifact",
    supersedes: "cv_artifact",
  };
  for (const record of records) {
    for (const [field, expectedType] of Object.entries(expectedTypes)) {
      const value = record[field];
      const references =
        typeof value === "string"
          ? [value]
          : Array.isArray(value)
            ? value.filter((item): item is string => typeof item === "string")
            : [];
      for (const reference of references) {
        const target = byId.get(reference);
        if (!target) {
          diagnostics.push({
            code: "reference.missing",
            message: `${field} references unknown record ${reference}.`,
            recordId: String(record.id),
          });
        } else if (expectedType && target.type !== expectedType) {
          diagnostics.push({
            code: "reference.type",
            message: `${field} must reference ${expectedType}, not ${String(target.type)}.`,
            recordId: String(record.id),
          });
        }
      }
    }
  }
}

function sortDiagnostics(
  diagnostics: HandoverDiagnostic[],
): HandoverDiagnostic[] {
  return diagnostics.sort(
    (left, right) =>
      (left.line ?? Number.MAX_SAFE_INTEGER) -
        (right.line ?? Number.MAX_SAFE_INTEGER) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
