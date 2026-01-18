#!/usr/bin/env node
/**
 * SessionStart hook: Warms TLDR indexes and detects dead code
 *
 * Triggers: When a new Claude Code session starts
 * Purpose: Ensure indexes are current and report any dead code found
 */

import { warmIndexes, detectDeadCode } from './daemon-client.js';

interface HookInput {
  session_id: string;
  cwd: string;
}

interface HookOutput {
  continue: boolean;
  message?: string;
}

async function main(): Promise<void> {
  const input: HookInput = JSON.parse(process.argv[2] || '{}');
  const projectDir = input.cwd || process.cwd();

  const messages: string[] = [];

  // Warm indexes
  const warmResult = warmIndexes(projectDir);
  if (warmResult.success) {
    messages.push('TLDR indexes warmed');
  } else {
    messages.push(`TLDR warm failed: ${warmResult.error}`);
  }

  // Detect dead code
  const deadResult = detectDeadCode(projectDir);
  if (deadResult.success && deadResult.output.trim()) {
    const deadFunctions = deadResult.output.trim().split('\n').filter(Boolean);
    if (deadFunctions.length > 0) {
      messages.push(`Dead code detected: ${deadFunctions.length} unreachable functions`);
      if (deadFunctions.length <= 5) {
        messages.push(deadFunctions.join(', '));
      }
    }
  }

  const output: HookOutput = {
    continue: true,
    message: messages.length > 0 ? messages.join('\n') : undefined
  };

  console.log(JSON.stringify(output));
}

main().catch(error => {
  console.log(JSON.stringify({
    continue: true,
    message: `TLDR session hook error: ${error.message}`
  }));
});
