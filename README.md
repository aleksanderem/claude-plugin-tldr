# TLDR Plugin for Claude Code

Claude Code plugin integrating [TLDR](https://github.com/parcadei/llm-tldr) - a code analysis tool that provides LLM-ready context with 95% fewer tokens.

## Features

The plugin provides:

- Skill with TLDR command reference and workflows
- Hooks for automatic code analysis during Claude Code sessions
- MCP server integration for direct tool access

### Hooks

| Hook | Trigger | Purpose |
|------|---------|---------|
| `session-start` | SessionStart | Warm indexes, detect dead code |
| `context-inject` | PreToolUse (Read/Task) | Inject function context from TLDR |
| `post-edit-diagnostics` | PostToolUse (Edit/Write) | Shift-left type checking |

### Commands

Once installed, TLDR commands are available:

```bash
tldr warm .                        # Index codebase
tldr context <function>            # Get function summary
tldr semantic "<query>"            # Search by behavior
tldr impact <function>             # Find all callers
tldr slice <file> <func> <line>    # Debug dependencies
tldr cfg <file> <function>         # Control flow analysis
tldr dead .                        # Find unreachable code
```

## Prerequisites

Install TLDR CLI:

```bash
pip install llm-tldr
```

## Installation

### Global Installation (All Projects)

```bash
./install-tldr.sh --global
```

Installs to `~/.claude/` - available in every Claude Code session.

### Project Installation

```bash
./install-tldr.sh --project /path/to/your/project

# Or for current directory:
./install-tldr.sh --project .
```

Installs to `.claude/` in the specified project.

### Partial Installation

Install only the skill (no hooks):

```bash
./install-tldr.sh --global --skill-only
```

Install only hooks (no skill):

```bash
./install-tldr.sh --project . --hooks-only
```

## Manual Installation

If you prefer manual installation:

### 1. Copy Plugin

```bash
# Global
cp -r .claude/plugins/tldr ~/.claude/plugins/

# Or per-project
cp -r .claude/plugins/tldr /your/project/.claude/plugins/
```

### 2. Copy and Build Hooks

```bash
# Global
cp -r .claude/hooks ~/.claude/
cd ~/.claude/hooks && npm install && npm run build

# Or per-project
cp -r .claude/hooks /your/project/.claude/
cd /your/project/.claude/hooks && npm install && npm run build
```

### 3. Configure Settings

Add to your `~/.claude/settings.json` or `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": {},
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/dist/session-start.js",
            "timeout": 30000
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": { "tools": ["Read", "Task"] },
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/dist/context-inject.js",
            "timeout": 10000
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": { "tools": ["Edit", "Write"] },
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/dist/post-edit-diagnostics.js",
            "timeout": 30000
          }
        ]
      }
    ]
  },
  "mcpServers": {
    "tldr": {
      "command": "tldr-mcp",
      "args": ["--project", "."]
    }
  }
}
```

## Usage

### Starting a Session

The `session-start` hook automatically:
1. Starts the TLDR daemon
2. Warms indexes for the current project
3. Reports any dead code found

### During Development

When you read or explore code, the `context-inject` hook automatically provides TLDR summaries, reducing token usage.

### After Editing

The `post-edit-diagnostics` hook runs type checking (pyright for Python, tsc for TypeScript) immediately after edits, catching errors before you run tests.

### Manual Commands

Invoke the skill manually:

```
/tldr
```

Or run TLDR commands directly in the terminal.

## File Structure

```
.claude/
├── settings.json                    # Hook and MCP configuration
├── hooks/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── daemon-client.ts         # TLDR daemon communication
│   │   ├── session-start.ts         # SessionStart hook
│   │   ├── context-inject.ts        # PreToolUse hook
│   │   └── post-edit-diagnostics.ts # PostToolUse hook
│   └── dist/                        # Compiled JavaScript (after build)
└── plugins/tldr/
    ├── plugin.json                  # Plugin manifest
    └── skills/
        └── tldr.md                  # Skill documentation
```

## Troubleshooting

### Hooks not running

1. Check hooks are built: `ls .claude/hooks/dist/`
2. If empty, rebuild: `cd .claude/hooks && npm run build`
3. Verify settings.json paths match your installation

### TLDR commands fail

1. Verify TLDR is installed: `tldr --version`
2. Warm the indexes: `tldr warm .`
3. Check daemon status: `tldr daemon status`

### Type checking not working

The post-edit hook requires:
- Python files: `pyright` installed (`pip install pyright`)
- TypeScript files: `typescript` in project or globally

## License

MIT
