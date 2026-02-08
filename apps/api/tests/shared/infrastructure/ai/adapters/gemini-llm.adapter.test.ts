import { createGeminiLlmAdapter } from '../../../../../src/shared/infrastructure/ai/adapters/gemini-llm.adapter';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

describe('GeminiLlmAdapter', () => {
  it('should call Gemini generateContent and return raw text', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"classification":{}}' }],
            },
          },
        ],
      }),
    });
    const adapter = createGeminiLlmAdapter({
      apiKey: 'gemini-key',
      model: 'gemini-1.5-flash',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act
    const result = await adapter.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 120,
      timeoutMs: 5000,
      temperature: 0.2,
    });

    // Assert
    expect(result).toEqual({ rawText: '{"classification":{}}' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should request JSON-only output via responseMimeType', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"classification":{}}' }],
            },
          },
        ],
      }),
    });
    const adapter = createGeminiLlmAdapter({
      apiKey: 'gemini-key',
      model: 'gemini-1.5-flash',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act
    await adapter.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 120,
      timeoutMs: 5000,
      temperature: 0.2,
    });

    // Assert
    const requestInit = fetchFn.mock.calls[0]?.[1];
    const requestBody = JSON.parse((requestInit?.body as string) ?? '{}') as {
      generationConfig?: { responseMimeType?: string };
    };
    expect(requestBody.generationConfig?.responseMimeType).toBe('application/json');
  });

  it('should throw when Gemini returns non-ok response', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'quota exceeded' } }),
    });
    const adapter = createGeminiLlmAdapter({
      apiKey: 'gemini-key',
      model: 'gemini-1.5-flash',
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
    ).rejects.toThrow('Gemini request failed');
  });

  it('should include model and provider error message when Gemini returns non-ok response', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: 'models/gemini-1.5-flash is not found' } }),
    });
    const adapter = createGeminiLlmAdapter({
      apiKey: 'gemini-key',
      model: 'gemini-1.5-flash',
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
    ).rejects.toThrow('Gemini request failed with status 404 for model gemini-1.5-flash');
  });

  it('should include status and model when non-ok response has no provider error message', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('invalid json');
      },
    });
    const adapter = createGeminiLlmAdapter({
      apiKey: 'gemini-key',
      model: 'gemini-1.5-flash',
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
    ).rejects.toThrow('Gemini request failed with status 502 for model gemini-1.5-flash');
  });

  it('should throw when Gemini response does not include candidate text', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [] } }],
      }),
    });
    const adapter = createGeminiLlmAdapter({
      apiKey: 'gemini-key',
      model: 'gemini-1.5-flash',
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
    ).rejects.toThrow('Gemini response did not include text content');
  });

  it('should throw when API key is missing', () => {
    // Arrange
    const previousValue = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      // Act + Assert
      expect(() => createGeminiLlmAdapter()).toThrow(
        'Missing Gemini API key. Provide "apiKey" or set GEMINI_API_KEY',
      );
    } finally {
      process.env.GEMINI_API_KEY = previousValue;
    }
  });

  it('should call fetch without signal when AbortSignal.timeout is unavailable', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{\"classification\":{}}' }],
            },
          },
        ],
      }),
    });
    const originalAbortSignalTimeout = AbortSignal.timeout;
    (AbortSignal as unknown as { timeout?: unknown }).timeout = undefined;
    const adapter = createGeminiLlmAdapter({
      apiKey: 'gemini-key',
      model: 'gemini-1.5-flash',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    try {
      // Act
      await adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
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
    const previousValue = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'env-gemini-key';

    try {
      // Act
      const adapter = createGeminiLlmAdapter();

      // Assert
      expect(adapter).toBeDefined();
    } finally {
      process.env.GEMINI_API_KEY = previousValue;
    }
  });

  it('should prioritize generic LLM_* environment variables over Gemini-specific ones', async () => {
    // Arrange
    const previousLlmApiKey = process.env.LLM_API_KEY;
    const previousLlmModel = process.env.LLM_MODEL;
    const previousLlmBaseUrl = process.env.LLM_BASE_URL;
    const previousGeminiApiKey = process.env.GEMINI_API_KEY;
    const previousGeminiModel = process.env.GEMINI_MODEL;
    const previousGeminiBaseUrl = process.env.GEMINI_BASE_URL;
    process.env.LLM_API_KEY = 'generic-key';
    process.env.LLM_MODEL = 'generic-model';
    process.env.LLM_BASE_URL = 'https://generic-gemini-base.test';
    process.env.GEMINI_API_KEY = 'provider-key';
    process.env.GEMINI_MODEL = 'provider-model';
    process.env.GEMINI_BASE_URL = 'https://provider-gemini-base.test';
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{\"classification\":{}}' }],
            },
          },
        ],
      }),
    });
    const adapter = createGeminiLlmAdapter({
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
      process.env.GEMINI_API_KEY = previousGeminiApiKey;
      process.env.GEMINI_MODEL = previousGeminiModel;
      process.env.GEMINI_BASE_URL = previousGeminiBaseUrl;
    }

    // Assert
    expect(fetchFn).toHaveBeenCalledWith(
      'https://generic-gemini-base.test/models/generic-model:generateContent?key=generic-key',
      expect.any(Object),
    );
  });
});
