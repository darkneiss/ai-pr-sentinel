import { createOpenAiLlmAdapter } from '../../../../../src/shared/infrastructure/ai/adapters/openai-llm.adapter';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

describe('OpenAiLlmAdapter', () => {
  it('should call OpenAI chat completions and return raw text', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"classification":{}}' } }],
      }),
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model: 'gpt-4o-mini',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act
    const result = await adapter.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 100,
      timeoutMs: 5000,
      temperature: 0.1,
    });

    // Assert
    expect(result).toEqual({ rawText: '{"classification":{}}' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should throw when OpenAI returns non-ok response', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'invalid key' } }),
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'bad-key',
      model: 'gpt-4o-mini',
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
    ).rejects.toThrow('OpenAI request failed');
  });

  it('should throw when OpenAI response does not include message content', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: null } }],
      }),
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model: 'gpt-4o-mini',
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
    ).rejects.toThrow('OpenAI response did not include text content');
  });

  it('should throw when API key is missing', () => {
    // Arrange
    const previousValue = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      // Act + Assert
      expect(() => createOpenAiLlmAdapter()).toThrow(
        'Missing OpenAI API key. Provide "apiKey" or set OPENAI_API_KEY',
      );
    } finally {
      process.env.OPENAI_API_KEY = previousValue;
    }
  });

  it('should call fetch without signal when AbortSignal.timeout is unavailable', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{\"classification\":{}}' } }],
      }),
    });
    const originalAbortSignalTimeout = AbortSignal.timeout;
    (AbortSignal as unknown as { timeout?: unknown }).timeout = undefined;
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model: 'gpt-4o-mini',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    try {
      // Act
      await adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 100,
        timeoutMs: 5000,
      });
    } finally {
      (AbortSignal as unknown as { timeout?: typeof AbortSignal.timeout }).timeout =
        originalAbortSignalTimeout;
    }

    // Assert
    expect(fetchFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: undefined,
      }),
    );
  });

  it('should create adapter with default model and baseUrl from environment key', () => {
    // Arrange
    const previousValue = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'env-openai-key';

    try {
      // Act
      const adapter = createOpenAiLlmAdapter();

      // Assert
      expect(adapter).toBeDefined();
    } finally {
      process.env.OPENAI_API_KEY = previousValue;
    }
  });

  it('should prioritize generic LLM_* environment variables over OpenAI-specific ones', async () => {
    // Arrange
    const previousLlmApiKey = process.env.LLM_API_KEY;
    const previousLlmModel = process.env.LLM_MODEL;
    const previousLlmBaseUrl = process.env.LLM_BASE_URL;
    const previousOpenAiApiKey = process.env.OPENAI_API_KEY;
    const previousOpenAiModel = process.env.OPENAI_MODEL;
    const previousOpenAiBaseUrl = process.env.OPENAI_BASE_URL;
    process.env.LLM_API_KEY = 'generic-key';
    process.env.LLM_MODEL = 'generic-model';
    process.env.LLM_BASE_URL = 'https://generic-openai-base.test';
    process.env.OPENAI_API_KEY = 'provider-key';
    process.env.OPENAI_MODEL = 'provider-model';
    process.env.OPENAI_BASE_URL = 'https://provider-openai-base.test';
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{\"classification\":{}}' } }],
      }),
    });
    const adapter = createOpenAiLlmAdapter({
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    try {
      // Act
      await adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 25,
        timeoutMs: 5000,
      });
    } finally {
      process.env.LLM_API_KEY = previousLlmApiKey;
      process.env.LLM_MODEL = previousLlmModel;
      process.env.LLM_BASE_URL = previousLlmBaseUrl;
      process.env.OPENAI_API_KEY = previousOpenAiApiKey;
      process.env.OPENAI_MODEL = previousOpenAiModel;
      process.env.OPENAI_BASE_URL = previousOpenAiBaseUrl;
    }

    // Assert
    expect(fetchFn).toHaveBeenCalledWith(
      'https://generic-openai-base.test/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer generic-key',
        }),
        body: expect.stringContaining('\"model\":\"generic-model\"'),
      }),
    );
  });
});
