import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

type DemoToolResult = {
  content?: unknown;
  structuredContent?: unknown;
  isError?: boolean;
};

function pickStructured(result: DemoToolResult): unknown {
  if (result && typeof result === 'object' && 'structuredContent' in result && result.structuredContent != null) {
    return result.structuredContent;
  }
  return result;
}

async function main() {
  const repoRoot = process.cwd();
  const samplePath = join(repoRoot, 'examples', 'inputs', 'sample-notes.txt');
  const text = await readFile(samplePath, 'utf8');

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(repoRoot, 'dist', 'entrypoints', 'stdio.js')],
    cwd: repoRoot,
    stderr: 'inherit'
  });

  const client = new Client({ name: 'meetings-mcp-demo-client', version: '0.1.0' }, { capabilities: {} });

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
          input: { samplePath, tenantId },
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
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
