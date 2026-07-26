export type CareerModeKind = "primary_career" | "temporary_income";

export interface RoleFamilyPriority {
  roleFamily: string;
  priority: number;
}

export interface CareerMode {
  id: string;
  candidateId: string;
  kind: CareerModeKind;
  name: string;
  purpose: string;
  displayPriority: number;
  targetRoleFamilies: RoleFamilyPriority[];
  suitableRoleFamilies: string[];
  prohibitedRoleFamilies: string[];
  scoringPolicyVersion: string;
  active: boolean;
  status?: "proposed" | "confirmed" | "rejected" | "superseded" | "stale";
}

export function createDefaultCareerModes(
  candidateId: string,
): [CareerMode, CareerMode] {
  return [
    {
      id: "primary-career",
      candidateId,
      kind: "primary_career",
      name: "Primary career",
      purpose:
        "Build a permanent career in frontend engineering, product engineering, UX engineering, and product or UX design.",
      displayPriority: 1,
      targetRoleFamilies: [
        { roleFamily: "Frontend Engineer", priority: 1 },
        { roleFamily: "Product Engineer", priority: 2 },
        { roleFamily: "UX Engineer", priority: 3 },
        { roleFamily: "Product Designer", priority: 4 },
        { roleFamily: "UX Designer", priority: 5 },
        { roleFamily: "UI Designer", priority: 6 },
      ],
      suitableRoleFamilies: [],
      prohibitedRoleFamilies: [],
      scoringPolicyVersion: "primary-career-v2",
      active: true,
      status: "confirmed",
    },
    {
      id: "temporary-income",
      candidateId,
      kind: "temporary_income",
      name: "Temporary income",
      purpose:
        "Find professional office-based income while the primary career search continues.",
      displayPriority: 2,
      targetRoleFamilies: [],
      suitableRoleFamilies: [
        "Trust & Safety",
        "Operations",
        "Business Support",
        "Digital Analyst",
        "Technical Support",
        "QA",
        "Non-sales Customer Success",
        "Professional office",
        "Technology-adjacent",
      ],
      prohibitedRoleFamilies: [
        "Retail",
        "Restaurants",
        "Supermarkets",
        "Shops",
        "Warehouse",
        "Delivery",
        "Caretaking",
        "Manual labour",
      ],
      scoringPolicyVersion: "temporary-income-v2",
      active: true,
      status: "confirmed",
    },
  ];
}

export function selectCareerMode(
  modes: CareerMode[],
  selectedModeId: string | undefined,
): CareerMode {
  if (!selectedModeId) {
    throw new Error("A career mode must be selected explicitly.");
  }
  const selected = modes.find(
    (mode) =>
      mode.id === selectedModeId &&
      mode.active &&
      mode.status !== "proposed" &&
      mode.status !== "rejected" &&
      mode.status !== "superseded" &&
      mode.status !== "stale",
  );
  if (!selected) throw new Error("The selected career mode is not active.");
  return selected;
}

export function reconcileSeededCareerModes(
  seeded: CareerMode[],
  imported: CareerMode[],
): CareerMode[] {
  const byStableId = new Map(seeded.map((mode) => [mode.id, mode]));
  for (const mode of imported) {
    if (!byStableId.has(mode.id)) byStableId.set(mode.id, mode);
  }
  return [...byStableId.values()];
}
