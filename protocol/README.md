# Codex app-server protocol snapshots

这些文件由已安装的 Codex 二进制生成，不手工编辑。目录名必须包含生成它的 Codex 版本。

```bash
version="$(codex --version | awk '{print $2}')"
codex app-server generate-json-schema --out "protocol/codex-app-server-${version}/json"
codex app-server generate-ts --out "protocol/codex-app-server-${version}/typescript"

codex app-server generate-json-schema --experimental \
  --out "protocol/codex-app-server-${version}/experimental/json"
codex app-server generate-ts --experimental \
  --out "protocol/codex-app-server-${version}/experimental/typescript"
```

稳定和实验 API 分目录保存。任何实验调用都必须在 initialize 时声明 `experimentalApi` capability，并用明确的 Codex 最低版本约束。
