import type { MutableDaemonConfigPatch } from "@getpaseo/protocol/messages";

export const CUSTOM_PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export type CustomProviderKind = "openai" | "anthropic" | "acp";

export interface CustomProviderDraft {
  id: string;
  label: string;
  description: string;
  kind: CustomProviderKind;
  baseUrl: string;
  apiKey: string;
  command: string;
  args: string;
  modelIds: string;
}

export type CustomProviderField = "id" | "label" | "baseUrl" | "command" | "modelIds";

export type CustomProviderValidationCode = "required" | "invalidId" | "duplicateId" | "invalidUrl";

export type CustomProviderValidationErrors = Partial<
  Record<CustomProviderField, CustomProviderValidationCode>
>;

type MutableProviderConfig = NonNullable<MutableDaemonConfigPatch["providers"]>[string];

export const EMPTY_CUSTOM_PROVIDER_DRAFT: CustomProviderDraft = {
  id: "",
  label: "",
  description: "",
  kind: "openai",
  baseUrl: "",
  apiKey: "",
  command: "",
  args: "",
  modelIds: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function kindFromExtends(value: unknown): CustomProviderKind | null {
  if (value === "codex") return "openai";
  if (value === "claude") return "anthropic";
  if (value === "acp") return "acp";
  return null;
}

function extendsFromKind(kind: CustomProviderKind): "codex" | "claude" | "acp" {
  if (kind === "openai") return "codex";
  if (kind === "anthropic") return "claude";
  return "acp";
}

function baseUrlFromConfig(kind: CustomProviderKind, env: Record<string, unknown>): string {
  if (kind === "openai") return readString(env.OPENAI_BASE_URL);
  if (kind === "anthropic") return readString(env.ANTHROPIC_BASE_URL);
  return "";
}

function isValidEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function parseModelIds(value: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of value.split(/[\n,]/)) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function parseCommandArgs(value: string): string[] {
  return value
    .trim()
    .split(/\s+/)
    .map((arg) => arg.trim())
    .filter(Boolean);
}

export function validateCustomProviderDraft(
  draft: CustomProviderDraft,
  existingProviderIds: ReadonlySet<string>,
  originalId?: string,
): CustomProviderValidationErrors {
  const errors: CustomProviderValidationErrors = {};
  const id = draft.id.trim();

  if (!id) errors.id = "required";
  else if (!CUSTOM_PROVIDER_ID_PATTERN.test(id)) errors.id = "invalidId";
  else if (id !== originalId && existingProviderIds.has(id)) errors.id = "duplicateId";

  if (!draft.label.trim()) errors.label = "required";

  if (draft.kind === "acp") {
    if (!draft.command.trim()) errors.command = "required";
  } else {
    const baseUrl = draft.baseUrl.trim();
    if (!baseUrl) errors.baseUrl = "required";
    else if (!isValidEndpoint(baseUrl)) errors.baseUrl = "invalidUrl";
    if (parseModelIds(draft.modelIds).length === 0) errors.modelIds = "required";
  }

  return errors;
}

export function buildCustomProviderConfig(
  draft: CustomProviderDraft,
  existingConfig?: MutableProviderConfig,
): MutableProviderConfig {
  const previous = readRecord(existingConfig);
  const models = parseModelIds(draft.modelIds).map((id, index) =>
    index === 0 ? { id, label: id, isDefault: true } : { id, label: id },
  );
  const common = {
    ...previous,
    extends: extendsFromKind(draft.kind),
    enabled: typeof previous.enabled === "boolean" ? previous.enabled : true,
    label: draft.label.trim(),
    description: draft.description.trim(),
    models,
  };

  if (draft.kind === "acp") {
    return {
      ...common,
      command: [draft.command.trim(), ...parseCommandArgs(draft.args)],
    };
  }

  const previousEnv = readRecord(previous.env);
  const baseUrlKey = draft.kind === "openai" ? "OPENAI_BASE_URL" : "ANTHROPIC_BASE_URL";
  const apiKeyKey = draft.kind === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_AUTH_TOKEN";
  const apiKey = draft.apiKey.trim();

  return {
    ...common,
    env: {
      ...previousEnv,
      [baseUrlKey]: draft.baseUrl.trim(),
      ...(apiKey ? { [apiKeyKey]: apiKey } : {}),
    },
  };
}

export function draftFromCustomProviderConfig(
  id: string,
  config: MutableProviderConfig,
): CustomProviderDraft | null {
  const record = readRecord(config);
  const kind = kindFromExtends(record.extends);
  if (!kind) return null;

  const env = readRecord(record.env);
  const command = Array.isArray(record.command)
    ? record.command.filter((value): value is string => typeof value === "string")
    : [];
  const models = Array.isArray(record.models)
    ? record.models.map((model) => readString(readRecord(model).id).trim()).filter(Boolean)
    : [];

  return {
    id,
    label: readString(record.label) || id,
    description: readString(record.description),
    kind,
    baseUrl: baseUrlFromConfig(kind, env),
    // Existing credentials are intentionally never copied into editable state.
    apiKey: "",
    command: kind === "acp" ? (command[0] ?? "") : "",
    args: kind === "acp" ? command.slice(1).join(" ") : "",
    modelIds: models.join("\n"),
  };
}

export function isSupportedCustomProviderConfig(config: unknown): boolean {
  return kindFromExtends(readRecord(config).extends) !== null;
}
