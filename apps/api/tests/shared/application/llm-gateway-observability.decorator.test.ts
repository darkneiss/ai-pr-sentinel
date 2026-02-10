import { createObservedLlmGateway } from '../../../src/shared/application/observability/llm-gateway-observability.decorator';
import type { LLMGateway } from '../../../src/shared/application/ports/llm-gateway.port';
import type { LLMObservabilityGateway } from '../../../src/shared/application/ports/llm-observability-gateway.port';

describe('LlmGatewayObservabilityDecorator', () => {
  it('should track request and response when LLM call succeeds', async () => {
    // Arrange
    const llmGateway: LLMGateway = {
      generateJson: jest.fn().mockResolvedValue({ rawText: '{"ok":true}' }),
    };
    const observabilityGateway: LLMObservabilityGateway = {
      trackRequest: jest.fn().mockResolvedValue({ runId: 'run-1' }),
      trackResponse: jest.fn().mockResolvedValue(undefined),
      trackError: jest.fn().mockResolvedValue(undefined),
    };
    const gateway = createObservedLlmGateway({
      llmGateway,
      observabilityGateway,
      requestContext: {
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      },
    });

    // Act
    const result = await gateway.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 200,
      timeoutMs: 5000,
      temperature: 0.2,
    });

    // Assert
    expect(result).toEqual({ rawText: '{"ok":true}' });
    expect(observabilityGateway.trackRequest).toHaveBeenCalledTimes(1);
    expect(observabilityGateway.trackResponse).toHaveBeenCalledTimes(1);
    expect(observabilityGateway.trackResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        outputs: { rawText: '{"ok":true}' },
      }),
    );
    expect(observabilityGateway.trackError).not.toHaveBeenCalled();
  });

  it('should track error and rethrow when LLM call fails', async () => {
    // Arrange
    const llmGateway: LLMGateway = {
      generateJson: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const observabilityGateway: LLMObservabilityGateway = {
      trackRequest: jest.fn().mockResolvedValue({ runId: 'run-2' }),
      trackResponse: jest.fn().mockResolvedValue(undefined),
      trackError: jest.fn().mockResolvedValue(undefined),
    };
    const gateway = createObservedLlmGateway({
      llmGateway,
      observabilityGateway,
      requestContext: {
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      },
    });

    // Act + Assert
    await expect(
      gateway.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 200,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('boom');
    expect(observabilityGateway.trackError).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-2',
        errorMessage: 'boom',
      }),
    );
  });

  it('should continue when observability tracking fails', async () => {
    // Arrange
    const llmGateway: LLMGateway = {
      generateJson: jest.fn().mockResolvedValue({ rawText: '{"ok":true}' }),
    };
    const observabilityGateway: LLMObservabilityGateway = {
      trackRequest: jest.fn().mockRejectedValue(new Error('observability down')),
      trackResponse: jest.fn().mockResolvedValue(undefined),
      trackError: jest.fn().mockResolvedValue(undefined),
    };
    const gateway = createObservedLlmGateway({
      llmGateway,
      observabilityGateway,
      requestContext: {
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      },
    });

    // Act
    const result = await gateway.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 200,
      timeoutMs: 5000,
    });

    // Assert
    expect(result).toEqual({ rawText: '{"ok":true}' });
    expect(observabilityGateway.trackResponse).not.toHaveBeenCalled();
  });

  it('should use unknown error message when non-error is thrown', async () => {
    // Arrange
    const llmGateway: LLMGateway = {
      generateJson: jest.fn().mockRejectedValue('boom'),
    };
    const observabilityGateway: LLMObservabilityGateway = {
      trackRequest: jest.fn().mockResolvedValue({ runId: 'run-3' }),
      trackResponse: jest.fn().mockResolvedValue(undefined),
      trackError: jest.fn().mockResolvedValue(undefined),
    };
    const gateway = createObservedLlmGateway({
      llmGateway,
      observabilityGateway,
      requestContext: {
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      },
    });

    // Act + Assert
    await expect(
      gateway.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 200,
        timeoutMs: 5000,
      }),
    ).rejects.toBe('boom');
    expect(observabilityGateway.trackError).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-3',
        errorMessage: 'Unknown error',
      }),
    );
  });

  it('should log and continue when response tracking fails', async () => {
    // Arrange
    const llmGateway: LLMGateway = {
      generateJson: jest.fn().mockResolvedValue({ rawText: '{"ok":true}' }),
    };
    const observabilityGateway: LLMObservabilityGateway = {
      trackRequest: jest.fn().mockResolvedValue({ runId: 'run-4' }),
      trackResponse: jest.fn().mockRejectedValue(new Error('observability down')),
      trackError: jest.fn().mockResolvedValue(undefined),
    };
    const logger = {
      debug: jest.fn(),
    };
    const gateway = createObservedLlmGateway({
      llmGateway,
      observabilityGateway,
      requestContext: {
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      },
      logger,
    });

    // Act
    const result = await gateway.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 200,
      timeoutMs: 5000,
    });

    // Assert
    expect(result).toEqual({ rawText: '{"ok":true}' });
    expect(logger.debug).toHaveBeenCalledWith(
      'LLM observability tracking failed to record response.',
      expect.objectContaining({
        error: expect.any(Error),
      }),
    );
  });

  it('should log and rethrow when error tracking fails', async () => {
    // Arrange
    const llmGateway: LLMGateway = {
      generateJson: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const observabilityGateway: LLMObservabilityGateway = {
      trackRequest: jest.fn().mockResolvedValue({ runId: 'run-5' }),
      trackResponse: jest.fn().mockResolvedValue(undefined),
      trackError: jest.fn().mockRejectedValue(new Error('observability down')),
    };
    const logger = {
      debug: jest.fn(),
    };
    const gateway = createObservedLlmGateway({
      llmGateway,
      observabilityGateway,
      requestContext: {
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      },
      logger,
    });

    // Act + Assert
    await expect(
      gateway.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 200,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('boom');
    expect(logger.debug).toHaveBeenCalledWith(
      'LLM observability tracking failed to record error.',
      expect.objectContaining({
        error: expect.any(Error),
      }),
    );
  });

  it('should skip error tracking when request tracking fails and LLM throws', async () => {
    // Arrange
    const llmGateway: LLMGateway = {
      generateJson: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const observabilityGateway: LLMObservabilityGateway = {
      trackRequest: jest.fn().mockRejectedValue(new Error('observability down')),
      trackResponse: jest.fn().mockResolvedValue(undefined),
      trackError: jest.fn().mockResolvedValue(undefined),
    };
    const gateway = createObservedLlmGateway({
      llmGateway,
      observabilityGateway,
      requestContext: {
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      },
    });

    // Act + Assert
    await expect(
      gateway.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 200,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('boom');
    expect(observabilityGateway.trackError).not.toHaveBeenCalled();
  });
});
