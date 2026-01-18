#!/bin/bash
set -e

# TLDR Claude Code Plugin Installer
# Usage: ./install-tldr.sh [--global | --project <path>]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_SRC="$SCRIPT_DIR/.claude/plugins/tldr"
HOOKS_SRC="$SCRIPT_DIR/.claude/hooks"
SETTINGS_SRC="$SCRIPT_DIR/.claude/settings.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  TLDR Claude Code Plugin Installer${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_usage() {
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --global, -g              Install globally to ~/.claude/"
    echo "  --project, -p <path>      Install to specific project directory"
    echo "  --skill-only              Install only the skill (no hooks)"
    echo "  --hooks-only              Install only hooks (no skill)"
    echo "  --help, -h                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --global                    # Install for all projects"
    echo "  $0 --project .                 # Install in current directory"
    echo "  $0 --project ~/my-app          # Install in ~/my-app"
    echo "  $0 --global --skill-only       # Global skill without hooks"
    echo ""
}

check_source_files() {
    if [[ ! -d "$PLUGIN_SRC" ]]; then
        echo -e "${RED}Error: Plugin source not found at $PLUGIN_SRC${NC}"
        exit 1
    fi
    if [[ ! -d "$HOOKS_SRC" ]]; then
        echo -e "${RED}Error: Hooks source not found at $HOOKS_SRC${NC}"
        exit 1
    fi
}

merge_settings() {
    local target_settings="$1"
    local source_settings="$SETTINGS_SRC"

    if [[ -f "$target_settings" ]]; then
        echo -e "${YELLOW}  Merging with existing settings.json...${NC}"
        # Use jq if available, otherwise warn user
        if command -v jq &> /dev/null; then
            local temp_file=$(mktemp)
            jq -s '.[0] * .[1]' "$target_settings" "$source_settings" > "$temp_file"
            mv "$temp_file" "$target_settings"
        else
            echo -e "${YELLOW}  Warning: jq not installed. Please manually merge settings.${NC}"
            echo -e "${YELLOW}  Source settings saved to: ${target_settings}.tldr${NC}"
            cp "$source_settings" "${target_settings}.tldr"
        fi
    else
        cp "$source_settings" "$target_settings"
    fi
}

build_hooks() {
    local hooks_dir="$1"

    echo -e "${BLUE}  Building hooks...${NC}"

    if ! command -v npm &> /dev/null; then
        echo -e "${YELLOW}  Warning: npm not found. Please run manually:${NC}"
        echo -e "${YELLOW}    cd $hooks_dir && npm install && npm run build${NC}"
        return
    fi

    (cd "$hooks_dir" && npm install --silent && npm run build --silent)
    echo -e "${GREEN}  Hooks built successfully${NC}"
}

install_global() {
    local install_skill="$1"
    local install_hooks="$2"

    local target_dir="$HOME/.claude"

    echo -e "${GREEN}Installing globally to $target_dir${NC}"
    echo ""

    mkdir -p "$target_dir"

    if [[ "$install_skill" == "true" ]]; then
        echo -e "${BLUE}  Installing skill...${NC}"
        mkdir -p "$target_dir/plugins"
        cp -r "$PLUGIN_SRC" "$target_dir/plugins/"
        echo -e "${GREEN}  ✓ Skill installed to $target_dir/plugins/tldr${NC}"
    fi

    if [[ "$install_hooks" == "true" ]]; then
        echo -e "${BLUE}  Installing hooks...${NC}"
        cp -r "$HOOKS_SRC" "$target_dir/hooks"
        build_hooks "$target_dir/hooks"
        echo -e "${GREEN}  ✓ Hooks installed to $target_dir/hooks${NC}"

        echo -e "${BLUE}  Configuring settings...${NC}"
        merge_settings "$target_dir/settings.json"
        echo -e "${GREEN}  ✓ Settings configured${NC}"
    fi
}

install_project() {
    local project_path="$1"
    local install_skill="$2"
    local install_hooks="$3"

    # Resolve to absolute path
    project_path="$(cd "$project_path" 2>/dev/null && pwd)" || {
        echo -e "${RED}Error: Directory does not exist: $project_path${NC}"
        exit 1
    }

    local target_dir="$project_path/.claude"

    echo -e "${GREEN}Installing to project: $project_path${NC}"
    echo ""

    mkdir -p "$target_dir"

    if [[ "$install_skill" == "true" ]]; then
        echo -e "${BLUE}  Installing skill...${NC}"
        mkdir -p "$target_dir/plugins"
        cp -r "$PLUGIN_SRC" "$target_dir/plugins/"
        echo -e "${GREEN}  ✓ Skill installed to $target_dir/plugins/tldr${NC}"
    fi

    if [[ "$install_hooks" == "true" ]]; then
        echo -e "${BLUE}  Installing hooks...${NC}"
        cp -r "$HOOKS_SRC" "$target_dir/"
        build_hooks "$target_dir/hooks"
        echo -e "${GREEN}  ✓ Hooks installed to $target_dir/hooks${NC}"

        echo -e "${BLUE}  Configuring settings...${NC}"
        merge_settings "$target_dir/settings.json"
        echo -e "${GREEN}  ✓ Settings configured${NC}"
    fi
}

print_post_install() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Installation complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Ensure TLDR CLI is installed: pip install llm-tldr"
    echo "  2. Restart Claude Code to load the plugin"
    echo "  3. Run 'tldr warm .' in your project to build indexes"
    echo ""
    echo "Available commands:"
    echo "  /tldr                - Invoke the TLDR skill"
    echo "  tldr context <func>  - Get function context"
    echo "  tldr semantic <q>    - Semantic search"
    echo "  tldr impact <func>   - Impact analysis"
    echo ""
}

# Main
print_header

MODE=""
PROJECT_PATH=""
INSTALL_SKILL="true"
INSTALL_HOOKS="true"

while [[ $# -gt 0 ]]; do
    case $1 in
        --global|-g)
            MODE="global"
            shift
            ;;
        --project|-p)
            MODE="project"
            PROJECT_PATH="$2"
            shift 2
            ;;
        --skill-only)
            INSTALL_HOOKS="false"
            shift
            ;;
        --hooks-only)
            INSTALL_SKILL="false"
            shift
            ;;
        --help|-h)
            print_usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            print_usage
            exit 1
            ;;
    esac
done

if [[ -z "$MODE" ]]; then
    print_usage
    exit 1
fi

check_source_files

if [[ "$MODE" == "global" ]]; then
    install_global "$INSTALL_SKILL" "$INSTALL_HOOKS"
elif [[ "$MODE" == "project" ]]; then
    if [[ -z "$PROJECT_PATH" ]]; then
        echo -e "${RED}Error: --project requires a path argument${NC}"
        print_usage
        exit 1
    fi
    install_project "$PROJECT_PATH" "$INSTALL_SKILL" "$INSTALL_HOOKS"
fi

print_post_install
