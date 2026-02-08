import { createOpenAiLlmAdapter } from '../../../../../src/shared/infrastructure/ai/adapters/openai-llm.adapter';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

describe('OpenAiLlmAdapter (Error Branches)', () => {
  it('should omit provider suffix when error payload is not an object', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => 'plain-text-error',
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.test',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 100,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('OpenAI request failed with status 400 for model gpt-4o-mini at https://api.test/v1/chat/completions');
  });

  it('should use top-level provider message when nested error.message is absent', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'endpoint not found' }),
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.test',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 100,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('endpoint not found');
  });

  it('should omit provider suffix when payload is object without usable messages', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: '' }),
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.test',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 100,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('OpenAI request failed with status 422 for model gpt-4o-mini at https://api.test/v1/chat/completions');
  });

  it('should omit provider suffix when parsing error payload throws', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('invalid json');
      },
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.test',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 100,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('OpenAI request failed with status 500 for model gpt-4o-mini at https://api.test/v1/chat/completions');
  });
});
