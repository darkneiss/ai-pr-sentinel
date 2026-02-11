import { createGroqLlmAdapter } from '../../../../../src/shared/infrastructure/ai/adapters/groq-llm.adapter';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

describe('GroqLlmAdapter (JSON Mode Fallback)', () => {
  it('should retry without response_format when Groq rejects structured output', async () => {
    // Arrange
    const fetchFn = jest
      .fn<Promise<MockFetchResponse>, [string, RequestInit?]>()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Failed to validate JSON. Please adjust your prompt.',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"classification":{"type":"question"}}' } }],
        }),
      });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'openai/gpt-oss-20b',
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act
    const result = await adapter.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 120,
      timeoutMs: 5000,
    });

    // Assert
    expect(result).toEqual({ rawText: '{"classification":{"type":"question"}}' });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const firstCallBody = fetchFn.mock.calls[0]?.[1]?.body as string;
    const secondCallBody = fetchFn.mock.calls[1]?.[1]?.body as string;
    expect(firstCallBody).toContain('"response_format":{"type":"json_schema"');
    expect(secondCallBody).not.toContain('"response_format"');
  });

  it('should log when retrying without structured output if raw response logging is enabled', async () => {
    // Arrange
    const fetchFn = jest
      .fn<Promise<MockFetchResponse>, [string, RequestInit?]>()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Failed to validate JSON. Please adjust your prompt.',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"classification":{"type":"question"}}' } }],
        }),
      });
    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    const config = {
      get: (_key: string) => undefined,
      getBoolean: (key: string) => (key === 'LLM_LOG_RAW_RESPONSE' ? true : undefined),
    };
    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'openai/gpt-oss-20b',
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      fetchFn: fetchFn as unknown as typeof fetch,
      config,
    });

    try {
      // Act
      await adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      });

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        'Groq retrying without structured output.',
        expect.objectContaining({
          endpoint: 'https://api.groq.com/openai/v1/chat/completions',
          model: 'openai/gpt-oss-20b',
        }),
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('should throw when retry without response_format also fails', async () => {
    // Arrange
    const fetchFn = jest
      .fn<Promise<MockFetchResponse>, [string, RequestInit?]>()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Failed to validate JSON. Please adjust your prompt.',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: 'rate limit exceeded',
          },
        }),
      });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'openai/gpt-oss-20b',
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(
      'Groq request failed with status 429 for model openai/gpt-oss-20b at https://api.groq.com/openai/v1/chat/completions: rate limit exceeded',
    );
  });

  it('should throw when retry succeeds but still returns empty content', async () => {
    // Arrange
    const fetchFn = jest
      .fn<Promise<MockFetchResponse>, [string, RequestInit?]>()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Failed to validate JSON. Please adjust your prompt.',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: null } }],
        }),
      });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'openai/gpt-oss-20b',
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(
      'Groq response did not include text content for model openai/gpt-oss-20b at https://api.groq.com/openai/v1/chat/completions',
    );
  });
});
