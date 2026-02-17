import { afterEach, describe, expect, it } from 'vitest';

import { getChatCompletionsConfigFromEnv } from '../src/llm/chatCompletions.js';

afterEach(() => {
  delete process.env.LLM_CHAT_COMPLETIONS_URL;
  delete process.env.LLM_AUTH_MODE;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_EXTRA_HEADERS_JSON;
});

describe('chatCompletions config validation', () => {
  it('throws for invalid LLM_AUTH_MODE', () => {
    process.env.LLM_CHAT_COMPLETIONS_URL = 'https://example.invalid/v1/chat/completions';
    process.env.LLM_AUTH_MODE = 'token';

    expect(() => getChatCompletionsConfigFromEnv()).toThrow('Invalid LLM_AUTH_MODE: token');
  });

  it('throws when LLM_EXTRA_HEADERS_JSON is not an object', () => {
    process.env.LLM_CHAT_COMPLETIONS_URL = 'https://example.invalid/v1/chat/completions';
    process.env.LLM_EXTRA_HEADERS_JSON = '["x"]';

    expect(() => getChatCompletionsConfigFromEnv()).toThrow('Invalid LLM_EXTRA_HEADERS_JSON: must be a JSON object of string:string pairs');
  });

  it('throws when LLM_EXTRA_HEADERS_JSON has non-string values', () => {
    process.env.LLM_CHAT_COMPLETIONS_URL = 'https://example.invalid/v1/chat/completions';
    process.env.LLM_EXTRA_HEADERS_JSON = '{"x-test": 123}';

    expect(() => getChatCompletionsConfigFromEnv()).toThrow('Invalid LLM_EXTRA_HEADERS_JSON: header value for "x-test" must be a string');
  });

  it('accepts valid auth mode and string-valued extra headers', () => {
    process.env.LLM_CHAT_COMPLETIONS_URL = 'https://example.invalid/v1/chat/completions';
    process.env.LLM_AUTH_MODE = 'api-key';
    process.env.LLM_EXTRA_HEADERS_JSON = '{"x-test": "abc"}';

    const config = getChatCompletionsConfigFromEnv();
    expect(config).toBeDefined();
    expect(config?.authMode).toBe('api-key');
    expect(config?.extraHeaders).toEqual({ 'x-test': 'abc' });
  });
});
