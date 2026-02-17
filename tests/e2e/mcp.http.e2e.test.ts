import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { describe, expect, it } from 'vitest';

type ToolCallResult = {
  structuredContent?: unknown;
};

async function readGolden(repoRoot: string, filename: string): Promise<unknown> {
  const raw = await readFile(join(repoRoot, 'tests', 'golden', filename), 'utf8');
  return JSON.parse(raw) as unknown;
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

describe('MCP e2e (Streamable HTTP transport)', () => {
  it(
    'starts HTTP server, lists tools, and calls extractors',
    { timeout: 45_000 },
    async () => {
      const repoRoot = process.cwd();
      const port = await getFreePort();
      const url = new URL(`http://127.0.0.1:${port}/mcp`);

      const samplePath = join(repoRoot, 'examples', 'inputs', 'sample-notes.txt');
      const text = await readFile(samplePath, 'utf8');
      const plainPath = join(repoRoot, 'examples', 'inputs', 'plain-transcript.txt');
      const plainText = await readFile(plainPath, 'utf8');
      const tenantId = 'demo';

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

        const client = new Client({ name: 'meetings-mcp-e2e-http', version: '0.1.0' }, { capabilities: {} });

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
      } finally {
        serverProcess.kill();
      }
    }
  );
});
