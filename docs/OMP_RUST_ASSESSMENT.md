# OMP Rust 底层接入评估

固定上游：`can1357/oh-my-pi@160ed439ac0df594347e7d7018b813a7ffdb5e81`。

## 结论

不能把 OMP 的 `pi-natives` 整体塞进 daemon。它是面向 Bun/N-API 的聚合层，会把 OMP 自己的工具、shell、AST、voice 与大量 vendored 依赖一起带入，等同于重新引入被要求丢弃的 OMP runtime 边界。正确做法是只在 Rust daemon 的明确接口后使用独立 crate。

优先级：

1. **`pi-walker` — 第一候选。** ignore-aware 并行 walker 与共享 scan cache 可替换 Paseo 当前 TypeScript 文件观察/目录建议中的高频扫描部分。输出只应是路径/元数据事件，不把 OMP session 或 plugin 类型带过 FFI。
2. **`pi-iso` — 第二候选。** 可作为 worktree/task workspace 的可选隔离后端，但 Paseo 已有完整 Git worktree 语义；先做能力和性能对照，再决定是补充 reflink/overlay 还是替换现有实现。
3. **`pi-shell` — 暂缓。** 它依赖 `pi-builtins` 和 vendored brush shell，适合通用终端/脚本执行；Codex agent 的命令执行必须继续由 Codex core 负责，否则会绕开 sandbox、approval 和 app-server tool lifecycle。只有 Paseo 的用户终端与项目脚本可考虑使用它。

明确不接入：

- `packages/agent`、`packages/ai`、provider catalog 与 prompts；Codex harness 已负责 agent loop。
- OMP extension/plugin loader；Paseo 的 plugin loader 也在 Codex-only 配置中关闭并计划删除。
- `pi-voice`；Paseo 已有独立语音功能，且当前开发配置关闭自动模型下载。
- `pi-ast` 作为 Codex 工具；Codex core 自己决定读取、搜索和上下文策略。以后只可用于客户端本地预览/导航。

## 集成约束

OMP crates 使用其根 workspace 的依赖和 lint 配置，不能直接复制单个目录后期待独立构建。首轮实现应在本仓库建立窄 adapter crate，通过 pinned submodule path dependency 引入，并保持 feature-gated；若上游 crate 无法脱离 OMP workspace 发布，则保留 submodule 构建或做带许可证/NOTICE 的最小 vendoring。

每个候选必须满足：

- 有相对 Paseo 当前实现的基准或新增能力证据；
- 不改变 Codex app-server 的事实源地位；
- 不绕过审批、sandbox、thread persistence 或 tool events；
- 提供可关闭的 Cargo feature 和纯 Paseo fallback；
- 发布包包含 MIT attribution 与相关 component NOTICE。

## 2026-08-24 构建审计结果

| crate | Rust 1.88 path dependency | 结论 |
| --- | --- | --- |
| `pi-walker` | 编译与 ignore/pruning 契约测试通过 | 已建立首个默认关闭的 adapter |
| `pi-iso` | 编译通过 | 只进入 benchmark/probe，不宣称是 Codex sandbox |
| `pi-shell` | stable 失败；OMP nightly + 宿主复制 `brush-core` patch 才通过 | 不进入稳定主线 |

`pi-shell` 的直接阻塞是 `pi-builtins -> xutf 1.4` 使用
`#![feature(portable_simd)]`；同时它没有 feature 可裁掉内置工具，并依赖 OMP
workspace 的 vendored `brush-core` patch。即使能在 nightly 编译，也只能服务 Paseo
普通用户终端，不能替换 Codex 自己的 sandboxed command lifecycle。

已新增 `crates/omp-primitives`：

- `omp-walker` Cargo feature 默认关闭；关闭时返回明确的 backend-disabled 信号，由 Paseo 现有文件观察路径继续工作。
- 启用时在 `spawn_blocking` 中调用 pinned `pi-walker`，只输出相对路径、大小与扫描统计。
- `.gitignore`、`.git`、`node_modules`、hidden-file 边界已有契约测试。
- 暴露 watcher cache invalidation 窄接口，不暴露任何 OMP agent/provider/session/plugin 类型。
- `THIRD_PARTY_NOTICES.md` 已保留 `pi-walker` MIT attribution；根 `Cargo.lock` 锁定外部依赖解析。

OMP submodule 必须列入外层 Cargo workspace 的 `exclude`，否则 Cargo 会把嵌套 crate
错误归入本项目 workspace，导致其 `version.workspace` 与 `dependencies.workspace`
无法从 OMP 自己的根清单继承。
