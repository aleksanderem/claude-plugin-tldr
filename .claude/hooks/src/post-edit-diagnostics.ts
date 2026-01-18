#!/usr/bin/env node
/**
 * PostToolUse hook: Shift-left validation after Edit/Write
 *
 * Triggers: After Edit or Write tool completes
 * Purpose: Catch type errors immediately, not during testing
 */

import { execFileSync } from 'child_process';
import { extname } from 'path';

interface ToolResult {
  tool: string;
  file_path?: string;
  success: boolean;
}

interface HookInput {
  tool_result: ToolResult;
  cwd: string;
}

interface HookOutput {
  continue: boolean;
  message?: string;
}

interface Diagnostic {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

function runPyright(projectDir: string, filePath: string): Diagnostic[] {
  try {
    execFileSync('pyright', [filePath, '--outputjson'], {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 30000
    });
    return [];
  } catch (error: any) {
    if (error.stdout) {
      try {
        const result = JSON.parse(error.stdout);
        return (result.generalDiagnostics || []).map((d: any) => ({
          file: d.file,
          line: d.range?.start?.line || 0,
          message: d.message,
          severity: d.severity === 1 ? 'error' : 'warning'
        }));
      } catch {
        return [];
      }
    }
    return [];
  }
}

function runTsc(projectDir: string, filePath: string): Diagnostic[] {
  try {
    execFileSync('npx', ['tsc', '--noEmit', filePath], {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 30000
    });
    return [];
  } catch (error: any) {
    if (error.stdout) {
      const lines = error.stdout.split('\n');
      const diagnostics: Diagnostic[] = [];

      for (const line of lines) {
        const match = line.match(/^(.+)\((\d+),\d+\): error TS\d+: (.+)$/);
        if (match) {
          diagnostics.push({
            file: match[1],
            line: parseInt(match[2], 10),
            message: match[3],
            severity: 'error'
          });
        }
      }
      return diagnostics;
    }
    return [];
  }
}

function getLanguage(filePath: string): 'python' | 'typescript' | 'javascript' | 'unknown' {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case '.py': return 'python';
    case '.ts': case '.tsx': return 'typescript';
    case '.js': case '.jsx': return 'javascript';
    default: return 'unknown';
  }
}

async function main(): Promise<void> {
  const input: HookInput = JSON.parse(process.argv[2] || '{}');
  const projectDir = input.cwd || process.cwd();
  const toolResult = input.tool_result;

  // Only run on successful Edit/Write operations
  if (!toolResult?.success || !toolResult?.file_path) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const filePath = toolResult.file_path;
  const language = getLanguage(filePath);

  let diagnostics: Diagnostic[] = [];

  if (language === 'python') {
    diagnostics = runPyright(projectDir, filePath);
  } else if (language === 'typescript') {
    diagnostics = runTsc(projectDir, filePath);
  }

  // Filter to only errors
  const errors = diagnostics.filter(d => d.severity === 'error');

  if (errors.length === 0) {
    // Silent when everything's fine
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  // Format error messages
  const messages = errors.slice(0, 5).map(e =>
    `Line ${e.line}: ${e.message}`
  );

  if (errors.length > 5) {
    messages.push(`... and ${errors.length - 5} more errors`);
  }

  const output: HookOutput = {
    continue: true,
    message: `Type errors in ${filePath}:\n${messages.join('\n')}`
  };

  console.log(JSON.stringify(output));
}

main().catch(error => {
  console.log(JSON.stringify({
    continue: true,
    message: `Diagnostics hook error: ${error.message}`
  }));
});
