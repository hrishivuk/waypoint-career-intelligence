import { describe, expect, it } from "vitest"

import { decideHomeReadiness } from "./readiness"

describe("decideHomeReadiness", () => {
  it("asks the user to connect a provider before later readiness work", () => {
    expect(
      decideHomeReadiness({
        connectedProvider: null,
        confirmedProfileCount: 8,
        cvDocumentCount: 3,
      }),
    ).toMatchObject({
      id: "connect-provider",
      href: "/settings",
      label: "Connect an AI provider",
    })
  })

  it.each(["openai", "groq"] as const)(
    "asks for profile evidence after connecting %s",
    (connectedProvider) => {
      expect(
        decideHomeReadiness({
          connectedProvider,
          confirmedProfileCount: 0,
          cvDocumentCount: 2,
        }),
      ).toMatchObject({ id: "add-profile", href: "/profile" })
    },
  )

  it("asks for a CV after provider and profile prerequisites are ready", () => {
    expect(
      decideHomeReadiness({
        connectedProvider: "openai",
        confirmedProfileCount: 1,
        cvDocumentCount: 0,
      }),
    ).toMatchObject({ id: "upload-cv", href: "/cvs" })
  })

  it("recommends job analysis once all prerequisites are ready", () => {
    expect(
      decideHomeReadiness({
        connectedProvider: "groq",
        confirmedProfileCount: 12,
        cvDocumentCount: 2,
      }),
    ).toMatchObject({ id: "analyse-job", href: "/jobs/new" })
  })

  it("treats non-positive counts as not ready", () => {
    expect(
      decideHomeReadiness({
        connectedProvider: "openai",
        confirmedProfileCount: -1,
        cvDocumentCount: 4,
      }).id,
    ).toBe("add-profile")

    expect(
      decideHomeReadiness({
        connectedProvider: "openai",
        confirmedProfileCount: 4,
        cvDocumentCount: -1,
      }).id,
    ).toBe("upload-cv")
  })
})
