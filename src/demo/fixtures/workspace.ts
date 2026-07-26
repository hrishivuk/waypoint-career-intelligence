import { demoCandidate } from "./candidate";

export const demoWorkspace = {
  candidate: demoCandidate,
  knowledge: {
    skills: demoCandidate.skills,
    competencies: [
      "Cross-functional collaboration",
      "Product thinking",
      "Problem framing",
      "Clear technical communication",
    ],
    experience: [
      {
        title: "Frontend Engineer · Northstar Health",
        detail:
          "Built accessible React interfaces, reusable components and API-driven product workflows in a cross-functional team.",
      },
      {
        title: "Junior Frontend Developer · Atlas Commerce",
        detail:
          "Delivered responsive customer journeys and worked with design to improve usability across web and mobile.",
      },
    ],
    projects: [
      {
        title: "Matchday",
        detail:
          "A sports community product designed and implemented from user flows through a React prototype.",
      },
      {
        title: "AccessKit",
        detail:
          "An accessibility review dashboard using TypeScript, component testing and structured issue tracking.",
      },
    ],
    preferences: [
      "Product-focused frontend or UX engineering roles",
      "Hybrid or remote-first teams in Europe",
      "Strong learning, ownership and design collaboration",
    ],
  },
  cvs: [
    {
      id: "demo-cv-frontend",
      name: "Frontend Engineer CV",
      intendedRoles: ["Frontend Engineer", "UI Engineer"],
      sections: 5,
      visibleSkills: 12,
      coverage: 91,
      summary:
        "Prioritises React, TypeScript, accessibility, component architecture and production delivery.",
    },
    {
      id: "demo-cv-ux",
      name: "UX Engineer CV",
      intendedRoles: ["UX Engineer", "Product Designer"],
      sections: 6,
      visibleSkills: 10,
      coverage: 74,
      summary:
        "Prioritises user research, prototyping, accessible interaction design and frontend implementation.",
    },
  ],
  job: {
    company: "Orbit Labs",
    title: "Frontend Product Engineer",
    recommendation: "Apply",
    overallScore: 88,
    requirementsScore: 91,
    directionScore: 90,
    preferenceScore: 82,
    summary:
      "This role strongly matches Jordan’s confirmed frontend experience and product-focused direction. The main unknown is direct ownership of an internationalisation system.",
    strengths: [
      "Professional React and TypeScript delivery",
      "Accessible, responsive interface development",
      "Cross-functional work with design and product",
      "Reusable component and design-system experience",
    ],
    unknowns: [
      "Direct production ownership of internationalisation",
      "Experience with the company’s specific analytics tooling",
    ],
    bestCv: {
      name: "Frontend Engineer CV",
      score: 91,
      represented: 8,
      relevant: 9,
      changes: [
        "Move the accessibility achievement into the opening experience bullets.",
        "Mention product and design collaboration in the professional summary.",
        "Add the confirmed component-system evidence currently absent from this CV.",
      ],
    },
  },
  applicationAnswers: [
    {
      label: "Portfolio website",
      value: "https://jordanlee.example/portfolio",
    },
    {
      label: "LinkedIn",
      value: "https://linkedin.com/in/jordan-lee-example",
    },
    {
      label: "Tell us about yourself",
      value:
        "I am a frontend engineer with a strong interest in UX and product thinking. I enjoy understanding real user problems and turning them into accessible, maintainable interfaces while working closely with design and product teams.",
    },
    {
      label: "Why should we hire you?",
      value:
        "I bring a practical combination of frontend engineering, user-centred thinking and collaborative delivery. I can take ownership of interface work, communicate trade-offs clearly and keep both product quality and maintainability in view.",
    },
  ],
} as const;

export type DemoWorkspace = typeof demoWorkspace;

