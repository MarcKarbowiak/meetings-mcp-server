import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';

type ToolCallResult = {
  structuredContent?: unknown;
};

async function readGolden(repoRoot: string, filename: string): Promise<unknown> {
  const raw = await readFile(join(repoRoot, 'tests', 'golden', filename), 'utf8');
  return JSON.parse(raw) as unknown;
}

describe('MCP e2e (stdio transport)', () => {
  it(
    'lists tools and calls extractors',
    { timeout: 30_000 },
    async () => {
      const repoRoot = process.cwd();
      const samplePath = join(repoRoot, 'examples', 'inputs', 'sample-notes.txt');
      const text = await readFile(samplePath, 'utf8');
      const plainPath = join(repoRoot, 'examples', 'inputs', 'plain-transcript.txt');
      const plainText = await readFile(plainPath, 'utf8');
      const tenantId = 'demo';

      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [join(repoRoot, 'dist', 'entrypoints', 'stdio.js')],
        cwd: repoRoot,
        stderr: 'inherit'
      });

      const client = new Client({ name: 'meetings-mcp-e2e-stdio', version: '0.1.0' }, { capabilities: {} });

      try {
        await client.connect(transport);

        const tools = await client.listTools();
        const names = tools.tools.map(t => t.name).sort();
        expect(names).toEqual(
          ['Gherkin-Extractor', 'MeetingSignals-Extractor', 'UserStory-Extractor', 'UserStory-Synthesizer', 'Gherkin-Synthesizer'].sort()
        );

        const expectedUserStories = await readGolden(repoRoot, 'userStories.sample-notes.json');
        const expectedGherkin = await readGolden(repoRoot, 'gherkin.sample-notes.json');
        const expectedSignals = await readGolden(repoRoot, 'signals.sample-notes.json');
        const expectedSynthStories = await readGolden(repoRoot, 'userStories.plain-transcript.synth.json');
        const expectedSynthGherkin = await readGolden(repoRoot, 'gherkin.plain-transcript.synth.json');

        const userStories = (await client.callTool({
          name: 'UserStory-Extractor',
          arguments: { text, tenantId }
        })) as ToolCallResult;

        const gherkin = (await client.callTool({
          name: 'Gherkin-Extractor',
          arguments: { text, tenantId }
        })) as ToolCallResult;

        const signals = (await client.callTool({
          name: 'MeetingSignals-Extractor',
          arguments: { text, tenantId }
        })) as ToolCallResult;

        const synthStories = (await client.callTool({
          name: 'UserStory-Synthesizer',
          arguments: { text: plainText, tenantId, mode: 'deterministic', maxItems: 10 }
        })) as ToolCallResult;

        const synthGherkin = (await client.callTool({
          name: 'Gherkin-Synthesizer',
          arguments: { text: plainText, tenantId, mode: 'deterministic', maxItems: 10 }
        })) as ToolCallResult;

        expect(userStories.structuredContent).toEqual({ ok: true, result: expectedUserStories });
        expect(gherkin.structuredContent).toEqual({ ok: true, result: expectedGherkin });
        expect(signals.structuredContent).toEqual({ ok: true, result: expectedSignals });
        expect(synthStories.structuredContent).toEqual({ ok: true, result: expectedSynthStories });
        expect(synthGherkin.structuredContent).toEqual({ ok: true, result: expectedSynthGherkin });
      } finally {
        await transport.close().catch(() => undefined);
      }
    }
  );
});
