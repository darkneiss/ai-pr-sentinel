import { createLlmGateway } from '../../../../src/infrastructure/composition/llm-gateway.factory';
import type { ConfigPort } from '../../../../src/shared/application/ports/config.port';
import type { LLMGateway } from '../../../../src/shared/application/ports/llm-gateway.port';
import type { LLMObservabilityGateway } from '../../../../src/shared/application/ports/llm-observability-gateway.port';

describe('LlmGatewayFactory (Observability)', () => {
  it('should wrap LLM gateway when LangSmith tracing is enabled', async () => {
    // Arrange
    const baseGateway: LLMGateway = {
      generateJson: jest.fn().mockResolvedValue({ rawText: '{"ok":true}' }),
    };
    const observabilityGateway: LLMObservabilityGateway = {
      trackRequest: jest.fn().mockResolvedValue({ runId: 'run-1' }),
      trackResponse: jest.fn().mockResolvedValue(undefined),
      trackError: jest.fn().mockResolvedValue(undefined),
    };
    const config: ConfigPort = {
      get: (key: string): string | undefined => {
        const values: Record<string, string> = {
          LLM_PROVIDER: 'groq',
          LLM_MODEL: 'openai/gpt-oss-20b',
          LLM_BASE_URL: 'https://api.groq.com/openai/v1/chat/completions',
          LANGSMITH_TRACING: 'true',
        };
        return values[key];
      },
      getBoolean: (key: string): boolean | undefined => {
        if (key === 'LANGSMITH_TRACING') {
          return true;
        }
        return undefined;
      },
    };

    const gateway = createLlmGateway({
      config,
      createGroqLlmAdapter: () => baseGateway,
      createLangSmithObservabilityAdapter: () => observabilityGateway,
    });

    // Act
    await gateway.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 120,
      timeoutMs: 5000,
    });

    // Assert
    expect(observabilityGateway.trackRequest).toHaveBeenCalledTimes(1);
    expect(observabilityGateway.trackResponse).toHaveBeenCalledTimes(1);
  });

  it('should fall back to unknown model and undefined endpoint when env vars are missing', async () => {
    // Arrange
    const baseGateway: LLMGateway = {
      generateJson: jest.fn().mockResolvedValue({ rawText: '{"ok":true}' }),
    };
    const observabilityGateway: LLMObservabilityGateway = {
      trackRequest: jest.fn().mockResolvedValue({ runId: 'run-2' }),
      trackResponse: jest.fn().mockResolvedValue(undefined),
      trackError: jest.fn().mockResolvedValue(undefined),
    };
    const config: ConfigPort = {
      get: (key: string): string | undefined => {
        const values: Record<string, string> = {
          LLM_PROVIDER: 'groq',
          LANGSMITH_TRACING: 'true',
        };
        return values[key];
      },
      getBoolean: (key: string): boolean | undefined => {
        if (key === 'LANGSMITH_TRACING') {
          return true;
        }
        return undefined;
      },
    };

    const gateway = createLlmGateway({
      config,
      createGroqLlmAdapter: () => baseGateway,
      createLangSmithObservabilityAdapter: () => observabilityGateway,
    });

    // Act
    await gateway.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 120,
      timeoutMs: 5000,
    });

    // Assert
    expect(observabilityGateway.trackRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'unknown',
        endpoint: undefined,
      }),
    );
  });

  it('should use the default LangSmith adapter when none is provided', async () => {
    // Arrange
    const baseGateway: LLMGateway = {
      generateJson: jest.fn().mockResolvedValue({ rawText: '{"ok":true}' }),
    };
    const config: ConfigPort = {
      get: (key: string): string | undefined => {
        const values: Record<string, string> = {
          LLM_PROVIDER: 'groq',
          LLM_MODEL: 'openai/gpt-oss-20b',
          LLM_BASE_URL: 'https://api.groq.com/openai/v1/chat/completions',
          LANGSMITH_TRACING: 'true',
          LANGSMITH_API_KEY: 'ls-key',
          LANGSMITH_ENDPOINT: 'https://api.smith.langchain.com',
        };
        return values[key];
      },
      getBoolean: (key: string): boolean | undefined => {
        if (key === 'LANGSMITH_TRACING') {
          return true;
        }
        return undefined;
      },
    };
    const previousFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      const gateway = createLlmGateway({
        config,
        createGroqLlmAdapter: () => baseGateway,
      });

      // Act
      await gateway.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      });
    } finally {
      global.fetch = previousFetch;
    }

    // Assert
    expect(fetchMock).toHaveBeenCalled();
  });
});
