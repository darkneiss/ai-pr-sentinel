import { createOllamaLlmAdapter } from '../../../../../src/shared/infrastructure/ai/adapters/ollama-llm.adapter';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

describe('OllamaLlmAdapter', () => {
  it('should call Ollama generate endpoint and return raw text', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ response: '{"classification":{}}' }),
    });
    const adapter = createOllamaLlmAdapter({
      baseUrl: 'http://localhost:11434',
      model: 'llama3.1',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act
    const result = await adapter.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 80,
      timeoutMs: 5000,
      temperature: 0.3,
    });

    // Assert
    expect(result).toEqual({ rawText: '{"classification":{}}' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should throw when Ollama returns non-ok response', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal error' }),
    });
    const adapter = createOllamaLlmAdapter({
      baseUrl: 'http://localhost:11434',
      model: 'llama3.1',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 80,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('Ollama request failed');
  });

  it('should throw when Ollama response does not include text content', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ response: '' }),
    });
    const adapter = createOllamaLlmAdapter({
      baseUrl: 'http://localhost:11434',
      model: 'llama3.1',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 80,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('Ollama response did not include text content');
  });

  it('should call fetch without signal when AbortSignal.timeout is unavailable', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ response: '{\"classification\":{}}' }),
    });
    const originalAbortSignalTimeout = AbortSignal.timeout;
    (AbortSignal as unknown as { timeout?: unknown }).timeout = undefined;
    const adapter = createOllamaLlmAdapter({
      baseUrl: 'http://localhost:11434',
      model: 'llama3.1',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    try {
      // Act
      await adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 80,
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

  it('should create adapter with default model and baseUrl', () => {
    // Act
    const adapter = createOllamaLlmAdapter();

    // Assert
    expect(adapter).toBeDefined();
  });

  it('should prioritize generic LLM_* environment variables over Ollama-specific ones', async () => {
    // Arrange
    const previousLlmModel = process.env.LLM_MODEL;
    const previousLlmBaseUrl = process.env.LLM_BASE_URL;
    const previousOllamaModel = process.env.OLLAMA_MODEL;
    const previousOllamaBaseUrl = process.env.OLLAMA_BASE_URL;
    process.env.LLM_MODEL = 'generic-model';
    process.env.LLM_BASE_URL = 'http://generic-ollama-base.test';
    process.env.OLLAMA_MODEL = 'provider-model';
    process.env.OLLAMA_BASE_URL = 'http://provider-ollama-base.test';
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ response: '{\"classification\":{}}' }),
    });
    const adapter = createOllamaLlmAdapter({
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    try {
      // Act
      await adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 80,
        timeoutMs: 5000,
      });
    } finally {
      process.env.LLM_MODEL = previousLlmModel;
      process.env.LLM_BASE_URL = previousLlmBaseUrl;
      process.env.OLLAMA_MODEL = previousOllamaModel;
      process.env.OLLAMA_BASE_URL = previousOllamaBaseUrl;
    }

    // Assert
    expect(fetchFn).toHaveBeenCalledWith(
      'http://generic-ollama-base.test/api/generate',
      expect.objectContaining({
        body: expect.stringContaining('\"model\":\"generic-model\"'),
      }),
    );
  });
});
