import { describe, expect, it } from "vitest";
import {
  buildCustomProviderConfig,
  draftFromCustomProviderConfig,
  EMPTY_CUSTOM_PROVIDER_DRAFT,
  parseModelIds,
  validateCustomProviderDraft,
  type CustomProviderDraft,
} from "./custom-provider-form";

function draft(overrides: Partial<CustomProviderDraft> = {}): CustomProviderDraft {
  return {
    ...EMPTY_CUSTOM_PROVIDER_DRAFT,
    id: "my-provider",
    label: "My provider",
    baseUrl: "https://api.example.test/v1",
    modelIds: "model-a",
    ...overrides,
  };
}

describe("custom provider form", () => {
  it("normalizes unique model IDs from lines and commas", () => {
    expect(parseModelIds(" model-a,model-b\nmodel-a\n model-c ")).toEqual([
      "model-a",
      "model-b",
      "model-c",
    ]);
  });

  it("validates IDs, duplicates, endpoint URLs, and required API models", () => {
    expect(
      validateCustomProviderDraft(
        draft({ id: "Bad ID", label: "", baseUrl: "file:///tmp/api", modelIds: "" }),
        new Set(),
      ),
    ).toEqual({
      id: "invalidId",
      label: "required",
      baseUrl: "invalidUrl",
      modelIds: "required",
    });

    expect(validateCustomProviderDraft(draft(), new Set(["my-provider"]))).toEqual({
      id: "duplicateId",
    });
    expect(validateCustomProviderDraft(draft(), new Set(["my-provider"]), "my-provider")).toEqual(
      {},
    );
  });

  it("builds an explicitly enabled OpenAI-compatible config", () => {
    expect(
      buildCustomProviderConfig(
        draft({
          description: "Private endpoint",
          apiKey: "secret-key",
          modelIds: "model-a, model-b",
        }),
      ),
    ).toEqual({
      extends: "codex",
      enabled: true,
      label: "My provider",
      description: "Private endpoint",
      env: {
        OPENAI_API_KEY: "secret-key",
        OPENAI_BASE_URL: "https://api.example.test/v1",
      },
      models: [
        { id: "model-a", label: "model-a", isDefault: true },
        { id: "model-b", label: "model-b" },
      ],
    });
  });

  it("preserves an existing API key when an edit leaves the credential blank", () => {
    expect(
      buildCustomProviderConfig(draft({ kind: "anthropic", apiKey: "" }), {
        extends: "claude",
        enabled: false,
        label: "Old label",
        env: {
          ANTHROPIC_AUTH_TOKEN: "stored-secret",
          API_TIMEOUT_MS: "3000000",
        },
      }),
    ).toMatchObject({
      extends: "claude",
      enabled: false,
      label: "My provider",
      env: {
        ANTHROPIC_AUTH_TOKEN: "stored-secret",
        ANTHROPIC_BASE_URL: "https://api.example.test/v1",
        API_TIMEOUT_MS: "3000000",
      },
    });
  });

  it("builds ACP command argv and allows catalog discovery without configured models", () => {
    const acpDraft = draft({
      kind: "acp",
      baseUrl: "",
      command: "ollama-acp",
      args: "--stdio --verbose",
      modelIds: "",
    });
    expect(validateCustomProviderDraft(acpDraft, new Set())).toEqual({});
    expect(buildCustomProviderConfig(acpDraft)).toMatchObject({
      extends: "acp",
      enabled: true,
      command: ["ollama-acp", "--stdio", "--verbose"],
      models: [],
    });
  });

  it("hydrates editable fields without copying a stored credential", () => {
    expect(
      draftFromCustomProviderConfig("zai", {
        extends: "claude",
        label: "ZAI",
        description: "Anthropic proxy",
        env: {
          ANTHROPIC_AUTH_TOKEN: "must-not-enter-ui-state",
          ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
        },
        models: [{ id: "glm-5", label: "GLM 5" }],
      }),
    ).toEqual({
      id: "zai",
      label: "ZAI",
      description: "Anthropic proxy",
      kind: "anthropic",
      baseUrl: "https://api.z.ai/api/anthropic",
      apiKey: "",
      command: "",
      args: "",
      modelIds: "glm-5",
    });
  });

});
