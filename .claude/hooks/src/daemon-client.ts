import { execFileSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { createHash } from 'crypto';

interface DaemonQuery {
  cmd: 'warm' | 'context' | 'semantic' | 'impact' | 'slice' | 'cfg' | 'dead';
  args?: string[];
  language?: string;
}

interface DaemonResult {
  success: boolean;
  output: string;
  summary?: string;
  error?: string;
}

function getSocketPath(projectDir: string): string {
  const hash = createHash('md5').update(projectDir).digest('hex').slice(0, 8);
  return `/tmp/tldr-daemon-${hash}.sock`;
}

function isDaemonRunning(projectDir: string): boolean {
  const socketPath = getSocketPath(projectDir);
  return existsSync(socketPath);
}

function startDaemon(projectDir: string): boolean {
  try {
    spawnSync('tldr', ['daemon', 'start'], {
      cwd: projectDir,
      stdio: 'ignore',
      detached: true
    });
    // Wait briefly for daemon to initialize
    spawnSync('sleep', ['0.5']);
    return isDaemonRunning(projectDir);
  } catch {
    return false;
  }
}

export function queryDaemonSync(projectDir: string, query: DaemonQuery): DaemonResult {
  // Ensure daemon is running
  if (!isDaemonRunning(projectDir)) {
    if (!startDaemon(projectDir)) {
      // Fallback to CLI
      return queryCliSync(projectDir, query);
    }
  }

  try {
    const args = [query.cmd, ...(query.args || [])];
    if (query.language) {
      args.push('--language', query.language);
    }
    args.push('--project', projectDir);

    const result = execFileSync('tldr', args, {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 10000 // 10s timeout
    });

    return {
      success: true,
      output: result,
      summary: extractSummary(result)
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function queryCliSync(projectDir: string, query: DaemonQuery): DaemonResult {
  try {
    const args = [query.cmd, ...(query.args || [])];
    if (query.language) {
      args.push('--language', query.language);
    }
    args.push('--project', projectDir);

    const result = execFileSync('tldr', args, {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 60000 // 60s timeout for CLI fallback
    });

    return {
      success: true,
      output: result,
      summary: extractSummary(result)
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function extractSummary(output: string): string {
  const lines = output.trim().split('\n');
  if (lines.length <= 5) return output.trim();
  return lines.slice(0, 5).join('\n') + `\n... (${lines.length - 5} more lines)`;
}

export function warmIndexes(projectDir: string): DaemonResult {
  return queryDaemonSync(projectDir, { cmd: 'warm' });
}

export function getContext(projectDir: string, functionName: string): DaemonResult {
  return queryDaemonSync(projectDir, { cmd: 'context', args: [functionName] });
}

export function semanticSearch(projectDir: string, query: string): DaemonResult {
  return queryDaemonSync(projectDir, { cmd: 'semantic', args: [query] });
}

export function detectDeadCode(projectDir: string): DaemonResult {
  return queryDaemonSync(projectDir, { cmd: 'dead' });
}

export function getImpact(projectDir: string, functionName: string): DaemonResult {
  return queryDaemonSync(projectDir, { cmd: 'impact', args: [functionName] });
}
