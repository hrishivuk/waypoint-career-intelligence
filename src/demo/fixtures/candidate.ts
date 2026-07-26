export const demoCandidate = {
  id: "demo-jordan-lee",
  name: "Jordan Lee",
  headline: "Frontend & UX Engineer",
  location: "Rotterdam, Netherlands",
  summary:
    "A fictional product-focused frontend engineer who combines React development, accessible interface design and user-centred problem solving.",
  metrics: {
    profileRecords: 42,
    projects: 4,
    cvDocuments: 2,
    jobAnalyses: 3,
  },
  skills: [
    { name: "React", level: "strong" },
    { name: "TypeScript", level: "strong" },
    { name: "Accessibility", level: "working" },
    { name: "Figma", level: "working" },
    { name: "User research", level: "working" },
    { name: "Node.js", level: "basic" },
  ],
  sampleNarrative:
    "I am a frontend engineer with three years of experience building React and TypeScript products. I work closely with designers and product teams, care about accessibility and maintainable component systems, and have gradually developed stronger UX research and prototyping skills.",
} as const;
