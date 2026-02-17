import { afterEach, describe, expect, it, vi } from 'vitest';

import { callChatCompletions } from '../src/llm/chatCompletions.js';

describe('chatCompletions timeout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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

  it('falls back to default timeout (20000ms) when LLM_TIMEOUT_MS is invalid', async () => {
    process.env.LLM_TIMEOUT_MS = 'not-a-number';
    vi.useFakeTimers();

    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      ((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;

          signal.addEventListener(
            'abort',
            () => {
              reject(new Error('aborted'));
            },
            { once: true }
          );
        })) as typeof fetch
    );

    const promise = callChatCompletions(
      {
        url: 'https://example.invalid/v1/chat/completions',
        authMode: 'none'
      },
      {
        system: 'system prompt',
        user: 'user prompt'
      }
    );

    const assertion = expect(promise).rejects.toThrow('LLM request timed out after 20000ms');
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;

    expect(timeoutSpy).toHaveBeenCalled();
    expect(timeoutSpy.mock.calls[0]?.[1]).toBe(20_000);
    vi.useRealTimers();
  });

  it('falls back to default timeout (20000ms) when LLM_TIMEOUT_MS is non-positive', async () => {
    process.env.LLM_TIMEOUT_MS = '0';
    vi.useFakeTimers();

    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      ((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;

          signal.addEventListener(
            'abort',
            () => {
              reject(new Error('aborted'));
            },
            { once: true }
          );
        })) as typeof fetch
    );

    const promise = callChatCompletions(
      {
        url: 'https://example.invalid/v1/chat/completions',
        authMode: 'none'
      },
      {
        system: 'system prompt',
        user: 'user prompt'
      }
    );

    const assertion = expect(promise).rejects.toThrow('LLM request timed out after 20000ms');
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;

    expect(timeoutSpy).toHaveBeenCalled();
    expect(timeoutSpy.mock.calls[0]?.[1]).toBe(20_000);
    vi.useRealTimers();
  });
});
