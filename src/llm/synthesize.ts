import * as z from 'zod/v4';

import type { GherkinSynthesisResult, UserStorySynthesisResult } from '../core/types.js';
import type { ChatCompletionsConfig } from './chatCompletions.js';
import { callChatCompletions } from './chatCompletions.js';
import { GherkinSynthesisResultSchema, UserStorySynthesisResultSchema } from './synthesisSchemas.js';

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return JSON.parse(trimmed) as unknown;
  }

  // Attempt to recover JSON from fenced blocks.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) return JSON.parse(fenceMatch[1]) as unknown;
  throw new Error('LLM did not return a JSON object');
}

async function callAndParse<T>(params: {
  config: ChatCompletionsConfig;
  system: string;
  user: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const content = await callChatCompletions(params.config, { system: params.system, user: params.user });
  const json = extractJsonObject(content);
  return params.schema.parse(json);
}

export async function synthesizeUserStoriesWithLlm(params: {
  config: ChatCompletionsConfig;
  tenantId?: string;
  text: string;
  knowledge?: { userStory: string; gherkin: string; mapping: string };
}): Promise<UserStorySynthesisResult> {
  const system =
    'You convert meeting transcripts into user stories. Return ONLY valid JSON. ' +
    'Do not include commentary, markdown, or extra keys.' +
    (params.knowledge
      ? '\n\nKNOWLEDGE (follow these guidelines):\n' +
        '--- USER STORY STRUCTURE ---\n' +
        params.knowledge.userStory +
        '\n\n--- MAPPING GUIDELINES ---\n' +
        params.knowledge.mapping
      : '');

  const user =
    'Extract proposed user stories from the meeting text.\n' +
    'Rules:\n' +
    '- Prefer: As a <persona> I want <capability> so that <value>\n' +
    '- Include 2-5 acceptanceCriteria per story\n' +
    '- Every story MUST include evidence with quote + sourceSpans (line numbers).\n' +
    '- If uncertain, set confidence=low and add followUpQuestions.\n' +
    (params.tenantId ? `Tenant: ${params.tenantId}\n` : '') +
    '\nTEXT (line-broken):\n' +
    params.text;

  const parsed = await callAndParse({
    config: params.config,
    system,
    user,
    schema: UserStorySynthesisResultSchema
  });

  return {
    tenantId: params.tenantId,
    modeUsed: 'llm',
    stories: parsed.stories,
    gaps: parsed.gaps,
    followUpQuestions: parsed.followUpQuestions
  };
}

export async function synthesizeGherkinWithLlm(params: {
  config: ChatCompletionsConfig;
  tenantId?: string;
  text: string;
  knowledge?: { userStory: string; gherkin: string; mapping: string };
}): Promise<GherkinSynthesisResult> {
  const system =
    'You convert meeting transcripts into Gherkin scenarios. Return ONLY valid JSON.' +
    (params.knowledge
      ? '\n\nKNOWLEDGE (follow these guidelines):\n' +
        '--- GHERKIN STRUCTURE ---\n' +
        params.knowledge.gherkin +
        '\n\n--- MAPPING GUIDELINES ---\n' +
        params.knowledge.mapping
      : '');

  const user =
    'Extract proposed Gherkin features and scenarios from the meeting text.\n' +
    'Rules:\n' +
    '- Each scenario MUST include given/when/then arrays (can be short)\n' +
    '- Every scenario MUST include evidence with quote + sourceSpans (line numbers).\n' +
    '- If uncertain, set confidence=low and add followUpQuestions.\n' +
    (params.tenantId ? `Tenant: ${params.tenantId}\n` : '') +
    '\nTEXT (line-broken):\n' +
    params.text;

  const parsed = await callAndParse({
    config: params.config,
    system,
    user,
    schema: GherkinSynthesisResultSchema
  });

  return {
    tenantId: params.tenantId,
    modeUsed: 'llm',
    features: parsed.features,
    gaps: parsed.gaps,
    followUpQuestions: parsed.followUpQuestions
  };
}
