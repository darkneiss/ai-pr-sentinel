import { createLangSmithObservabilityAdapter } from '../../../../src/shared/infrastructure/observability/langsmith-observability.adapter';
import type { ConfigPort } from '../../../../src/shared/application/ports/config.port';
import {
  LLM_OBSERVABILITY_MAX_TEXT_CHARS,
  LLM_OBSERVABILITY_REDACTED_VALUE,
} from '../../../../src/shared/application/constants/llm-observability.constants';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

const createFetchFnMock = (response: MockFetchResponse): jest.MockedFunction<typeof fetch> =>
  jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue(response) as unknown as
    jest.MockedFunction<typeof fetch>;

const DEFAULT_LANGSMITH_ENDPOINT = 'https://api.smith.langchain.com';
const DEFAULT_RUNS_ENDPOINT = `${DEFAULT_LANGSMITH_ENDPOINT}/runs`;
const DEFAULT_API_KEY = 'ls-key';
const DEFAULT_PROJECT = 'ai-pr-sentinel';
const DEFAULT_RUN_NAME = 'issue_triage_llm';
const DEFAULT_RUN_TYPE = 'llm';
const DEFAULT_PROVIDER = 'groq';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';

const createConfig = (values: Record<string, string>): ConfigPort => ({
  get: (key: string): string | undefined => values[key],
  getBoolean: (_key: string): boolean | undefined => undefined,
});

describe('LangSmithObservabilityAdapter', () => {
  it('should create a run with api key and project', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 201,
      json: async () => ({}),
    });
    const config = createConfig({
      LANGSMITH_API_KEY: DEFAULT_API_KEY,
      LANGSMITH_PROJECT: DEFAULT_PROJECT,
      LANGSMITH_ENDPOINT: DEFAULT_LANGSMITH_ENDPOINT,
    });
    const adapter = createLangSmithObservabilityAdapter({
      config,
      fetchFn,
      idGenerator: () => 'run-1',
    });

    // Act
    const result = await adapter.trackRequest({
      runName: DEFAULT_RUN_NAME,
      runType: DEFAULT_RUN_TYPE,
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      inputs: {
        systemPrompt: 'system',
        userPrompt: 'user',
      },
      startedAt: '2026-02-10T00:00:00.000Z',
    });

    // Assert
    expect(result).toEqual({ runId: 'run-1' });
    expect(fetchFn).toHaveBeenCalledWith(
      DEFAULT_RUNS_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': DEFAULT_API_KEY,
        }),
      }),
    );
    const requestBody = JSON.parse((fetchFn.mock.calls[0]?.[1]?.body ?? '') as string) as {
      id?: string;
      session_name?: string;
    };
    expect(requestBody.id).toBe('run-1');
    expect(requestBody.session_name).toBe(DEFAULT_PROJECT);
  });

  it('should update run with outputs', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    const config = createConfig({
      LANGSMITH_API_KEY: DEFAULT_API_KEY,
      LANGSMITH_ENDPOINT: DEFAULT_LANGSMITH_ENDPOINT,
    });
    const adapter = createLangSmithObservabilityAdapter({
      config,
      fetchFn,
      idGenerator: () => 'run-2',
    });

    // Act
    await adapter.trackResponse({
      runId: 'run-2',
      outputs: { rawText: '{"ok":true}' },
      endedAt: '2026-02-10T00:00:01.000Z',
    });

    // Assert
    expect(fetchFn).toHaveBeenCalledWith(
      `${DEFAULT_RUNS_ENDPOINT}/run-2`,
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'x-api-key': DEFAULT_API_KEY,
        }),
      }),
    );
    const requestBody = JSON.parse((fetchFn.mock.calls[0]?.[1]?.body ?? '') as string) as {
      outputs?: Record<string, unknown>;
      end_time?: string;
    };
    expect(requestBody.outputs).toEqual({ rawText: '{"ok":true}' });
    expect(requestBody.end_time).toBe('2026-02-10T00:00:01.000Z');
  });

  it('should redact sensitive fields and truncate long text', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 201,
      json: async () => ({}),
    });
    const config = createConfig({
      LANGSMITH_API_KEY: DEFAULT_API_KEY,
      LANGSMITH_ENDPOINT: DEFAULT_LANGSMITH_ENDPOINT,
    });
    const adapter = createLangSmithObservabilityAdapter({
      config,
      fetchFn,
      idGenerator: () => 'run-3',
    });
    const longText = 'a'.repeat(LLM_OBSERVABILITY_MAX_TEXT_CHARS + 10);

    // Act
    await adapter.trackRequest({
      runName: DEFAULT_RUN_NAME,
      runType: DEFAULT_RUN_TYPE,
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      inputs: {
        api_key: 'secret',
        userPrompt: longText,
      },
      startedAt: '2026-02-10T00:00:02.000Z',
    });

    // Assert
    const requestBody = JSON.parse((fetchFn.mock.calls[0]?.[1]?.body ?? '') as string) as {
      inputs?: Record<string, unknown>;
    };
    const inputs = requestBody.inputs ?? {};
    expect(inputs.api_key).toBe(LLM_OBSERVABILITY_REDACTED_VALUE);
    expect(typeof inputs.userPrompt).toBe('string');
    expect((inputs.userPrompt as string).length).toBe(LLM_OBSERVABILITY_MAX_TEXT_CHARS);
  });

  it('should keep /runs endpoint and include workspace header', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 201,
      json: async () => ({}),
    });
    const config = createConfig({
      LANGSMITH_API_KEY: DEFAULT_API_KEY,
      LANGSMITH_ENDPOINT: `${DEFAULT_LANGSMITH_ENDPOINT}/runs/`,
      LANGSMITH_WORKSPACE_ID: 'workspace-1',
    });
    const adapter = createLangSmithObservabilityAdapter({
      config,
      fetchFn,
      idGenerator: () => 'run-4',
    });

    // Act
    await adapter.trackRequest({
      runName: DEFAULT_RUN_NAME,
      runType: DEFAULT_RUN_TYPE,
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      inputs: {
        systemPrompt: 'system',
        userPrompt: 'user',
      },
      startedAt: '2026-02-10T00:00:03.000Z',
    });

    // Assert
    expect(fetchFn).toHaveBeenCalledWith(
      DEFAULT_RUNS_ENDPOINT,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-tenant-id': 'workspace-1',
        }),
      }),
    );
  });

  it('should redact prompts in production and sanitize arrays', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 201,
      json: async () => ({}),
    });
    const config = createConfig({
      LANGSMITH_API_KEY: DEFAULT_API_KEY,
      LANGSMITH_ENDPOINT: DEFAULT_LANGSMITH_ENDPOINT,
      NODE_ENV: 'production',
    });
    const adapter = createLangSmithObservabilityAdapter({
      config,
      fetchFn,
      idGenerator: () => 'run-5',
    });
    const longText = 'b'.repeat(LLM_OBSERVABILITY_MAX_TEXT_CHARS + 20);

    // Act
    await adapter.trackRequest({
      runName: DEFAULT_RUN_NAME,
      runType: DEFAULT_RUN_TYPE,
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      inputs: {
        systemPrompt: 'secret prompt',
        messages: [longText],
      },
      startedAt: '2026-02-10T00:00:04.000Z',
    });

    // Assert
    const requestBody = JSON.parse((fetchFn.mock.calls[0]?.[1]?.body ?? '') as string) as {
      inputs?: Record<string, unknown>;
    };
    const inputs = requestBody.inputs ?? {};
    expect(inputs.systemPrompt).toBe(LLM_OBSERVABILITY_REDACTED_VALUE);
    expect(Array.isArray(inputs.messages)).toBe(true);
    expect(((inputs.messages as string[])[0] ?? '').length).toBe(LLM_OBSERVABILITY_MAX_TEXT_CHARS);
  });

  it('should skip error tracking when runId is missing', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    const config = createConfig({
      LANGSMITH_API_KEY: DEFAULT_API_KEY,
      LANGSMITH_ENDPOINT: DEFAULT_LANGSMITH_ENDPOINT,
    });
    const adapter = createLangSmithObservabilityAdapter({
      config,
      fetchFn,
    });

    // Act
    await adapter.trackError({
      errorMessage: 'boom',
      endedAt: '2026-02-10T00:00:07.000Z',
    });

    // Assert
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('should update run when tracking error with runId', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    const config = createConfig({
      LANGSMITH_API_KEY: DEFAULT_API_KEY,
      LANGSMITH_ENDPOINT: DEFAULT_LANGSMITH_ENDPOINT,
    });
    const adapter = createLangSmithObservabilityAdapter({
      config,
      fetchFn,
    });

    // Act
    await adapter.trackError({
      runId: 'run-8',
      errorMessage: 'boom',
      endedAt: '2026-02-10T00:00:09.000Z',
    });

    // Assert
    expect(fetchFn).toHaveBeenCalledWith(
      `${DEFAULT_RUNS_ENDPOINT}/run-8`,
      expect.objectContaining({
        method: 'PATCH',
      }),
    );
  });

  it('should use env config and global fetch when params are omitted', async () => {
    // Arrange
    const previousApiKey = process.env.LANGSMITH_API_KEY;
    const previousEndpoint = process.env.LANGSMITH_ENDPOINT;
    const previousProject = process.env.LANGSMITH_PROJECT;
    const originalFetch = global.fetch;
    process.env.LANGSMITH_API_KEY = DEFAULT_API_KEY;
    process.env.LANGSMITH_ENDPOINT = DEFAULT_LANGSMITH_ENDPOINT;
    process.env.LANGSMITH_PROJECT = DEFAULT_PROJECT;
    const globalFetchMock = createFetchFnMock({
      ok: true,
      status: 201,
      json: async () => ({}),
    });
    global.fetch = globalFetchMock as unknown as typeof fetch;

    try {
      const adapter = createLangSmithObservabilityAdapter();

      // Act
      await adapter.trackRequest({
        runName: DEFAULT_RUN_NAME,
        runType: DEFAULT_RUN_TYPE,
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
        inputs: { userPrompt: 'user' },
        startedAt: '2026-02-10T00:00:10.000Z',
      });
    } finally {
      process.env.LANGSMITH_API_KEY = previousApiKey;
      process.env.LANGSMITH_ENDPOINT = previousEndpoint;
      process.env.LANGSMITH_PROJECT = previousProject;
      global.fetch = originalFetch;
    }

    // Assert
    expect(globalFetchMock).toHaveBeenCalledWith(
      DEFAULT_RUNS_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('should fall back to default endpoint when LANGSMITH_ENDPOINT is missing', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 201,
      json: async () => ({}),
    });
    const config = createConfig({
      LANGSMITH_API_KEY: DEFAULT_API_KEY,
    });
    const adapter = createLangSmithObservabilityAdapter({
      config,
      fetchFn,
      idGenerator: () => 'run-9',
    });

    // Act
    await adapter.trackRequest({
      runName: DEFAULT_RUN_NAME,
      runType: DEFAULT_RUN_TYPE,
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      inputs: { userPrompt: 'user' },
      startedAt: '2026-02-10T00:00:11.000Z',
    });

    // Assert
    expect(fetchFn).toHaveBeenCalledWith(
      DEFAULT_RUNS_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
