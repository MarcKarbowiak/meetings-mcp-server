import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

type DemoToolResult = {
  structuredContent?: unknown;
  isError?: boolean;
};

function pickStructured(result: DemoToolResult): unknown {
  if (result && typeof result === 'object' && 'structuredContent' in result && result.structuredContent != null) {
    return result.structuredContent;
  }
  return result;
}

function waitForPattern(params: { getText: () => string; pattern: RegExp; timeoutMs: number }): Promise<void> {
  const { getText, pattern, timeoutMs } = params;

  if (pattern.test(getText())) {
    return Promise.resolve();
  }

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

async function main() {
  const repoRoot = process.cwd();
  const port = 3100;
  const url = new URL(`http://127.0.0.1:${port}/mcp`);

  const samplePath = join(repoRoot, 'examples', 'inputs', 'sample-notes.txt');
  const text = await readFile(samplePath, 'utf8');

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
    process.stdout.write(chunk);
  });

  serverProcess.stderr.on('data', chunk => {
    serverStderr += chunk;
    process.stderr.write(chunk);
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

    const client = new Client({ name: 'meetings-mcp-demo-http-client', version: '0.1.0' }, { capabilities: {} });

    try {
      await client.connect(transport);

      const tools = await client.listTools();
      console.log(JSON.stringify({ tools: tools.tools.map(t => t.name) }, null, 2));

      const tenantId = 'demo';

      const userStories = await client.callTool({
        name: 'UserStory-Extractor',
        arguments: { text, tenantId }
      });

      const gherkin = await client.callTool({
        name: 'Gherkin-Extractor',
        arguments: { text, tenantId }
      });

      const signals = await client.callTool({
        name: 'MeetingSignals-Extractor',
        arguments: { text, tenantId }
      });

      console.log(
        JSON.stringify(
          {
            input: { samplePath, tenantId, url: url.toString() },
            results: {
              userStories: pickStructured(userStories as DemoToolResult),
              gherkin: pickStructured(gherkin as DemoToolResult),
              signals: pickStructured(signals as DemoToolResult)
            }
          },
          null,
          2
        )
      );
    } finally {
      await transport.close().catch(() => undefined);
    }
  } finally {
    serverProcess.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
