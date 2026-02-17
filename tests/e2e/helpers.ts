import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export type ToolCallResult = {
  structuredContent?: unknown;
};

export const expectedToolNames = [
  'Gherkin-Extractor',
  'MeetingSignals-Extractor',
  'UserStory-Extractor',
  'UserStory-Synthesizer',
  'Gherkin-Synthesizer'
].sort();

export async function readGolden(repoRoot: string, filename: string): Promise<unknown> {
  const raw = await readFile(join(repoRoot, 'tests', 'golden', filename), 'utf8');
  return JSON.parse(raw) as unknown;
}

export async function loadDemoInputs(repoRoot: string): Promise<{ text: string; plainText: string; tenantId: string }> {
  const samplePath = join(repoRoot, 'examples', 'inputs', 'sample-notes.txt');
  const text = await readFile(samplePath, 'utf8');
  const plainPath = join(repoRoot, 'examples', 'inputs', 'plain-transcript.txt');
  const plainText = await readFile(plainPath, 'utf8');
  return { text, plainText, tenantId: 'demo' };
}

export async function connectStdioClient(params: {
  repoRoot: string;
  clientName: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ client: Client; transport: StdioClientTransport }> {
  const normalizedEnv = params.env
    ? Object.fromEntries(Object.entries(params.env).filter((entry): entry is [string, string] => entry[1] !== undefined))
    : undefined;

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(params.repoRoot, 'dist', 'entrypoints', 'stdio.js')],
    cwd: params.repoRoot,
    stderr: 'inherit',
    ...(normalizedEnv ? { env: normalizedEnv } : {})
  });

  const client = new Client({ name: params.clientName, version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);

  return { client, transport };
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

export async function startHttpServerAndConnectClient(params: {
  repoRoot: string;
  clientName: string;
}): Promise<{ client: Client; transport: StreamableHTTPClientTransport; stop: () => void }> {
  const port = await getFreePort();
  const url = new URL(`http://127.0.0.1:${port}/mcp`);

  let serverStdout = '';
  let serverStderr = '';

  const serverProcess = spawn(process.execPath, [join(params.repoRoot, 'dist', 'entrypoints', 'http.js')], {
    cwd: params.repoRoot,
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

  const client = new Client({ name: params.clientName, version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);

  return {
    client,
    transport,
    stop: () => {
      serverProcess.kill();
    }
  };
}
