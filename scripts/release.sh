#!/usr/bin/env bash
# Create a root-repository release commit and tag.
# Usage: ./scripts/release.sh <alpha|beta|rc|release|patch|minor|major> [version]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

log_info() { printf '%s\n' "${BLUE}i${NC} $1"; }
log_success() { printf '%s\n' "${GREEN}ok${NC} $1"; }
log_warning() { printf '%s\n' "${YELLOW}!${NC} $1"; }
log_error() { printf '%s\n' "${RED}error${NC} $1" >&2; }

usage() {
    cat <<'USAGE'
Usage: scripts/release.sh <type> [version]
  type: alpha | beta | rc | release | patch | minor | major
  version: optional explicit SemVer (recommended for the first release)

The root repository has no package manifest version. The first release therefore
uses 0.1.0 as the Rust workspace baseline when no tag exists. Paseo remains a
pinned submodule and is never version-bumped by this script.
USAGE
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        log_error "required command not found: $1"
        exit 1
    fi
}

assert_submodule_clean() {
    local path
    for path in upstream/paseo upstream/oh-my-pi; do
        [[ -d "$PROJECT_ROOT/$path" ]] || continue
        if [[ -n "$(git -C "$PROJECT_ROOT/$path" status --porcelain --untracked-files=all)" ]]; then
            log_error "$path has uncommitted changes; commit the submodule first"
            git -C "$PROJECT_ROOT/$path" status --short --untracked-files=all
            exit 1
        fi
    done
}

check_prerequisites() {
    log_info "checking release prerequisites"
    require_command git
    require_command node
    require_command npm
    require_command cargo

    if [[ ! -f "$PROJECT_ROOT/Cargo.toml" ]]; then
        log_error "root Cargo.toml is missing"
        exit 1
    fi

    if [[ -n "$(git -C "$PROJECT_ROOT" status --porcelain --untracked-files=normal)" ]]; then
        log_error "root worktree is not clean; commit or remove changes before releasing"
        git -C "$PROJECT_ROOT" status --short --untracked-files=normal
        exit 1
    fi
    assert_submodule_clean

    local current_branch
    current_branch="$(git -C "$PROJECT_ROOT" branch --show-current)"
    if [[ "$RELEASE_TYPE" == "release" && "$current_branch" != "main" ]]; then
        log_error "a stable release must be created from main (current: $current_branch)"
        exit 1
    fi

    if [[ ! -d "$PROJECT_ROOT/upstream/paseo/node_modules" ]]; then
        log_error "upstream/paseo dependencies are not installed; run (cd upstream/paseo && npm ci)"
        exit 1
    fi
    log_success "prerequisites passed"
}

get_current_version() {
    local tag version
    tag="$(git -C "$PROJECT_ROOT" describe --tags --abbrev=0 2>/dev/null || true)"
    if [[ -n "$tag" ]]; then
        version="${tag#v}"
        printf '%s\n' "$version"
    else
        # Both root crates currently declare 0.1.0; there is no root package
        # manifest from which a different release version could be read.
        printf '%s\n' "0.1.0"
    fi
}

normalise_version() {
    local value="$1"
    value="${value#v}"
    if [[ ! "$value" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+\.[0-9]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
        log_error "invalid SemVer: $1"
        exit 1
    fi
    printf '%s\n' "$value"
}

calculate_new_version() {
    local current="$1"
    local type="$2"
    local custom="$3"
    local major minor patch prerelease_type prerelease_num base

    if [[ -n "$custom" ]]; then
        normalise_version "$custom"
        return
    fi

    if [[ ! "$current" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)(-([0-9A-Za-z-]+)\.([0-9]+))?(\+[0-9A-Za-z.-]+)?$ ]]; then
        log_error "cannot parse current version: $current"
        exit 1
    fi
    major="${BASH_REMATCH[1]}"
    minor="${BASH_REMATCH[2]}"
    patch="${BASH_REMATCH[3]}"
    prerelease_type="${BASH_REMATCH[5]:-}"
    prerelease_num="${BASH_REMATCH[6]:-0}"
    base="$major.$minor.$patch"

    case "$type" in
        major) printf '%s\n' "$((major + 1)).0.0" ;;
        minor) printf '%s\n' "$major.$((minor + 1)).0" ;;
        patch) printf '%s\n' "$major.$minor.$((patch + 1))" ;;
        alpha)
            if [[ "$prerelease_type" == "alpha" ]]; then
                printf '%s\n' "$base-alpha.$((prerelease_num + 1))"
            else
                printf '%s\n' "$major.$((minor + 1)).0-alpha.1"
            fi
            ;;
        beta)
            if [[ "$prerelease_type" == "beta" ]]; then
                printf '%s\n' "$base-beta.$((prerelease_num + 1))"
            else
                printf '%s\n' "$base-beta.1"
            fi
            ;;
        rc)
            if [[ "$prerelease_type" == "rc" ]]; then
                printf '%s\n' "$base-rc.$((prerelease_num + 1))"
            else
                printf '%s\n' "$base-rc.1"
            fi
            ;;
        release) printf '%s\n' "$base" ;;
        *) log_error "unknown release type: $type"; usage; exit 1 ;;
    esac
}

run_tests() {
    log_info "running Rust tests"
    cargo test --workspace --locked

    log_info "running focused Paseo provider tests"
    (
        cd "$PROJECT_ROOT/upstream/paseo"
        npx vitest run \
            packages/server/src/server/bootstrap.smoke.test.ts \
            packages/server/src/server/agent/provider-snapshot-manager.test.ts \
            --maxWorkers=1
    )
    log_success "tests passed"
}

build_project() {
    log_info "building Rust bridge"
    cargo build --release

    log_info "building the pinned Paseo server and web UI"
    (
        cd "$PROJECT_ROOT/upstream/paseo"
        npm run build:server
        npm run build:daemon-web-ui
    )
    log_success "builds passed"
}

update_changelog() {
    local new_version="$1"
    local release_date
    local section
    local tmp
    release_date="$(date +%Y-%m-%d)"
    section="## [$new_version] - $release_date"$'\n\n'"### Changed"$'\n- Root release metadata and pinned submodule revision\n'

    if [[ ! -f "$PROJECT_ROOT/CHANGELOG.md" ]]; then
        cat >"$PROJECT_ROOT/CHANGELOG.md" <<EOF
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

$section
EOF
    else
        tmp="$(mktemp "$PROJECT_ROOT/.changelog.XXXXXX")"
        awk -v section="$section" '
            !inserted && /^## \[Unreleased\]/ { print; print ""; print section; inserted = 1; next }
            { print }
            END { if (!inserted) print section }
        ' "$PROJECT_ROOT/CHANGELOG.md" >"$tmp"
        mv "$tmp" "$PROJECT_ROOT/CHANGELOG.md"
    fi
    log_success "CHANGELOG.md updated"
}

create_git_tag() {
    local new_version="$1"
    local tag="v$new_version"

    if git -C "$PROJECT_ROOT" rev-parse "$tag" >/dev/null 2>&1; then
        log_error "tag already exists: $tag"
        exit 1
    fi

    git -C "$PROJECT_ROOT" add -- CHANGELOG.md
    git -C "$PROJECT_ROOT" commit -m "chore: release $tag"
    git -C "$PROJECT_ROOT" tag -a "$tag" -m "Release $tag"
    log_success "created commit and tag $tag"

    if [[ "${RELEASE_PUSH:-0}" == "1" ]]; then
        if ! git -C "$PROJECT_ROOT" remote get-url origin >/dev/null 2>&1; then
            log_error "RELEASE_PUSH=1 requires an origin remote"
            exit 1
        fi
        git -C "$PROJECT_ROOT" push origin HEAD
        git -C "$PROJECT_ROOT" push origin "$tag"
        log_success "pushed $tag"
    else
        log_warning "not pushed; set RELEASE_PUSH=1 after configuring a remote"
    fi

    if [[ "${RELEASE_GITHUB_DRAFT:-0}" == "1" ]]; then
        require_command gh
        gh release create "$tag" --draft --generate-notes
        log_success "created GitHub draft for $tag"
    fi
}

main() {
    cd "$PROJECT_ROOT"
    if [[ $# -lt 1 || $# -gt 2 ]]; then
        usage
        exit 1
    fi

    RELEASE_TYPE="$1"
    CUSTOM_VERSION="${2:-}"
    check_prerequisites

    local current_version new_version
    current_version="$(get_current_version)"
    new_version="$(calculate_new_version "$current_version" "$RELEASE_TYPE" "$CUSTOM_VERSION")"
    log_info "current root release baseline: $current_version"
    log_info "next version: $new_version"

    if [[ "${RELEASE_CONFIRM:-0}" != "1" ]]; then
        read -r -p "Create v$new_version? (y/N) " answer
        if [[ ! "$answer" =~ ^[Yy]$ ]]; then
            log_warning "release cancelled"
            exit 0
        fi
    fi

    run_tests
    build_project
    assert_submodule_clean
    update_changelog "$new_version"
    create_git_tag "$new_version"
    log_success "release complete: v$new_version"
}

main "$@"
