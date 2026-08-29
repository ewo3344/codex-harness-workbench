import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourcePath = process.argv[2];
const expected = process.argv[3];
if (!sourcePath || !["stale", "clean"].includes(expected)) {
  throw new Error("usage: reentrant-config-check.mjs SOURCE_PATH stale|clean");
}

const sourceUrl = pathToFileURL(path.resolve(sourcePath)).href;
const { DaemonConfigStore } = await import(sourceUrl);
const { loadPersistedConfig } = await import(
  pathToFileURL(path.resolve(path.dirname(sourcePath), "persisted-config.ts")).href,
);

const paseoHome = mkdtempSync(path.join(tmpdir(), "paseo-reentrant-config-check-"));
try {
  const configPath = path.join(paseoHome, "config.json");
  const startupPersisted = {
    version: 1,
    daemon: { autoArchiveAfterMerge: false },
  };
  writeFileSync(configPath, `${JSON.stringify(startupPersisted, null, 2)}\n`);
  const persistedToMutable = (persisted) => ({
    relay: { enabled: true },
    mcp: { enabled: true, injectIntoAgents: false },
    browserTools: { enabled: false },
    providers: {},
    metadataGeneration: { providers: [] },
    autoArchiveAfterMerge: persisted.daemon?.autoArchiveAfterMerge ?? false,
    enableTerminalAgentHooks: false,
    appendSystemPrompt: persisted.daemon?.appendSystemPrompt ?? "",
    cors: { allowedOrigins: [] },
    trustedProxies: ["loopback"],
    git: { maxProcessesPerSecond: 64, maxProcessConcurrency: 8 },
    app: { baseUrl: "https://app.paseo.sh" },
    pluginsEnabled: false,
    plugins: {},
  });
  const initialPersisted = loadPersistedConfig(paseoHome);
  const store = new DaemonConfigStore(
    paseoHome,
    persistedToMutable(initialPersisted),
    undefined,
    {
      startupPersisted: initialPersisted,
      reloadSource: {
        resolve: (persisted) => ({
          mutable: persistedToMutable(persisted),
          overrideControlledPaths: ["daemon.autoArchiveAfterMerge"],
        }),
      },
    },
  );

  let nestedPatchApplied = false;
  store.onChange((config) => {
    if (nestedPatchApplied || config.appendSystemPrompt !== "outer") return;
    nestedPatchApplied = true;
    store.patch({ autoArchiveAfterMerge: true });
  });
  store.patch({ appendSystemPrompt: "outer" });

  const persisted = loadPersistedConfig(paseoHome);
  assert.equal(store.get().appendSystemPrompt, "outer");
  assert.equal(store.get().autoArchiveAfterMerge, true);
  assert.equal(persisted.daemon?.appendSystemPrompt, "outer");
  assert.equal(persisted.daemon?.autoArchiveAfterMerge, true);

  const reloadResult = store.reload();
  if (expected === "stale") {
    assert.deepEqual(reloadResult.overrideControlledPaths, ["daemon.autoArchiveAfterMerge"]);
  } else {
    assert.deepEqual(reloadResult, {
      appliedPaths: [],
      restartRequiredPaths: [],
      overrideControlledPaths: [],
    });
  }
  console.log(
    `REENTRANT_CHECK nested=${nestedPatchApplied} append=${store.get().appendSystemPrompt} autoArchive=${store.get().autoArchiveAfterMerge} override=${reloadResult.overrideControlledPaths.join(",") || "none"} result=PASS`,
  );
} finally {
  rmSync(paseoHome, { recursive: true, force: true });
}
