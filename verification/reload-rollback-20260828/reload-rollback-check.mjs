import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourcePath = process.argv[2];
const expectedPersisted = process.argv[3];

if (!sourcePath || !["restored", "left-new"].includes(expectedPersisted)) {
  throw new Error("usage: reload-rollback-check.mjs SOURCE_PATH restored|left-new");
}

const { DaemonConfigStore } = await import(pathToFileURL(path.resolve(sourcePath)).href);
const { loadPersistedConfig } = await import(
  pathToFileURL(path.resolve(path.dirname(sourcePath), "persisted-config.ts")).href,
);

const paseoHome = mkdtempSync(path.join(tmpdir(), "paseo-reload-rollback-check-"));
try {
  const configPath = path.join(paseoHome, "config.json");
  const startupPersisted = {
    version: 1,
    daemon: { browserTools: { enabled: false } },
  };
  writeFileSync(configPath, `${JSON.stringify(startupPersisted, null, 2)}\n`);

  const toMutable = (persisted) => ({
    relay: { enabled: true },
    mcp: { enabled: true, injectIntoAgents: false },
    browserTools: { enabled: persisted.daemon?.browserTools?.enabled ?? false },
    providers: {},
    metadataGeneration: { providers: [] },
    autoArchiveAfterMerge: false,
    enableTerminalAgentHooks: false,
    appendSystemPrompt: "",
    cors: { allowedOrigins: [] },
    trustedProxies: ["loopback"],
    git: { maxProcessesPerSecond: 64, maxProcessConcurrency: 8 },
    app: { baseUrl: "https://app.paseo.sh" },
    pluginsEnabled: false,
    plugins: {},
  });

  const initial = toMutable(startupPersisted);
  const store = new DaemonConfigStore(paseoHome, initial, undefined, {
    reloadSource: {
      resolve: (persisted) => ({ mutable: toMutable(persisted), overrideControlledPaths: [] }),
    },
  });

  let liveBrowserToolsEnabled = false;
  store.onApply((next, previous) => {
    liveBrowserToolsEnabled = next.browserTools.enabled;
    return () => {
      liveBrowserToolsEnabled = previous.browserTools.enabled;
    };
  });
  store.onApply(() => {
    throw new Error("Provider refresh failed during reload");
  });

  writeFileSync(
    configPath,
    `${JSON.stringify({ version: 1, daemon: { browserTools: { enabled: true } } }, null, 2)}\n`,
  );
  assert.throws(() => store.reload(), /Provider refresh failed during reload/);

  const memoryEnabled = store.get().browserTools.enabled;
  const persistedEnabled = loadPersistedConfig(paseoHome).daemon?.browserTools?.enabled;
  assert.equal(liveBrowserToolsEnabled, false);
  assert.equal(memoryEnabled, false);
  assert.equal(persistedEnabled, expectedPersisted === "restored" ? false : true);
  console.log(
    `ROLLBACK_CHECK live=${liveBrowserToolsEnabled} memory=${memoryEnabled} persisted=${persistedEnabled} result=PASS`,
  );
} finally {
  rmSync(paseoHome, { recursive: true, force: true });
}
