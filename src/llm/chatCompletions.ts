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

function getLlmTimeoutMs(): number {
  const raw = process.env.LLM_TIMEOUT_MS;
  if (!raw) return 20_000;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20_000;
  return parsed;
}

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
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid LLM_EXTRA_HEADERS_JSON: ${reason}`);
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

  const timeoutMs = getLlmTimeoutMs();
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: abortController.signal
    });
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error(`LLM request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!res.ok) {
    let text = '';
    try {
      text = await res.text();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      text = `[failed to read error response body: ${reason}]`;
    }
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
