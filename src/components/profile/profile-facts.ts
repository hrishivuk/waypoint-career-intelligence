import type {
  FactConfirmation,
  ProfileFact,
  ProfileFactCategory,
} from "@/domain/profile";

export type { FactConfirmation, ProfileFact, ProfileFactCategory };

export const categoryOptions: ReadonlyArray<{
  value: ProfileFactCategory;
  label: string;
  prompt: string;
}> = [
  {
    value: "career_goal",
    label: "Goals",
    prompt: "The direction you want your career to take.",
  },
  {
    value: "interest",
    label: "Interests",
    prompt: "Work, industries, and problems that energise you.",
  },
  {
    value: "preference",
    label: "Preferences",
    prompt: "How, where, and with whom you prefer to work.",
  },
  {
    value: "deal_breaker",
    label: "Deal-breakers",
    prompt: "Conditions that would make you decline a role.",
  },
  {
    value: "eligibility",
    label: "Eligibility",
    prompt: "Location, visa, availability, or other constraints.",
  },
  {
    value: "skill",
    label: "Skills",
    prompt: "Capabilities you can confidently use.",
  },
  {
    value: "experience",
    label: "Experience",
    prompt: "Work, projects, and responsibilities you have completed.",
  },
  {
    value: "achievement",
    label: "Evidence and achievements",
    prompt: "Specific results that demonstrate your impact.",
  },
  {
    value: "education",
    label: "Education",
    prompt: "Relevant qualifications, courses, and training.",
  },
  {
    value: "writing_style",
    label: "Writing style",
    prompt: "How you want CVs and applications to sound.",
  },
];

export const categoryLabel = new Map(
  categoryOptions.map(({ value, label }) => [value, label]),
);

export const confirmationLabel: Record<FactConfirmation, string> = {
  proposed: "Needs review",
  confirmed: "Confirmed",
  rejected: "Rejected",
  superseded: "Superseded",
  stale: "Needs reconfirmation",
};

export function normaliseFact(input: ProfileFact): ProfileFact {
  const confirmation =
    (input.confirmation as FactConfirmation | "candidate") === "candidate"
      ? "proposed"
      : input.confirmation;

  return {
    ...input,
    confirmation,
    tags: input.tags ?? [],
    provenance: input.provenance ?? [],
  };
}
