import { describe, expect, it } from 'vitest';

import {
  expectedToolNames,
  loadDemoInputs,
  readGolden,
  startHttpServerAndConnectClient,
  type ToolCallResult
} from './helpers.js';

describe('MCP e2e (Streamable HTTP transport)', () => {
  it(
    'starts HTTP server, lists tools, and calls extractors',
    { timeout: 45_000 },
    async () => {
      const repoRoot = process.cwd();
      const { text, plainText, tenantId } = await loadDemoInputs(repoRoot);

      const { client, transport, stop } = await startHttpServerAndConnectClient({
        repoRoot,
        clientName: 'meetings-mcp-e2e-http'
      });

      try {
        const tools = await client.listTools();
        const names = tools.tools.map(t => t.name).sort();
        expect(names).toEqual(expectedToolNames);

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
        await transport.close();
        stop();
      }
    }
  );
});
