import { createOllamaLlmAdapter } from '../../../../../src/shared/infrastructure/ai/adapters/ollama-llm.adapter';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

type GenerateJsonInput = Parameters<ReturnType<typeof createOllamaLlmAdapter>['generateJson']>[0];

const DEFAULT_JSON_TEXT = '{"classification":{}}';

const DEFAULT_GENERATE_JSON_INPUT: GenerateJsonInput = {
  systemPrompt: 'system',
  userPrompt: 'user',
  maxTokens: 80,
  timeoutMs: 5000,
  temperature: 0.3,
};

const createFetchFnMock = (response: MockFetchResponse): jest.MockedFunction<typeof fetch> =>
  jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue(response) as unknown as
    jest.MockedFunction<typeof fetch>;

const createAbortError = (): Error => {
  const error = new Error('Request aborted');
  error.name = 'AbortError';
  return error;
};

const createAdapterWithFetch = (fetchFn: typeof fetch) =>
  createOllamaLlmAdapter({
    baseUrl: 'http://localhost:11434',
    model: 'llama3.1',
    fetchFn,
  });

const runGenerateJson = (
  adapter: ReturnType<typeof createOllamaLlmAdapter>,
  overrides: Partial<GenerateJsonInput> = {},
) =>
  adapter.generateJson({
    ...DEFAULT_GENERATE_JSON_INPUT,
    ...overrides,
  });

describe('OllamaLlmAdapter', () => {
  it('should call Ollama generate endpoint and return raw text', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({ response: DEFAULT_JSON_TEXT }),
    });
    const adapter = createAdapterWithFetch(fetchFn);

    // Act
    const result = await runGenerateJson(adapter);

    // Assert
    expect(result).toEqual({ rawText: DEFAULT_JSON_TEXT });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should request JSON-formatted output from Ollama', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({ response: DEFAULT_JSON_TEXT }),
    });
    const adapter = createAdapterWithFetch(fetchFn);

    // Act
    await runGenerateJson(adapter);

    // Assert
    const requestBody = (fetchFn.mock.calls[0]?.[1]?.body ?? '') as string;
    expect(requestBody).toContain('"format":"json"');
  });

  it('should throw when Ollama returns non-ok response', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal error' }),
    });
    const adapter = createAdapterWithFetch(fetchFn);

    // Act + Assert
    await expect(runGenerateJson(adapter)).rejects.toThrow('Ollama request failed');
  });

  it('should retry once when Ollama returns a retryable status', async () => {
    // Arrange
    const fetchFn = jest
      .fn<Promise<MockFetchResponse>, [string, RequestInit?]>()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'overloaded' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ response: DEFAULT_JSON_TEXT }),
      });
    const adapter = createAdapterWithFetch(fetchFn as unknown as typeof fetch);

    // Act
    const result = await runGenerateJson(adapter);

    // Assert
    expect(result).toEqual({ rawText: DEFAULT_JSON_TEXT });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('should throw when Ollama retry response is non-ok', async () => {
    // Arrange
    const fetchFn = jest
      .fn<Promise<MockFetchResponse>, [string, RequestInit?]>()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'overloaded' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'still failing' }),
      });
    const adapter = createAdapterWithFetch(fetchFn as unknown as typeof fetch);

    // Act + Assert
    await expect(runGenerateJson(adapter)).rejects.toThrow('Ollama request failed with status 500');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('should retry once when Ollama request times out', async () => {
    // Arrange
    const fetchFn = jest
      .fn<Promise<MockFetchResponse>, [string, RequestInit?]>()
      .mockRejectedValueOnce(createAbortError())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ response: DEFAULT_JSON_TEXT }),
      });
    const adapter = createAdapterWithFetch(fetchFn as unknown as typeof fetch);

    // Act
    const result = await runGenerateJson(adapter);

    // Assert
    expect(result).toEqual({ rawText: DEFAULT_JSON_TEXT });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('should rethrow non-timeout fetch errors', async () => {
    // Arrange
    const fetchError = new Error('network down');
    const fetchFn = jest
      .fn<Promise<MockFetchResponse>, [string, RequestInit?]>()
      .mockRejectedValueOnce(fetchError);
    const adapter = createAdapterWithFetch(fetchFn as unknown as typeof fetch);

    // Act + Assert
    await expect(runGenerateJson(adapter)).rejects.toThrow('network down');
  });

  it('should throw when timeout retry returns non-ok response', async () => {
    // Arrange
    const fetchFn = jest
      .fn<Promise<MockFetchResponse>, [string, RequestInit?]>()
      .mockRejectedValueOnce(createAbortError())
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'rate limited' }),
      });
    const adapter = createAdapterWithFetch(fetchFn as unknown as typeof fetch);

    // Act + Assert
    await expect(runGenerateJson(adapter)).rejects.toThrow('Ollama request failed with status 429');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('should throw when Ollama response does not include text content', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({ response: '' }),
    });
    const adapter = createAdapterWithFetch(fetchFn);

    // Act + Assert
    await expect(runGenerateJson(adapter)).rejects.toThrow('Ollama response did not include text content');
  });

  it('should call fetch without signal when AbortSignal.timeout is unavailable', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({ response: DEFAULT_JSON_TEXT }),
    });
    const originalAbortSignalTimeout = AbortSignal.timeout;
    (AbortSignal as unknown as { timeout?: unknown }).timeout = undefined;
    const adapter = createAdapterWithFetch(fetchFn);

    try {
      // Act
      await runGenerateJson(adapter);
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
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({ response: DEFAULT_JSON_TEXT }),
    });
    const adapter = createOllamaLlmAdapter({ fetchFn });

    try {
      // Act
      await runGenerateJson(adapter);
    } finally {
      process.env.LLM_MODEL = previousLlmModel;
      process.env.LLM_BASE_URL = previousLlmBaseUrl;
      process.env.OLLAMA_MODEL = previousOllamaModel;
      process.env.OLLAMA_BASE_URL = previousOllamaBaseUrl;
    }

    // Assert
    expect(fetchFn).toHaveBeenCalledWith(
      'http://generic-ollama-base.test',
      expect.objectContaining({
        body: expect.stringContaining('\"model\":\"generic-model\"'),
      }),
    );
  });
});
