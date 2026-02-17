import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import express from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createMeetingsMcpServer } from '../core/createMcpServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tenantRootDir = join(__dirname, '..', '..', 'data', 'tenants');

const port = process.env.MCP_PORT ? Number.parseInt(process.env.MCP_PORT, 10) : 3000;

async function main() {
  // NOTE: This entrypoint is intentionally "minimal".
  // - Binds to 127.0.0.1 for safety.
  // - Uses JSON response mode (no SSE), so it's easy to test with curl/Postman.
  // - No auth. If you expose beyond localhost, add auth + tenant isolation.

  const app = createMcpExpressApp({ host: '127.0.0.1' });
  app.use(express.json({ limit: '2mb' }));

  const server = createMeetingsMcpServer({ tenantRootDir });

  const transport = new StreamableHTTPServerTransport({
    // IMPORTANT: Streamable HTTP transports in *stateless* mode cannot be reused across requests.
    // Using a session ID enables reusing a single transport across the initialize + follow-up requests.
    sessionIdGenerator: randomUUID,
    enableJsonResponse: true
  });

  await server.connect(transport);

  app.post('/mcp', async (req, res) => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error handling /mcp request:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        });
      }
    }
  });

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`MCP Streamable HTTP (JSON response mode) listening on http://127.0.0.1:${port}/mcp`);
  });
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
