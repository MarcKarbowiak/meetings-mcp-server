import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { describe, expect, it } from 'vitest';

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
}

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('Failed to acquire a free port'));
      });
    });
  });
}

function waitForPattern(params: { getText: () => string; pattern: RegExp; timeoutMs: number }): Promise<void> {
  const { getText, pattern, timeoutMs } = params;
  if (pattern.test(getText())) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for pattern: ${pattern}`)), timeoutMs);
    timeout.unref?.();

    const interval = setInterval(() => {
      if (pattern.test(getText())) {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve();
      }
    }, 25);
    interval.unref?.();
  });
}

describe('MCP e2e (Streamable HTTP) resources + prompts', () => {
  it(
    'lists and reads tenant resources; lists and gets prompts',
    { timeout: 45_000 },
    async () => {
      const repoRoot = process.cwd();
      const tenantId = 'demo';
      const port = await getFreePort();
      const url = new URL(`http://127.0.0.1:${port}/mcp`);

      let serverStdout = '';
      let serverStderr = '';

      const serverProcess = spawn(process.execPath, [join(repoRoot, 'dist', 'entrypoints', 'http.js')], {
        cwd: repoRoot,
        env: {
          ...process.env,
          MCP_PORT: String(port)
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      serverProcess.stdout.setEncoding('utf8');
      serverProcess.stderr.setEncoding('utf8');

      serverProcess.stdout.on('data', chunk => {
        serverStdout += chunk;
      });

      serverProcess.stderr.on('data', chunk => {
        serverStderr += chunk;
      });

      const exitPromise = new Promise<never>((_, reject) => {
        serverProcess.once('exit', (code, signal) => {
          reject(
            new Error(
              `HTTP server exited early (code=${code}, signal=${signal}).\nSTDOUT:\n${serverStdout}\nSTDERR:\n${serverStderr}`
            )
          );
        });
      });

      try {
        await Promise.race([
          waitForPattern({
            getText: () => serverStdout,
            pattern: /listening on http:\/\/127\.0\.0\.1:/i,
            timeoutMs: 10_000
          }),
          exitPromise
        ]);

        const transport = new StreamableHTTPClientTransport(url, {
          requestInit: {
            headers: {
              'content-type': 'application/json'
            }
          }
        });

        const client = new Client({ name: 'meetings-mcp-e2e-http-resources', version: '0.1.0' }, { capabilities: {} });

        try {
          await client.connect(transport);

          const resources = await client.listResources();
          const uris = resources.resources.map(r => r.uri);
          expect(uris).toContain(`tenant://${tenantId}/guidance`);
          expect(uris).toContain(`tenant://${tenantId}/signals`);
          expect(uris).toContain('knowledge://user-story-structure');
          expect(uris).toContain('knowledge://gherkin-structure');
          expect(uris).toContain('knowledge://mapping-guidelines');

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

          const userStoryStructureExpected = normalizeText(
            await readFile(join(repoRoot, 'data', 'knowledge', 'user-story-structure.md'), 'utf8')
          );
          const userStoryStructure = await client.readResource({ uri: 'knowledge://user-story-structure' });
          expect(userStoryStructure.contents.length).toBeGreaterThan(0);
          const userStoryStructureText = (userStoryStructure.contents[0] as { text?: string }).text ?? '';
          expect(normalizeText(userStoryStructureText)).toEqual(userStoryStructureExpected);

          const gherkinStructureExpected = normalizeText(
            await readFile(join(repoRoot, 'data', 'knowledge', 'gherkin-structure.md'), 'utf8')
          );
          const gherkinStructure = await client.readResource({ uri: 'knowledge://gherkin-structure' });
          expect(gherkinStructure.contents.length).toBeGreaterThan(0);
          const gherkinStructureText = (gherkinStructure.contents[0] as { text?: string }).text ?? '';
          expect(normalizeText(gherkinStructureText)).toEqual(gherkinStructureExpected);

          const mappingGuidelinesExpected = normalizeText(
            await readFile(join(repoRoot, 'data', 'knowledge', 'mapping-guidelines.md'), 'utf8')
          );
          const mappingGuidelines = await client.readResource({ uri: 'knowledge://mapping-guidelines' });
          expect(mappingGuidelines.contents.length).toBeGreaterThan(0);
          const mappingGuidelinesText = (mappingGuidelines.contents[0] as { text?: string }).text ?? '';
          expect(normalizeText(mappingGuidelinesText)).toEqual(mappingGuidelinesExpected);

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
      } finally {
        serverProcess.kill();
      }
    }
  );
});
