# TLDR Code Analysis Skill

Use the TLDR CLI tool to analyze codebases efficiently, generating LLM-ready summaries with 95% fewer tokens than raw source files.

## When to Use TLDR

Invoke TLDR commands when you need to:
- Understand unfamiliar code without reading entire files
- Find code by behavior rather than syntax
- Trace dependencies before refactoring
- Debug by isolating code affecting specific lines
- Detect dead or unreachable code

## Core Commands

### Warm Up Indexes (Do First)

Before using other commands, ensure the codebase is indexed:

```bash
tldr warm .
```

This builds incremental indexes in `.tldr/cache/`. Only changed files are re-analyzed on subsequent runs.

### Generate LLM-Ready Context

When you need to understand a specific function or entry point:

```bash
tldr context <function_name> --project .
```

This produces a compressed summary including:
- Function signature and docstring
- Call graph (what it calls and what calls it)
- Complexity metrics
- Data flow patterns

Use this instead of reading raw source files when you need function context.

### Semantic Search

Find code by what it does, not how it's named:

```bash
tldr semantic "<query>" .
```

Examples:
- `tldr semantic "JWT validation" .` finds functions handling JWT tokens
- `tldr semantic "database connection pooling" .` finds connection management code
- `tldr semantic "retry with exponential backoff" .` finds retry logic

This searches 1024-dimensional embeddings combining signatures, call graphs, complexity, and data flow.

### Impact Analysis

Before modifying a shared function, discover all callers:

```bash
tldr impact <function_name> .
```

This reveals the blast radius of changes, helping you:
- Identify all code that would be affected
- Find tests that exercise the function
- Understand usage patterns across the codebase

### Program Slicing

When debugging, isolate exactly which lines affect a specific location:

```bash
tldr slice <file> <function> <line_number>
```

Example: `tldr slice src/auth.py validate_token 42`

This shows the minimal set of statements that could influence line 42, filtering out irrelevant code.

### Control Flow Analysis

Understand execution paths and complexity:

```bash
tldr cfg <file> <function>
```

Returns:
- Control flow graph visualization
- Cyclomatic complexity score
- Branch and loop structures

### Dead Code Detection

Find unreachable code in the codebase:

```bash
tldr dead .
```

Identifies functions that are defined but never called, helping with cleanup.

## Workflow Integration

### Starting a New Session

1. Run `tldr warm .` to ensure indexes are current
2. Use `tldr semantic` to locate relevant code areas
3. Use `tldr context` on specific functions you need to understand

### Debugging Workflow

1. Use `tldr slice` to find lines affecting the bug location
2. Use `tldr context` on suspected functions
3. Use `tldr cfg` if control flow is complex

### Refactoring Workflow

1. Use `tldr impact` to find all callers before changing a function
2. Use `tldr context` to understand current implementation
3. After changes, re-run `tldr warm .` to update indexes

### Feature Development

1. Use `tldr semantic` to find analogous implementations
2. Use `tldr context` on similar functions to understand patterns
3. Use `tldr impact` to understand integration points

## Five Analysis Layers

TLDR analyzes code through progressive layers:

1. **AST (Layer 1)**: Function signatures, class definitions, imports
2. **Call Graph (Layer 2)**: Forward and backward function dependencies
3. **CFG (Layer 3)**: Control flow paths and cyclomatic complexity
4. **DFG (Layer 4)**: Variable definitions, uses, and data transformations
5. **PDG (Layer 5)**: Program slicing to isolate code affecting specific lines

Higher layers include data from lower ones. Use the simplest layer sufficient for your task.

## Performance Notes

- Daemon queries complete in ~10ms (vs 30s for CLI spawns)
- Daemon auto-starts on first query, auto-stops after 5 minutes idle
- Incremental updates via content-hash dirty detection (<1s vs 8s full rebuild)

## Language Support

Full analysis support for: Python, TypeScript, JavaScript, Go, Rust, Java, C, C++, Ruby, PHP, Swift, Kotlin, Scala, C#, Lua, Elixir

## Prefer TLDR Over Raw File Reading

When exploring code, prefer TLDR commands over reading entire source files:

| Task | Instead of | Use |
|------|-----------|-----|
| Understand a function | Reading the whole file | `tldr context <func>` |
| Find related code | Grepping for keywords | `tldr semantic "<behavior>"` |
| Check what calls X | Manual search | `tldr impact <func>` |
| Debug a line | Reading surrounding code | `tldr slice <file> <func> <line>` |
| Check complexity | Counting branches manually | `tldr cfg <file> <func>` |

This reduces context window usage by 90-99% while providing richer structural information.

## Claude Code Hooks Integration

TLDR integrates via TypeScript hooks that query the daemon for zero-overhead code understanding. These hooks automate TLDR usage so you get code context without manual commands.

### Available Hooks

| Hook | Triggers On | TLDR Operation |
|------|-------------|----------------|
| `session-start-tldr-cache` | SessionStart | Auto-start daemon, warm indexes |
| `session-start-dead-code` | SessionStart | Detect unreachable functions |
| `tldr-context-inject` | PreToolUse (Task, Read) | Inject function context into prompt |
| `smart-search-router` | PreToolUse (Grep) | Use TLDR semantic search instead |
| `edit-context-inject` | PreToolUse (Edit) | Extract file structure for safer edits |
| `signature-helper` | PreToolUse (Edit) | Find function signatures in scope |
| `arch-context-inject` | PreToolUse (Task) | Inject architecture layer info |
| `post-edit-diagnostics` | PostToolUse (Edit, Write) | Shift-left validation - catch type errors immediately |

### Hook Implementation Pattern

```typescript
// .claude/hooks/src/any-hook.ts
import { queryDaemonSync } from './daemon-client.js';

export default function hook(context: HookContext) {
  const projectDir = context.workingDirectory;

  // Query daemon (100ms, in-memory indexes)
  const result = queryDaemonSync(projectDir, {
    cmd: 'dead',
    language: 'python'
  });

  // Fallback: If daemon not running, client auto-spawns CLI
  return {
    continue: true,
    message: result.summary
  };
}
```

### Shift-Left Validation

The `post-edit-diagnostics` hook catches type errors at edit time, not test time.

Traditional flow:
```
Edit → Run tests → Tests fail → "Type error" → Fix → Run tests again
       └─────────────────── 30-60 seconds wasted ───────────────────┘
```

With shift-left:
```
Edit → [hook: diagnostics] → "Type error line 42" → Fix immediately
       └── 200ms ──┘
```

Why it matters:
- Type errors are deterministic - no need to "test" them
- Pyright catches errors tests miss (unreachable code, wrong types)
- Faster iteration = more attempts per session = better results

The hook is silent when everything's fine. Only speaks up when there's a problem.

### Setting Up Hooks

Create hooks in `.claude/hooks/` directory:

```
.claude/hooks/
├── src/
│   ├── daemon-client.ts      # TLDR daemon communication
│   ├── session-start.ts      # SessionStart hook
│   ├── context-inject.ts     # PreToolUse hook for Read/Task
│   └── post-edit.ts          # PostToolUse hook for Edit/Write
├── package.json
└── tsconfig.json
```

Register hooks in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": ["node .claude/hooks/dist/session-start.js"],
    "PreToolUse": {
      "Read": ["node .claude/hooks/dist/context-inject.js"],
      "Edit": ["node .claude/hooks/dist/edit-context.js"]
    },
    "PostToolUse": {
      "Edit": ["node .claude/hooks/dist/post-edit.js"],
      "Write": ["node .claude/hooks/dist/post-edit.js"]
    }
  }
}
```

## MCP Server Integration

For direct tool access, configure TLDR as an MCP server:

```json
{
  "mcpServers": {
    "tldr": {
      "command": "tldr-mcp",
      "args": ["--project", "."]
    }
  }
}
```

This exposes TLDR commands as tools Claude can call directly.
