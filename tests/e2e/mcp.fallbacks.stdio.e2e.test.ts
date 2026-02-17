import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type ToolCallResult = {
  structuredContent?: unknown;
};

describe('MCP e2e fallback paths (stdio transport)', () => {
  it(
    'falls back when tenant signals cannot be read and when LLM call fails in auto mode',
    { timeout: 30_000 },
    async () => {
      const repoRoot = process.cwd();

      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [join(repoRoot, 'dist', 'entrypoints', 'stdio.js')],
        cwd: repoRoot,
        stderr: 'inherit',
        env: {
          ...process.env,
          LLM_CHAT_COMPLETIONS_URL: 'http://127.0.0.1:1/v1/chat/completions',
          LLM_AUTH_MODE: 'none',
          LLM_TIMEOUT_MS: '25'
        }
      });

      const client = new Client({ name: 'meetings-mcp-fallbacks-stdio', version: '0.1.0' }, { capabilities: {} });

      try {
        await client.connect(transport);

        const signals = (await client.callTool({
          name: 'MeetingSignals-Extractor',
          arguments: {
            text: 'Action item: update runbook',
            tenantId: 'missing-tenant'
          }
        })) as ToolCallResult;

        expect(signals.structuredContent).toEqual({
          ok: true,
          result: {
            tenantId: 'missing-tenant',
            signals: [
              {
                type: 'ActionItem',
                confidence: 'high',
                text: 'Action item: update runbook',
                sourceSpans: [{ kind: 'line-range', startLine: 1, endLine: 1 }]
              }
            ],
            suggestedActions: ['Assign each ActionItem an owner and due date.']
          }
        });

        const synthStories = (await client.callTool({
          name: 'UserStory-Synthesizer',
          arguments: {
            text: 'Users need to export reports.',
            tenantId: 'demo',
            mode: 'auto',
            maxItems: 5
          }
        })) as ToolCallResult;

        const structured = synthStories.structuredContent as { ok: boolean; result: { modeUsed: string; stories: unknown[] } };
        expect(structured.ok).toBe(true);
        expect(structured.result.modeUsed).toBe('deterministic');
        expect(Array.isArray(structured.result.stories)).toBe(true);
        expect(structured.result.stories.length).toBeGreaterThan(0);
      } finally {
        await transport.close();
      }
    }
  );
});
