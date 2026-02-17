import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { extractGherkin } from './extractors/gherkinExtractor.js';
import { extractMeetingSignals } from './extractors/meetingSignalsExtractor.js';
import { extractUserStories } from './extractors/userStoryExtractor.js';
import { TenantStore } from './tenantStore.js';

const ToolTextResultSchema = z.object({ ok: z.boolean(), result: z.unknown() });

function normalizeTemplateVar(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

export type CreateServerOptions = {
  tenantRootDir: string;
  serverName?: string;
  serverVersion?: string;
};

export function createMeetingsMcpServer(options: CreateServerOptions): McpServer {
  const tenantStore = new TenantStore(options.tenantRootDir);

  const server = new McpServer(
    {
      name: options.serverName ?? 'meetings-mcp-server',
      version: options.serverVersion ?? '0.1.0'
    },
    {
      capabilities: {
        // Handy during dev; lets tool handlers emit structured logs to the client.
        logging: {}
      }
    }
  );

  // -----------------
  // Tools
  // -----------------

  const extractorInputSchema = z.object({
    text: z.string().describe('Transcript or notes content'),
    tenantId: z.string().optional().describe('Tenant ID (matches data/tenants/<tenantId>)')
  });

  server.registerTool(
    'UserStory-Extractor',
    {
      title: 'User Story Extractor',
      description: 'Extracts user stories (As a / I want / so that) and acceptance criteria from meeting transcripts or notes.',
      inputSchema: extractorInputSchema,
      outputSchema: ToolTextResultSchema
    },
    async ({ text, tenantId }) => {
      const result = extractUserStories(text, tenantId);
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, result }, null, 2) }],
        structuredContent: { ok: true, result }
      };
    }
  );

  server.registerTool(
    'Gherkin-Extractor',
    {
      title: 'Gherkin Extractor',
      description: 'Extracts Gherkin Features/Scenarios (Given/When/Then) from transcripts or notes that contain Gherkin-style text.',
      inputSchema: extractorInputSchema,
      outputSchema: ToolTextResultSchema
    },
    async ({ text, tenantId }) => {
      const result = extractGherkin(text, tenantId);
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, result }, null, 2) }],
        structuredContent: { ok: true, result }
      };
    }
  );

  server.registerTool(
    'MeetingSignals-Extractor',
    {
      title: 'Meeting Signals Extractor',
      description: 'Extracts meeting signals (Decision/ActionItem/Risk/Dependency/OpenQuestion) via deterministic keyword patterns.',
      inputSchema: extractorInputSchema,
      outputSchema: ToolTextResultSchema
    },
    async ({ text, tenantId }) => {
      const result = extractMeetingSignals(text, tenantId);
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, result }, null, 2) }],
        structuredContent: { ok: true, result }
      };
    }
  );

  // -----------------
  // Resources (tenant files)
  // -----------------

  server.registerResource(
    'tenant-guidance',
    new ResourceTemplate('tenant://{tenantId}/guidance', {
      list: async () => {
        const tenants = await tenantStore.listTenants();
        return {
          resources: tenants.map(t => ({ uri: `tenant://${t}/guidance`, name: `${t} guidance` }))
        };
      }
    }),
    {
      title: 'Tenant Guidance',
      description: 'Tenant-specific meeting guidance (how to capture, write, and structure notes/stories/scenarios).',
      mimeType: 'text/markdown'
    },
    async (uri, { tenantId }) => {
      const guidance = await tenantStore.readGuidance(normalizeTemplateVar(tenantId));
      return {
        contents: [{ uri: uri.href, text: guidance.guidanceMarkdown }]
      };
    }
  );

  server.registerResource(
    'tenant-signals',
    new ResourceTemplate('tenant://{tenantId}/signals', {
      list: async () => {
        const tenants = await tenantStore.listTenants();
        return {
          resources: tenants.map(t => ({ uri: `tenant://${t}/signals`, name: `${t} signals` }))
        };
      }
    }),
    {
      title: 'Tenant Signals Catalog',
      description: 'Tenant-specific signal taxonomy for what to capture/detect in meetings.',
      mimeType: 'application/json'
    },
    async (uri, { tenantId }) => {
      const signals = await tenantStore.readSignals(normalizeTemplateVar(tenantId));
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(signals.signalsJson, null, 2) }]
      };
    }
  );

  // -----------------
  // Prompts
  // -----------------

  server.registerPrompt(
    'extract-user-stories',
    {
      title: 'Extract User Stories',
      description: 'Prompt template to extract user stories from transcripts/notes.',
      argsSchema: { text: z.string(), tenantId: z.string().optional() }
    },
    ({ text, tenantId }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Extract user stories in the form "As a … I want … so that …" and acceptance criteria.\n` +
              `If information is missing, propose follow-up questions.\n` +
              (tenantId ? `Tenant: ${tenantId}\n` : '') +
              `\nTEXT:\n${text}`
          }
        }
      ]
    })
  );

  server.registerPrompt(
    'extract-gherkin',
    {
      title: 'Extract Gherkin',
      description: 'Prompt template to extract Features/Scenarios and Given/When/Then steps.',
      argsSchema: { text: z.string(), tenantId: z.string().optional() }
    },
    ({ text, tenantId }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Extract Gherkin Features and Scenarios. Preserve Given/When/Then steps.\n` +
              `If text is not in Gherkin form, suggest a cleaned-up Gherkin version.\n` +
              (tenantId ? `Tenant: ${tenantId}\n` : '') +
              `\nTEXT:\n${text}`
          }
        }
      ]
    })
  );

  return server;
}
