import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
}

describe('MCP e2e (stdio) resources + prompts', () => {
  it(
    'lists and reads tenant resources; lists and gets prompts',
    { timeout: 30_000 },
    async () => {
      const repoRoot = process.cwd();
      const tenantId = 'demo';

      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [join(repoRoot, 'dist', 'entrypoints', 'stdio.js')],
        cwd: repoRoot,
        stderr: 'inherit'
      });

      const client = new Client({ name: 'meetings-mcp-e2e-stdio-resources', version: '0.1.0' }, { capabilities: {} });

      try {
        await client.connect(transport);

        const resources = await client.listResources();
        const uris = resources.resources.map(r => r.uri);
        expect(uris).toContain(`tenant://${tenantId}/guidance`);
        expect(uris).toContain(`tenant://${tenantId}/signals`);

        const guidanceExpected = normalizeText(
          await readFile(join(repoRoot, 'data', 'tenants', tenantId, 'guidance.md'), 'utf8')
        );
        const guidance = await client.readResource({ uri: `tenant://${tenantId}/guidance` });
        expect(guidance.contents.length).toBeGreaterThan(0);
        const guidanceText = (guidance.contents[0] as { text?: string }).text ?? '';
        expect(normalizeText(guidanceText)).toEqual(guidanceExpected);

        const signalsExpectedRaw = await readFile(join(repoRoot, 'data', 'tenants', tenantId, 'signals.json'), 'utf8');
        const signalsExpected = JSON.parse(signalsExpectedRaw) as unknown;
        const signals = await client.readResource({ uri: `tenant://${tenantId}/signals` });
        expect(signals.contents.length).toBeGreaterThan(0);
        const signalsText = (signals.contents[0] as { text?: string }).text ?? '';
        expect(JSON.parse(signalsText)).toEqual(signalsExpected);

        const prompts = await client.listPrompts();
        const promptNames = prompts.prompts.map(p => p.name).sort();
        expect(promptNames).toEqual(['extract-gherkin', 'extract-user-stories'].sort());

        const samplePath = join(repoRoot, 'examples', 'inputs', 'sample-notes.txt');
        const sampleText = await readFile(samplePath, 'utf8');
        const sampleSentinel = 'Decision: Use stdio as the default transport.';

        const userStoryPrompt = await client.getPrompt({
          name: 'extract-user-stories',
          arguments: { text: sampleText, tenantId }
        });
        expect(userStoryPrompt.messages.length).toBeGreaterThan(0);
        const userStoryMsgText = (userStoryPrompt.messages[0]?.content as { text?: string }).text ?? '';
        expect(userStoryMsgText).toContain('Extract user stories');
        expect(userStoryMsgText).toContain(`Tenant: ${tenantId}`);
        expect(userStoryMsgText).toContain('TEXT:');
        expect(userStoryMsgText).toContain(sampleSentinel);

        const gherkinPrompt = await client.getPrompt({
          name: 'extract-gherkin',
          arguments: { text: sampleText, tenantId }
        });
        expect(gherkinPrompt.messages.length).toBeGreaterThan(0);
        const gherkinMsgText = (gherkinPrompt.messages[0]?.content as { text?: string }).text ?? '';
        expect(gherkinMsgText).toContain('Extract Gherkin');
        expect(gherkinMsgText).toContain(`Tenant: ${tenantId}`);
        expect(gherkinMsgText).toContain('TEXT:');
        expect(gherkinMsgText).toContain(sampleSentinel);
      } finally {
        await transport.close().catch(() => undefined);
      }
    }
  );
});
