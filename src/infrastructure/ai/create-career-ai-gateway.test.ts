import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  configuredAiProvider,
  configuredGroqModels,
  createCareerAiGateway,
} from "./create-career-ai-gateway";
import { GroqCareerAiGateway } from "./groq-career-ai-gateway";
import { OpenAiCareerAiGateway } from "./openai-career-ai-gateway";

describe("career AI provider selection", () => {
  it("keeps OpenAI as the compatibility default", () => {
    expect(configuredAiProvider({ NODE_ENV: "test" })).toBe("openai");
    expect(
      createCareerAiGateway({
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "test-model",
        NODE_ENV: "test",
      }),
    ).toBeInstanceOf(OpenAiCareerAiGateway);
  });

  it("selects Groq without requiring OpenAI configuration", () => {
    expect(
      createCareerAiGateway({
        AI_PROVIDER: "groq",
        GROQ_API_KEY: "test-key",
        GROQ_MODEL: "openai/gpt-oss-20b",
        NODE_ENV: "test",
      }),
    ).toBeInstanceOf(GroqCareerAiGateway);
  });

  it("uses GROQ_MODEL as the shared default with task overrides", () => {
    expect(
      configuredGroqModels({
        GROQ_MODEL: "openai/gpt-oss-120b",
        GROQ_JOB_MATCHING_MODEL: "openai/gpt-oss-20b",
        NODE_ENV: "test",
      }),
    ).toEqual({
      "cv-fact-extraction": "openai/gpt-oss-120b",
      "job-description-parsing": "openai/gpt-oss-120b",
      "job-requirement-matching": "openai/gpt-oss-20b",
    });
  });

  it("accepts an explicit per-user credential without changing env behavior", () => {
    expect(
      createCareerAiGateway(
        { OPENAI_MODEL: "test-model", NODE_ENV: "test" },
        {
          userId: "11111111-1111-4111-8111-111111111111",
          provider: "openai",
          apiKey: "user-key",
        },
      ),
    ).toBeInstanceOf(OpenAiCareerAiGateway);

    expect(
      createCareerAiGateway(
        { GROQ_MODEL: "openai/gpt-oss-20b", NODE_ENV: "test" },
        {
          userId: "11111111-1111-4111-8111-111111111111",
          provider: "groq",
          apiKey: "user-key",
        },
      ),
    ).toBeInstanceOf(GroqCareerAiGateway);
  });
});
