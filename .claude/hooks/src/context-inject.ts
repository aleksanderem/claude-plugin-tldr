#!/usr/bin/env node
/**
 * PreToolUse hook: Injects TLDR context before Read/Task operations
 *
 * Triggers: Before Read or Task tool is executed
 * Purpose: Automatically provide function context to reduce token usage
 */

import { getContext, semanticSearch } from './daemon-client.js';
import { basename } from 'path';

interface ToolInput {
  tool: string;
  file_path?: string;
  prompt?: string;
  pattern?: string;
}

interface HookInput {
  tool_input: ToolInput;
  cwd: string;
}

interface HookOutput {
  continue: boolean;
  message?: string;
  modify_input?: Partial<ToolInput>;
}

function extractFunctionName(filePath: string): string | null {
  // Try to extract function name from file path context
  const fileName = basename(filePath, '.py').replace(/_/g, '');
  return fileName || null;
}

function extractSearchQuery(prompt: string): string | null {
  // Look for patterns suggesting code search
  const patterns = [
    /find\s+(?:the\s+)?(?:function|method|class)\s+(?:that\s+)?(.+)/i,
    /where\s+(?:is|are)\s+(.+)\s+(?:handled|implemented|defined)/i,
    /how\s+(?:does|do)\s+(.+)\s+work/i,
    /look\s+for\s+(.+)/i
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

async function main(): Promise<void> {
  const input: HookInput = JSON.parse(process.argv[2] || '{}');
  const projectDir = input.cwd || process.cwd();
  const toolInput = input.tool_input;

  // Handle Read tool - inject function context
  if (toolInput.tool === 'Read' && toolInput.file_path) {
    const funcName = extractFunctionName(toolInput.file_path);
    if (funcName) {
      const contextResult = getContext(projectDir, funcName);
      if (contextResult.success && contextResult.summary) {
        console.log(JSON.stringify({
          continue: true,
          message: `TLDR context for ${funcName}:\n${contextResult.summary}`
        }));
        return;
      }
    }
  }

  // Handle Task tool with explore intent - use semantic search
  if (toolInput.tool === 'Task' && toolInput.prompt) {
    const query = extractSearchQuery(toolInput.prompt);
    if (query) {
      const searchResult = semanticSearch(projectDir, query);
      if (searchResult.success && searchResult.output) {
        const relevantResults = searchResult.output.split('\n').slice(0, 5).join('\n');
        console.log(JSON.stringify({
          continue: true,
          message: `TLDR semantic search for "${query}":\n${relevantResults}`
        }));
        return;
      }
    }
  }

  // No context injection needed
  console.log(JSON.stringify({ continue: true }));
}

main().catch(error => {
  console.log(JSON.stringify({
    continue: true,
    message: `Context inject error: ${error.message}`
  }));
});
