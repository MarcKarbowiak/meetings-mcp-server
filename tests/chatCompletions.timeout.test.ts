import { afterEach, describe, expect, it, vi } from 'vitest';

import { callChatCompletions } from '../src/llm/chatCompletions.js';

describe('chatCompletions timeout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LLM_TIMEOUT_MS;
  });

  it('throws a clear timeout error when request exceeds LLM_TIMEOUT_MS', async () => {
    process.env.LLM_TIMEOUT_MS = '5';

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      ((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;

          if (signal.aborted) {
            reject(new Error('aborted'));
            return;
          }

          signal.addEventListener(
            'abort',
            () => {
              reject(new Error('aborted'));
            },
            { once: true }
          );
        })) as typeof fetch
    );

    await expect(
      callChatCompletions(
        {
          url: 'https://example.invalid/v1/chat/completions',
          authMode: 'none'
        },
        {
          system: 'system prompt',
          user: 'user prompt'
        }
      )
    ).rejects.toThrow('LLM request timed out after 5ms');
  });
});
