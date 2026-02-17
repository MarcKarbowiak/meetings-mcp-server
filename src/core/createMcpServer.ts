import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { extractGherkin } from './extractors/gherkinExtractor.js';
import {
  compileMeetingSignalRulesFromTenantSignalsJson,
  extractMeetingSignals
} from './extractors/meetingSignalsExtractor.js';
import { extractUserStories } from './extractors/userStoryExtractor.js';
import { mineRequirementsDeterministic } from './synthesizers/requirementMiner.js';
import { synthesizeGherkinDeterministic } from './synthesizers/gherkinSynthesizer.js';
import { synthesizeUserStoriesDeterministic } from './synthesizers/userStorySynthesizer.js';
import { KnowledgeStore } from './knowledgeStore.js';
import { TenantStore } from './tenantStore.js';
import { getChatCompletionsConfigFromEnv } from '../llm/chatCompletions.js';
import { synthesizeGherkinWithLlm, synthesizeUserStoriesWithLlm } from '../llm/synthesize.js';

const ToolTextResultSchema = z.object({ ok: z.boolean(), result: z.unknown() });

function normalizeTemplateVar(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

function toolTextResponse(params: { ok: boolean; result: unknown }): {
  content: { type: 'text'; text: string }[];
  structuredContent: { ok: boolean; result: unknown };
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(params, null, 2) }],
    structuredContent: params
  };
}

export type CreateServerOptions = {
  tenantRootDir: string;
  knowledgeRootDir?: string;
  serverName?: string;
  serverVersion?: string;
};

export function createMeetingsMcpServer(options: CreateServerOptions): McpServer {
  const tenantStore = new TenantStore(options.tenantRootDir);
  const knowledgeStore = options.knowledgeRootDir ? new KnowledgeStore(options.knowledgeRootDir) : undefined;

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

  const synthInputSchema = z.object({
    text: z.string().describe('Meeting transcript or notes (plain English is fine)'),
    tenantId: z.string().optional().describe('Tenant ID (matches data/tenants/<tenantId>)'),
    mode: z
      .enum(['auto', 'deterministic', 'llm'])
      .optional()
      .describe('auto=use LLM if configured, else deterministic; deterministic=never call LLM; llm=require LLM'),
    maxItems: z.number().int().min(1).max(50).optional().describe('Max stories/scenarios to synthesize')
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
      return toolTextResponse({ ok: true, result });
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
      return toolTextResponse({ ok: true, result });
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
      let rules = undefined;
      if (tenantId) {
        try {
          const signals = await tenantStore.readSignals(tenantId);
          rules = compileMeetingSignalRulesFromTenantSignalsJson(signals.signalsJson);
        } catch {
          // Fall back to defaults if tenant config isn't present/readable.
        }
      }

      const result = extractMeetingSignals(text, tenantId, { rules });
      return toolTextResponse({ ok: true, result });
    }
  );

  server.registerTool(
    'UserStory-Synthesizer',
    {
      title: 'User Story Synthesizer',
      description:
        'Synthesizes user stories from plain-English meeting transcripts/notes. Uses an LLM if configured (optional) and falls back to deterministic mining.',
      inputSchema: synthInputSchema,
      outputSchema: ToolTextResultSchema
    },
    async ({ text, tenantId, mode, maxItems }) => {
      const m = mode ?? 'auto';
      const llmConfig = getChatCompletionsConfigFromEnv();

      if (m === 'llm' && !llmConfig) {
        const result = {
          tenantId,
          modeUsed: 'deterministic' as const,
          stories: [],
          gaps: ['LLM mode requested but LLM is not configured.'],
          followUpQuestions: ['Set LLM_CHAT_COMPLETIONS_URL and LLM_API_KEY (and optionally LLM_AUTH_MODE/LLM_MODEL).']
        };
        return toolTextResponse({ ok: false, result });
      }

      if ((m === 'auto' || m === 'llm') && llmConfig) {
        try {
          const knowledge = knowledgeStore ? await knowledgeStore.readAll().catch(() => undefined) : undefined;
          const result = await synthesizeUserStoriesWithLlm({ config: llmConfig, tenantId, text, knowledge });
          return toolTextResponse({ ok: true, result });
        } catch {
          // fall through to deterministic
        }
      }

      const mined = mineRequirementsDeterministic(text);
      const result = synthesizeUserStoriesDeterministic({ text, tenantId, requirements: mined.requirements, maxStories: maxItems });
      result.gaps.push(...mined.gaps);
      result.followUpQuestions.push(...mined.followUpQuestions);
      return toolTextResponse({ ok: true, result });
    }
  );

  server.registerTool(
    'Gherkin-Synthesizer',
    {
      title: 'Gherkin Synthesizer',
      description:
        'Synthesizes Gherkin-style features/scenarios from plain-English meeting transcripts/notes. Uses an LLM if configured (optional) and falls back to deterministic mining.',
      inputSchema: synthInputSchema,
      outputSchema: ToolTextResultSchema
    },
    async ({ text, tenantId, mode, maxItems }) => {
      const m = mode ?? 'auto';
      const llmConfig = getChatCompletionsConfigFromEnv();

      if (m === 'llm' && !llmConfig) {
        const result = {
          tenantId,
          modeUsed: 'deterministic' as const,
          features: [],
          gaps: ['LLM mode requested but LLM is not configured.'],
          followUpQuestions: ['Set LLM_CHAT_COMPLETIONS_URL and LLM_API_KEY (and optionally LLM_AUTH_MODE/LLM_MODEL).']
        };
        return toolTextResponse({ ok: false, result });
      }

      if ((m === 'auto' || m === 'llm') && llmConfig) {
        try {
          const knowledge = knowledgeStore ? await knowledgeStore.readAll().catch(() => undefined) : undefined;
          const result = await synthesizeGherkinWithLlm({ config: llmConfig, tenantId, text, knowledge });
          return toolTextResponse({ ok: true, result });
        } catch {
          // fall through to deterministic
        }
      }

      const mined = mineRequirementsDeterministic(text);
      const result = synthesizeGherkinDeterministic({ text, tenantId, requirements: mined.requirements, maxScenarios: maxItems });
      result.gaps.push(...mined.gaps);
      result.followUpQuestions.push(...mined.followUpQuestions);
      return toolTextResponse({ ok: true, result });
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
  // Resources (static knowledge)
  // -----------------

  if (knowledgeStore) {
    server.registerResource(
      'knowledge-docs',
      new ResourceTemplate('knowledge://{docId}', {
        list: async () => {
          const docs = knowledgeStore.listDocs();
          return {
            resources: docs.map(d => ({ uri: `knowledge://${d}`, name: `knowledge: ${d}` }))
          };
        }
      }),
      {
        title: 'Knowledge Docs',
        description: 'Static guidelines for user story structure, Gherkin structure, and mapping meeting text to artifacts.',
        mimeType: 'text/markdown'
      },
      async (uri, { docId }) => {
        const id = normalizeTemplateVar(docId) as 'user-story-structure' | 'gherkin-structure' | 'mapping-guidelines';
        const doc = await knowledgeStore.readDoc(id);
        return {
          contents: [{ uri: uri.href, text: doc.markdown }]
        };
      }
    );
  }

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
