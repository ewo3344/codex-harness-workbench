#!/usr/bin/env node
/**
 * Guards present-tense product records after the Codex-only publication reversal.
 * Reads the shipped parent-repo docs; does not reimplement publication logic.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function assert(cond, message) {
  if (!cond) {
    console.error(message);
    process.exitCode = 1;
  }
}

const files = {
  readme: "README.md",
  status: "STATUS.md",
  index: "docs/INDEX.md",
  tasks: "docs/tasks.md",
  feature: "docs/FEATURE_MATRIX.md",
  custom: "docs/CUSTOM_API_PLAN.md",
  next: "docs/NEXT_GOALS.md",
  master: "docs/MASTER_PLAN.md",
};

const bodies = Object.fromEntries(
  Object.entries(files).map(([key, rel]) => [key, read(rel)]),
);

const presentTenseAllowlist = [
  /强制 Codex-only/,
  /已强制 Codex-only/,
  /仍只发布\/启用 Codex/,
  /仍只发布\/只启用 Codex/,
  /只发布且始终启用 `codex`/,
];

for (const [name, body] of Object.entries(bodies)) {
  if (name === "custom" || name === "next" || name === "master") continue;
  for (const pattern of presentTenseAllowlist) {
    assert(
      !pattern.test(body),
      `${files[name]} still has present-tense Codex-only product claim: ${pattern}`,
    );
  }
}

assert(
  bodies.custom.includes("档案") && /当时架构强制 Codex-only/.test(bodies.custom),
  "docs/CUSTOM_API_PLAN.md must be archived and use past tense for Codex-only",
);
assert(
  bodies.feature.includes("claude / copilot / opencode / pi / Codex") ||
    bodies.feature.includes("产品 builtin 可发行"),
  "docs/FEATURE_MATRIX.md must describe published builtins, not Codex-only stripping",
);
assert(
  !/^\s*- \[x\] \*\*T2 Codex-only/.test(bodies.tasks),
  "docs/tasks.md T2 must not still be titled Codex-only publication",
);
assert(
  bodies.tasks.includes("## 未着手（現在の残り作業）"),
  "docs/tasks.md must label T8–T11 as current remaining work",
);
assert(
  /T8 relay/.test(bodies.tasks) &&
    /T9 Desktop/.test(bodies.tasks) &&
    /T10 設定面/.test(bodies.tasks) &&
    /T11 実モデル/.test(bodies.tasks),
  "docs/tasks.md remaining work must include T8–T11",
);
assert(
  !bodies.tasks.includes("G0") && !/\bK1\b/.test(bodies.tasks.split("## 未着手")[1] ?? ""),
  "docs/tasks.md remaining-work section must not list G0–G2 or K1 as next",
);

assert(
  bodies.readme.includes("docs/tasks.md") &&
    bodies.readme.includes("scripts/start-harness-workbench.sh"),
  "README must name remaining-work record and run entry",
);
assert(
  !/完整实施计划（必读）/.test(bodies.readme),
  "README must not star MASTER_PLAN as 必读 current",
);
assert(
  bodies.index.includes("tasks.md") &&
    bodies.index.includes("start-harness-workbench.sh"),
  "docs/INDEX.md must name remaining work and run entry",
);
assert(
  /档案（不是当前必读）/.test(bodies.index) && /MASTER_PLAN/.test(bodies.index),
  "docs/INDEX.md must mark MASTER_PLAN as archive, not 必读 current",
);
assert(
  bodies.next.includes("档案") && bodies.next.includes("父仓库零提交"),
  "docs/NEXT_GOALS.md must label 零提交 as historical, not current",
);
assert(
  bodies.master.includes("档案") && bodies.master.includes("docs/tasks.md"),
  "docs/MASTER_PLAN.md must be archived and point at remaining work",
);

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("docs current-claims check: OK");
