/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderSnapshotEntry } from "@getpaseo/protocol/agent-types";

const { theme, snapshotState, openProviderSettingsMock } = vi.hoisted(() => ({
  theme: {
    spacing: { 1: 4, "1.5": 6, 2: 8, 3: 12, 4: 16, 6: 24 },
    iconSize: { sm: 14, md: 20 },
      fontSize: { xs: 11, sm: 13, base: 15 },
      fontWeight: { normal: "400" },
      borderRadius: { lg: 8 },
      opacity: { 50: 0.5 },
      colors: {
        surface1: "#111",
        surface2: "#222",
        surface3: "#333",
        foreground: "#fff",
        foregroundMuted: "#aaa",
        border: "#555",
        accent: "#0a84ff",
        statusSuccess: "#00ff00",
        statusWarning: "#ff9500",
        statusDanger: "#ff0000",
        palette: { red: { 300: "#ff6b6b" }, white: "#fff" },
      },
    },
    snapshotState: {
      entries: undefined as ProviderSnapshotEntry[] | undefined,
    isLoading: false,
    isRefreshing: false,
  },
  openProviderSettingsMock: vi.fn(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
    React.createElement("div", { "data-testid": testID }, children),
  Text: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("span", null, children),
  Pressable: ({
    children,
    onPress,
    onHoverIn,
    onHoverOut,
    accessibilityRole,
    accessibilityLabel,
    disabled,
    testID,
  }: {
    children?:
      | React.ReactNode
      | ((state: { pressed: boolean; hovered: boolean }) => React.ReactNode);
    onPress?: (event: React.MouseEvent) => void;
    onHoverIn?: () => void;
    onHoverOut?: () => void;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    disabled?: boolean;
    testID?: string;
  }) =>
    React.createElement(
      "div",
      {
        role: accessibilityRole,
        "aria-label": accessibilityLabel,
        "aria-disabled": disabled ? "true" : undefined,
        "data-testid": testID,
        onClick: disabled ? undefined : onPress,
        onMouseEnter: onHoverIn,
        onMouseLeave: onHoverOut,
      },
      typeof children === "function" ? children({ pressed: false, hovered: false }) : children,
    ),
  ActivityIndicator: () => React.createElement("span", { "data-testid": "activity-indicator" }),
}));

vi.mock("react-native-unistyles", () => ({
  StyleSheet: {
    create: (factory: unknown) =>
      typeof factory === "function" ? (factory as (t: typeof theme) => unknown)(theme) : factory,
  },
  useUnistyles: () => ({ theme, rt: { breakpoint: "md" } }),
}));

vi.mock("lucide-react-native", () => {
  const icon = (name: string) => () => React.createElement("span", { "data-icon": name });
  return {
    ChevronRight: icon("ChevronRight"),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      (
        ({
          "settings.providers.providerDetails": "{{name}} provider details",
          "settings.providers.statuses.disabled": "Disabled",
          "settings.providers.statuses.available": "Available",
          "settings.providers.statuses.loading": "Loading",
          "settings.providers.statuses.error": "Error",
          "settings.providers.statuses.notInstalled": "Not installed",
          "settings.providers.models.one": "1 model",
          "settings.providers.models.many": "{{count}} models",
        })[key] ?? key
      )
        .replaceAll("{{name}}", String(values?.name ?? ""))
        .replaceAll("{{count}}", String(values?.count ?? "")),
  }),
}));

vi.mock("@/components/ui/loading-spinner", () => ({
  LoadingSpinner: () => React.createElement("span", { "data-testid": "loading-spinner" }),
}));

vi.mock("@/components/provider-icons", () => ({
  getProviderIcon: (provider: string) => () =>
    React.createElement("span", { "data-icon": `provider-${provider}` }),
}));

vi.mock("@/stores/provider-settings-store", () => ({
  useProviderSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({ open: openProviderSettingsMock }),
}));

vi.mock("@/hooks/use-providers-snapshot", () => ({
  useProvidersSnapshot: () => ({
    entries: snapshotState.entries,
    isLoading: snapshotState.isLoading,
    isFetching: false,
    isRefreshing: snapshotState.isRefreshing,
    error: null,
    supportsSnapshot: true,
    refresh: vi.fn(async () => {}),
    refetchIfStale: vi.fn(),
  }),
}));

vi.mock("@/runtime/host-runtime", () => ({
  useHostRuntimeIsConnected: () => true,
}));

import { ProvidersSection } from "./providers-section";

const claudeEntry: ProviderSnapshotEntry = {
  provider: "claude",
  status: "ready",
  enabled: true,
  source: "builtin",
  label: "Claude",
  description: "Claude Code",
  defaultModeId: null,
  modes: [],
  models: [
    { provider: "claude", id: "claude-opus-4-7", label: "Claude Opus 4.7" },
    { provider: "claude", id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { provider: "claude", id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ],
};

const customProviderEntry: ProviderSnapshotEntry = {
  provider: "zai-claude",
  status: "ready",
  enabled: true,
  source: "custom",
  label: "ZAI Claude",
  description: "Custom Anthropic-compatible provider",
  defaultModeId: null,
  modes: [],
  models: [
    { provider: "zai-claude", id: "glm-4.7", label: "GLM-4.7" },
  ],
};

const disabledCodexEntry: ProviderSnapshotEntry = {
  provider: "codex",
  status: "unavailable",
  enabled: false,
  label: "Codex",
  description: "OpenAI Codex",
  defaultModeId: null,
  modes: [],
};

const codexEntry: ProviderSnapshotEntry = {
  provider: "codex",
  status: "ready",
  enabled: true,
  label: "Codex",
  description: "OpenAI Codex",
  defaultModeId: null,
  modes: [],
  models: [
    { provider: "codex", id: "gpt-5.4", label: "GPT-5.4" },
    { provider: "codex", id: "gpt-5.3-codex", label: "GPT-5.3-Codex" },
    { provider: "codex", id: "gpt-5.2-codex", label: "GPT-5.2-Codex" },
  ],
};

function descendants(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>("*"));
}

function indexOfMatches(nodes: HTMLElement[], selector: string): number {
  return nodes.findIndex((node) => node.matches(selector));
}

function indexOfText(nodes: HTMLElement[], text: string): number {
  return nodes.findIndex((node) => node.textContent?.trim() === text);
}

describe("ProvidersSection", () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;

  beforeEach(() => {
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    snapshotState.entries = undefined;
    snapshotState.isLoading = false;
    snapshotState.isRefreshing = false;
    openProviderSettingsMock.mockReset();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container?.remove();
    container = null;
    vi.unstubAllGlobals();
  });

  function render(): void {
    act(() => {
      root?.render(<ProvidersSection serverId="server-1" />);
    });
  }

  function findRow(accessibilityLabel: string): HTMLElement {
    const row = container?.querySelector<HTMLElement>(
      `[role="button"][aria-label="${accessibilityLabel}"]`,
    );
    if (!row) throw new Error(`Expected row with aria-label "${accessibilityLabel}"`);
    return row;
  }

  it("renders Codex plus published custom providers, excluding built-ins", () => {
    snapshotState.entries = [claudeEntry, disabledCodexEntry, customProviderEntry];

    render();

    const rows = Array.from(
      container?.querySelectorAll<HTMLElement>('[role="button"][aria-label$="provider details"]') ??
        [],
    );
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Codex provider details",
      "ZAI Claude provider details",
    ]);

    const codexRow = findRow("Codex provider details");
    const codexNodes = descendants(codexRow);
    expect(indexOfText(codexNodes, "Codex")).toBeGreaterThanOrEqual(0);
    expect(indexOfText(codexNodes, "codex")).toBe(-1);
    expect(indexOfText(codexNodes, "Disabled")).toBeGreaterThanOrEqual(0);

    const customRow = findRow("ZAI Claude provider details");
    act(() => {
      customRow.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    expect(openProviderSettingsMock).toHaveBeenCalledWith({
      serverId: "server-1",
      provider: "zai-claude",
    });
  });

  it("composes the row as chevron, icon, label, status, then model count", () => {
    snapshotState.entries = [codexEntry];

    render();

    const row = findRow("Codex provider details");
    const nodes = descendants(row);
    const chevron = indexOfMatches(nodes, '[data-icon="ChevronRight"]');
    const icon = indexOfMatches(nodes, '[data-icon="provider-codex"]');
    const label = indexOfText(nodes, "Codex");
    const status = indexOfText(nodes, "Available");
    const modelCount = indexOfText(nodes, "3 models");

    expect(chevron).toBeGreaterThanOrEqual(0);
    expect(icon).toBeGreaterThan(chevron);
    expect(label).toBeGreaterThan(icon);
    expect(status).toBeGreaterThan(label);
    expect(modelCount).toBeGreaterThan(status);
  });

  it("opens the diagnostic sheet when the outer row is pressed for a disabled provider", () => {
    snapshotState.entries = [disabledCodexEntry];

    render();

    expect(openProviderSettingsMock).not.toHaveBeenCalled();

    const row = findRow("Codex provider details");
    act(() => {
      row.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });

    expect(openProviderSettingsMock).toHaveBeenCalledTimes(1);
    expect(openProviderSettingsMock).toHaveBeenCalledWith({
      serverId: "server-1",
      provider: "codex",
    });
  });

  it("does not render controls that can disable or remove Codex", () => {
    snapshotState.entries = [codexEntry];

    render();

    const row = findRow("Codex provider details");
    expect(row.querySelector('[role="switch"]')).toBeNull();
    expect(container?.querySelector('[data-testid="provider-actions-codex"]')).toBeNull();
    expect(container?.querySelector('[data-testid="provider-remove-codex"]')).toBeNull();
  });

  it("does not render the Add Provider catalog", () => {
    snapshotState.entries = [codexEntry];

    render();

    expect(container?.querySelector('[data-testid="host-page-add-provider-card"]')).toBeNull();
  });
});
