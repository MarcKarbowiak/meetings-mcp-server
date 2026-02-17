import * as z from 'zod/v4';

export type ChatCompletionsConfig = {
  // Full URL to a chat-completions endpoint (OpenAI-compatible).
  // Examples:
  // - OpenAI: https://api.openai.com/v1/chat/completions
  // - Azure OpenAI: https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version=...
  url: string;
  apiKey?: string;
  authMode?: 'bearer' | 'api-key' | 'none';
  model?: string;
  extraHeaders?: Record<string, string>;
};

const ChatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional()
        })
      })
    )
    .min(1)
});

export function getChatCompletionsConfigFromEnv(): ChatCompletionsConfig | undefined {
  const url = process.env.LLM_CHAT_COMPLETIONS_URL;
  if (!url) return undefined;

  const apiKey = process.env.LLM_API_KEY;
  const authMode = (process.env.LLM_AUTH_MODE as ChatCompletionsConfig['authMode']) ?? 'bearer';
  const model = process.env.LLM_MODEL;

  let extraHeaders: Record<string, string> | undefined;
  const headersRaw = process.env.LLM_EXTRA_HEADERS_JSON;
  if (headersRaw) {
    try {
      extraHeaders = JSON.parse(headersRaw) as Record<string, string>;
    } catch {
      // ignore
    }
  }

  return { url, apiKey, authMode, model, extraHeaders };
}

export async function callChatCompletions(config: ChatCompletionsConfig, params: { system: string; user: string }): Promise<string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(config.extraHeaders ?? {})
  };

  if (config.authMode !== 'none') {
    if (!config.apiKey) throw new Error('LLM apiKey is required for this authMode');
    if (config.authMode === 'bearer') headers.authorization = `Bearer ${config.apiKey}`;
    if (config.authMode === 'api-key') headers['api-key'] = config.apiKey;
  }

  const body: Record<string, unknown> = {
    temperature: 0,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user }
    ]
  };
  if (config.model) body.model = config.model;

  const res = await fetch(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM request failed: ${res.status} ${res.statusText}\n${text}`);
  }

  const json = (await res.json()) as unknown;
  const parsed = ChatCompletionResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error('LLM response did not match expected chat-completions shape');
  }

  const content = parsed.data.choices[0]?.message.content;
  if (!content) throw new Error('LLM response content was empty');
  return content;
}
