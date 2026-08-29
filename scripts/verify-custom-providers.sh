#!/usr/bin/env bash
# 验证自定义 Provider 功能
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/chw-provider-verify.XXXXXX")"
trap 'rm -rf "$TEMP_DIR"' EXIT

cd "$PROJECT_ROOT"

echo "=== 自定义 Provider 功能验证 ==="
echo

# 1. 检查配置文件
echo "1. 检查配置示例..."
if [[ -f "config/custom-providers.example.json" ]]; then
    echo "   ✓ config/custom-providers.example.json 存在"
else
    echo "   ✗ 配置示例文件不存在"
    exit 1
fi

# 2. 检查文档
echo "2. 检查文档..."
if [[ -f "docs/CUSTOM_PROVIDERS.md" ]]; then
    echo "   ✓ docs/CUSTOM_PROVIDERS.md 存在"
else
    echo "   ✗ 文档文件不存在"
    exit 1
fi

if [[ -f "docs/CUSTOM_API_PLAN.md" ]]; then
    echo "   ✓ docs/CUSTOM_API_PLAN.md 存在"
else
    echo "   ✗ 计划文档不存在"
    exit 1
fi

# 3. 验证代码修改
echo "3. 验证代码修改..."
if grep -q "publishEnabledCustomProviders" upstream/paseo/packages/server/src/server/bootstrap.ts \
    && grep -q "requiredProviderIds" upstream/paseo/packages/server/src/server/bootstrap.ts; then
    echo "   ✓ bootstrap.ts 包含 required Codex 与 custom provider 发布逻辑"
else
    echo "   ✗ bootstrap.ts 缺少 provider 发布逻辑"
    exit 1
fi

# 4. 运行测试
echo "4. 运行测试..."
cd upstream/paseo

echo "   运行 bootstrap smoke 测试..."
TEST_OUTPUT=$(npx vitest run packages/server/src/server/bootstrap.smoke.test.ts --maxWorkers=1 2>&1)
if echo "$TEST_OUTPUT" | grep -q "Test Files.*passed"; then
    echo "   ✓ bootstrap smoke 测试通过"
else
    echo "   ✗ bootstrap smoke 测试失败"
    echo "$TEST_OUTPUT"
    exit 1
fi

echo "   运行 provider-snapshot-manager 测试..."
TEST_OUTPUT=$(npx vitest run packages/server/src/server/agent/provider-snapshot-manager.test.ts --maxWorkers=1 2>&1)
if echo "$TEST_OUTPUT" | grep -q "Test Files.*passed"; then
    echo "   ✓ provider-snapshot-manager 测试通过"
else
    echo "   ✗ provider-snapshot-manager 测试失败"
    echo "$TEST_OUTPUT"
    exit 1
fi

cd "$PROJECT_ROOT"

# 5. 解析配置示例到临时目录，不把运行态配置写入工作区
echo "5. 验证配置示例..."
TEST_CONFIG="$TEMP_DIR/custom-providers.example.json"
cp "$PROJECT_ROOT/config/custom-providers.example.json" "$TEST_CONFIG"
node --input-type=module - "$TEST_CONFIG" <<'NODE'
import { readFile } from "node:fs/promises";
const file = process.argv[2];
const config = JSON.parse(await readFile(file, "utf8"));
if (!config?.agents?.providers?.codex) throw new Error("Codex provider is missing");
const custom = Object.entries(config.agents.providers).filter(([id]) => id !== "codex");
if (custom.length === 0) throw new Error("No custom provider in example");
console.log(`   ✓ ${custom.length} custom provider examples parsed`);
NODE

echo
echo "=== 验证完成 ==="
echo
echo "所有检查通过！自定义 Provider 功能已正确实现。"
echo
echo "下一步："
echo "1. 启动 daemon: ./scripts/start-harness-workbench.sh"
echo "2. 列出 providers: cd upstream/paseo && node packages/cli/bin/paseo provider ls --host 127.0.0.1:6877"
echo "3. 查看文档: docs/CUSTOM_PROVIDERS.md"
echo "4. 查看配置示例: config/custom-providers.example.json"
