export type ConnectedAiProvider = "openai" | "groq"

export type HomeReadinessSnapshot = {
  connectedProvider: ConnectedAiProvider | null
  confirmedProfileCount: number
  cvDocumentCount: number
}

export type HomeReadinessAction =
  | {
      id: "connect-provider"
      href: "/settings"
      label: "Connect an AI provider"
      description: string
    }
  | {
      id: "add-profile"
      href: "/profile"
      label: "Add career evidence"
      description: string
    }
  | {
      id: "upload-cv"
      href: "/cvs"
      label: "Upload a CV"
      description: string
    }
  | {
      id: "analyse-job"
      href: "/jobs/new"
      label: "Analyse a job"
      description: string
    }

/**
 * Chooses one next best action for an authenticated user who has passed the
 * onboarding route gate. Earlier prerequisites intentionally take precedence
 * even when later-stage data already exists.
 */
export function decideHomeReadiness(
  snapshot: HomeReadinessSnapshot,
): HomeReadinessAction {
  if (!snapshot.connectedProvider) {
    return {
      id: "connect-provider",
      href: "/settings",
      label: "Connect an AI provider",
      description:
        "Connect OpenAI or Groq before using Waypoint's AI-assisted workflows.",
    }
  }

  if (snapshot.confirmedProfileCount <= 0) {
    return {
      id: "add-profile",
      href: "/profile",
      label: "Add career evidence",
      description:
        "Build your Master Profile so recommendations can use evidence you have reviewed.",
    }
  }

  if (snapshot.cvDocumentCount <= 0) {
    return {
      id: "upload-cv",
      href: "/cvs",
      label: "Upload a CV",
      description:
        "Add a role-specific CV so Waypoint can compare and improve your application materials.",
    }
  }

  return {
    id: "analyse-job",
    href: "/jobs/new",
    label: "Analyse a job",
    description:
      "Paste a job description to compare the role with your confirmed career evidence.",
  }
}
