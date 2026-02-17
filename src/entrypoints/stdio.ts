import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createMeetingsMcpServer } from '../core/createMcpServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tenantRootDir = join(__dirname, '..', '..', 'data', 'tenants');

async function main() {
  const server = createMeetingsMcpServer({ tenantRootDir });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
