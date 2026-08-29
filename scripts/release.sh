#!/usr/bin/env bash
# 版本发布自动化脚本
# 用法: ./scripts/release.sh <type> [version]
#   type: alpha | beta | rc | release | patch | minor | major

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# 检查前置条件
check_prerequisites() {
    log_info "检查前置条件..."

    # 检查 git
    if ! command -v git &> /dev/null; then
        log_error "Git 未安装"
        exit 1
    fi

    # 检查 npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi

    # 检查 cargo
    if ! command -v cargo &> /dev/null; then
        log_error "Cargo (Rust) 未安装"
        exit 1
    fi

    # 检查 gh CLI（可选）
    if ! command -v gh &> /dev/null; then
        log_warning "gh CLI 未安装，无法自动创建 GitHub Release"
    fi

    # 检查工作目录是否干净
    if [[ -n $(git status --porcelain) ]]; then
        log_error "工作目录有未提交的变更，请先提交或暂存"
        git status --short
        exit 1
    fi

    # 检查当前分支
    CURRENT_BRANCH=$(git branch --show-current)
    if [[ "$RELEASE_TYPE" == "release" ]] && [[ "$CURRENT_BRANCH" != "main" ]]; then
        log_error "正式版本必须从 main 分支发布，当前在 $CURRENT_BRANCH"
        exit 1
    fi

    log_success "前置条件检查通过"
}

# 获取当前版本
get_current_version() {
    # 从 package.json 读取
    if [[ -f "upstream/paseo/package.json" ]]; then
        CURRENT_VERSION=$(node -p "require('./upstream/paseo/package.json').version")
    else
        CURRENT_VERSION="0.5.0"
    fi
    echo "$CURRENT_VERSION"
}

# 计算新版本号
calculate_new_version() {
    local current=$1
    local type=$2
    local custom_version=$3

    # 如果指定了自定义版本，直接使用
    if [[ -n "$custom_version" ]]; then
        echo "$custom_version"
        return
    fi

    # 解析当前版本
    if [[ $current =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)(-([a-z]+)\.([0-9]+))?$ ]]; then
        MAJOR="${BASH_REMATCH[1]}"
        MINOR="${BASH_REMATCH[2]}"
        PATCH="${BASH_REMATCH[3]}"
        PRERELEASE_TYPE="${BASH_REMATCH[5]}"
        PRERELEASE_NUM="${BASH_REMATCH[6]}"
    else
        log_error "无法解析当前版本: $current"
        exit 1
    fi

    case "$type" in
        major)
            echo "$((MAJOR + 1)).0.0"
            ;;
        minor)
            echo "$MAJOR.$((MINOR + 1)).0"
            ;;
        patch)
            echo "$MAJOR.$MINOR.$((PATCH + 1))"
            ;;
        alpha)
            if [[ "$PRERELEASE_TYPE" == "alpha" ]]; then
                echo "$MAJOR.$MINOR.$PATCH-alpha.$((PRERELEASE_NUM + 1))"
            else
                echo "$MAJOR.$((MINOR + 1)).0-alpha.1"
            fi
            ;;
        beta)
            if [[ "$PRERELEASE_TYPE" == "beta" ]]; then
                echo "$MAJOR.$MINOR.$PATCH-beta.$((PRERELEASE_NUM + 1))"
            else
                echo "$MAJOR.$MINOR.$PATCH-beta.1"
            fi
            ;;
        rc)
            if [[ "$PRERELEASE_TYPE" == "rc" ]]; then
                echo "$MAJOR.$MINOR.$PATCH-rc.$((PRERELEASE_NUM + 1))"
            else
                echo "$MAJOR.$MINOR.$PATCH-rc.1"
            fi
            ;;
        release)
            # 去掉预发布标签
            echo "$MAJOR.$MINOR.$PATCH"
            ;;
        *)
            log_error "未知的版本类型: $type"
            exit 1
            ;;
    esac
}

# 更新版本号
update_version() {
    local new_version=$1

    log_info "更新版本号到 $new_version..."

    # 更新 package.json
    if [[ -f "upstream/paseo/package.json" ]]; then
        cd upstream/paseo
        npm version "$new_version" --no-git-tag-version
        cd "$PROJECT_ROOT"
        log_success "已更新 upstream/paseo/package.json"
    fi

    # 更新 Cargo.toml
    if [[ -f "Cargo.toml" ]]; then
        sed -i.bak "s/^version = \".*\"/version = \"$new_version\"/" Cargo.toml
        rm Cargo.toml.bak
        log_success "已更新 Cargo.toml"
    fi

    # 更新 Cargo.lock
    if [[ -f "Cargo.lock" ]]; then
        cargo update --workspace
        log_success "已更新 Cargo.lock"
    fi
}

# 运行测试
run_tests() {
    log_info "运行测试..."

    # Rust 测试
    log_info "运行 Rust 测试..."
    if ! cargo test --workspace --locked; then
        log_error "Rust 测试失败"
        return 1
    fi
    log_success "Rust 测试通过"

    # Paseo 测试
    log_info "运行 Paseo 测试..."
    cd upstream/paseo
    if ! npx vitest run packages/server/src/server/bootstrap.smoke.test.ts packages/server/src/server/agent/provider-snapshot-manager.test.ts --maxWorkers=1 > /dev/null 2>&1; then
        log_error "Paseo 测试失败"
        cd "$PROJECT_ROOT"
        return 1
    fi
    cd "$PROJECT_ROOT"
    log_success "Paseo 测试通过"

    log_success "所有测试通过"
}

# 构建项目
build_project() {
    log_info "构建项目..."

    # 构建 Rust
    log_info "构建 Rust 组件..."
    if ! cargo build --release; then
        log_error "Rust 构建失败"
        return 1
    fi
    log_success "Rust 构建完成"

    # 构建 Paseo
    log_info "构建 Paseo..."
    cd upstream/paseo
    if ! npm run build:server > /dev/null 2>&1; then
        log_error "Paseo 构建失败"
        cd "$PROJECT_ROOT"
        return 1
    fi
    cd "$PROJECT_ROOT"
    log_success "Paseo 构建完成"

    log_success "项目构建完成"
}

# 更新 CHANGELOG
update_changelog() {
    local new_version=$1
    local release_date=$(date +%Y-%m-%d)

    log_info "更新 CHANGELOG.md..."

    if [[ ! -f "CHANGELOG.md" ]]; then
        log_warning "CHANGELOG.md 不存在，创建新文件"
        cat > CHANGELOG.md <<EOF
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [$new_version] - $release_date

### Added
- Version $new_version release

EOF
    else
        # 在 [Unreleased] 后插入新版本
        sed -i.bak "/## \[Unreleased\]/a\\
\\
## [$new_version] - $release_date\\
\\
### Added\\
- Version $new_version release\\
" CHANGELOG.md
        rm CHANGELOG.md.bak
    fi

    log_success "CHANGELOG.md 已更新"
    log_warning "请手动编辑 CHANGELOG.md 添加详细变更"
}

# 创建 Git commit 和 tag
create_git_tag() {
    local new_version=$1
    local tag="v$new_version"

    log_info "创建 Git commit 和 tag..."

    # 提交变更
    git add .
    git commit -m "chore: release $tag"
    log_success "已创建 commit"

    # 创建 tag
    git tag -a "$tag" -m "Release $tag"
    log_success "已创建 tag: $tag"

    # 询问是否推送
    read -p "是否推送到远程仓库? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push origin HEAD
        git push origin "$tag"
        log_success "已推送到远程仓库"
    else
        log_warning "未推送，请手动执行: git push origin HEAD && git push origin $tag"
    fi
}

# 创建 GitHub Release
create_github_release() {
    local new_version=$1
    local tag="v$new_version"

    if ! command -v gh &> /dev/null; then
        log_warning "gh CLI 未安装，跳过 GitHub Release 创建"
        log_info "请手动访问: https://github.com/yourorg/codex-remote-workbench/releases/new?tag=$tag"
        return
    fi

    log_info "创建 GitHub Release..."

    # 判断是否为预发布
    local prerelease_flag=""
    if [[ $new_version =~ (alpha|beta|rc) ]]; then
        prerelease_flag="--prerelease"
    fi

    # 提取 CHANGELOG 中的变更说明
    local notes=""
    if [[ -f "CHANGELOG.md" ]]; then
        notes=$(sed -n "/## \[$new_version\]/,/## \[/p" CHANGELOG.md | head -n -1)
    fi

    if [[ -z "$notes" ]]; then
        notes="Release $tag"
    fi

    # 创建 release
    gh release create "$tag" \
        --title "Release $tag" \
        --notes "$notes" \
        $prerelease_flag \
        --draft

    log_success "GitHub Release 已创建（草稿状态）"
    log_info "请访问 GitHub 确认并发布: https://github.com/yourorg/codex-remote-workbench/releases"
}

# 主流程
main() {
    cd "$PROJECT_ROOT"

    # 解析参数
    if [[ $# -lt 1 ]]; then
        log_error "用法: $0 <type> [version]"
        log_info "type: alpha | beta | rc | release | patch | minor | major"
        log_info "version: 可选，指定自定义版本号"
        exit 1
    fi

    RELEASE_TYPE=$1
    CUSTOM_VERSION=${2:-}

    log_info "===== 版本发布流程 ====="
    log_info "发布类型: $RELEASE_TYPE"

    # 检查前置条件
    check_prerequisites

    # 获取当前版本
    CURRENT_VERSION=$(get_current_version)
    log_info "当前版本: $CURRENT_VERSION"

    # 计算新版本
    NEW_VERSION=$(calculate_new_version "$CURRENT_VERSION" "$RELEASE_TYPE" "$CUSTOM_VERSION")
    log_info "新版本: $NEW_VERSION"

    # 确认
    read -p "确认发布 v$NEW_VERSION? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "取消发布"
        exit 0
    fi

    # 更新版本号
    update_version "$NEW_VERSION"

    # 运行测试
    if ! run_tests; then
        log_error "测试失败，发布中止"
        git checkout .
        exit 1
    fi

    # 构建项目
    if ! build_project; then
        log_error "构建失败，发布中止"
        git checkout .
        exit 1
    fi

    # 更新 CHANGELOG
    update_changelog "$NEW_VERSION"

    # 创建 Git tag
    create_git_tag "$NEW_VERSION"

    # 创建 GitHub Release
    create_github_release "$NEW_VERSION"

    log_success "===== 发布完成 ====="
    log_info "版本: v$NEW_VERSION"
    log_info "下一步："
    log_info "  1. 编辑 CHANGELOG.md 补充详细变更"
    log_info "  2. 访问 GitHub Releases 确认并发布"
    log_info "  3. 通知团队和用户"
}

main "$@"
