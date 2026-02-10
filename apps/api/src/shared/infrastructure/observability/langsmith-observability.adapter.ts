import type { ConfigPort } from '../../application/ports/config.port';
import type {
  LLMObservabilityGateway,
  LlmObservabilityError,
  LlmObservabilityRequest,
  LlmObservabilityResponse,
} from '../../application/ports/llm-observability-gateway.port';
import {
  LLM_OBSERVABILITY_MAX_TEXT_CHARS,
  LLM_OBSERVABILITY_PROMPT_KEYS,
  LLM_OBSERVABILITY_REDACTED_VALUE,
  LLM_OBSERVABILITY_SENSITIVE_KEYS,
} from '../../application/constants/llm-observability.constants';
import { createEnvConfig } from '../config/env-config.adapter';
import { randomUUID } from 'crypto';

const LANGSMITH_API_KEY_ENV_VAR = 'LANGSMITH_API_KEY';
const LANGSMITH_ENDPOINT_ENV_VAR = 'LANGSMITH_ENDPOINT';
const LANGSMITH_PROJECT_ENV_VAR = 'LANGSMITH_PROJECT';
const LANGSMITH_WORKSPACE_ID_ENV_VAR = 'LANGSMITH_WORKSPACE_ID';
const DEFAULT_LANGSMITH_ENDPOINT = 'https://api.smith.langchain.com';
const LANGSMITH_RUNS_PATH = '/runs';
const LANGSMITH_API_KEY_HEADER = 'x-api-key';
const LANGSMITH_WORKSPACE_HEADER = 'x-tenant-id';

interface CreateLangSmithObservabilityAdapterParams {
  config?: ConfigPort;
  fetchFn?: typeof fetch;
  idGenerator?: () => string;
}

type JsonRecord = Record<string, unknown>;

const getLangSmithApiKey = (config: ConfigPort): string => {
  const apiKey = config.get(LANGSMITH_API_KEY_ENV_VAR);
  if (!apiKey) {
    throw new Error(`Missing LangSmith API key. Provide ${LANGSMITH_API_KEY_ENV_VAR}.`);
  }

  return apiKey;
};

const buildRunsEndpoint = (baseUrl: string): string => {
  const normalized = baseUrl.replace(/\/+$/, '');
  if (normalized.endsWith(LANGSMITH_RUNS_PATH)) {
    return normalized;
  }
  return `${normalized}${LANGSMITH_RUNS_PATH}`;
};

const isSensitiveKey = (key: string): boolean =>
  (LLM_OBSERVABILITY_SENSITIVE_KEYS as readonly string[]).includes(key.toLowerCase());

const isPromptKey = (key: string): boolean =>
  (LLM_OBSERVABILITY_PROMPT_KEYS as readonly string[]).includes(key);

const truncateText = (value: string, maxChars: number): string =>
  value.length > maxChars ? value.slice(0, maxChars) : value;

const sanitizeValue = (
  value: unknown,
  {
    key,
    maxChars,
    isProduction,
  }: { key?: string; maxChars: number; isProduction: boolean },
): unknown => {
  if (key && isSensitiveKey(key)) {
    return LLM_OBSERVABILITY_REDACTED_VALUE;
  }

  if (typeof value === 'string') {
    if (isProduction && key && isPromptKey(key)) {
      return LLM_OBSERVABILITY_REDACTED_VALUE;
    }

    return truncateText(value, maxChars);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, { key, maxChars, isProduction }));
  }

  if (value && typeof value === 'object') {
    const sanitized: JsonRecord = {};
    Object.entries(value).forEach(([childKey, childValue]) => {
      sanitized[childKey] = sanitizeValue(childValue, {
        key: childKey,
        maxChars,
        isProduction,
      });
    });
    return sanitized;
  }

  return value;
};

const sanitizePayload = (payload: JsonRecord, config: ConfigPort): JsonRecord => {
  const nodeEnv = (config.get('NODE_ENV') ?? '').trim().toLowerCase();
  const isProduction = nodeEnv === 'production';

  return sanitizeValue(payload, {
    maxChars: LLM_OBSERVABILITY_MAX_TEXT_CHARS,
    isProduction,
  }) as JsonRecord;
};

const buildHeaders = (apiKey: string, workspaceId?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    [LANGSMITH_API_KEY_HEADER]: apiKey,
    'Content-Type': 'application/json',
  };

  if (workspaceId) {
    headers[LANGSMITH_WORKSPACE_HEADER] = workspaceId;
  }

  return headers;
};

const parseErrorMessage = async (response: Response): Promise<string | undefined> => {
  try {
    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }
    const message = (payload as { message?: string }).message;
    return typeof message === 'string' ? message : undefined;
  } catch (_error: unknown) {
    return undefined;
  }
};

const assertOkResponse = async (response: Response): Promise<void> => {
  if (response.ok) {
    return;
  }

  const message = await parseErrorMessage(response);
  const suffix = message ? `: ${message}` : '';
  throw new Error(`LangSmith request failed with status ${response.status}${suffix}`);
};

export const createLangSmithObservabilityAdapter = (
  params: CreateLangSmithObservabilityAdapterParams = {},
): LLMObservabilityGateway => {
  const config = params.config ?? createEnvConfig();
  const apiKey = getLangSmithApiKey(config);
  const endpoint = buildRunsEndpoint(config.get(LANGSMITH_ENDPOINT_ENV_VAR) ?? DEFAULT_LANGSMITH_ENDPOINT);
  const workspaceId = config.get(LANGSMITH_WORKSPACE_ID_ENV_VAR);
  const sessionName = config.get(LANGSMITH_PROJECT_ENV_VAR);
  const fetchFn = params.fetchFn ?? fetch;
  const idGenerator = params.idGenerator ?? (() => randomUUID());

  const createRun = async (payload: JsonRecord): Promise<void> => {
    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: buildHeaders(apiKey, workspaceId),
      body: JSON.stringify(payload),
    });
    await assertOkResponse(response);
  };

  const updateRun = async (runId: string, payload: JsonRecord): Promise<void> => {
    const response = await fetchFn(`${endpoint}/${runId}`, {
      method: 'PATCH',
      headers: buildHeaders(apiKey, workspaceId),
      body: JSON.stringify(payload),
    });
    await assertOkResponse(response);
  };

  const buildCommonFields = (request: LlmObservabilityRequest): JsonRecord => {
    const payload: JsonRecord = {
      id: idGenerator(),
      name: request.runName,
      run_type: request.runType,
      start_time: request.startedAt,
      inputs: sanitizePayload(request.inputs, config),
      extra: sanitizePayload(
        {
          provider: request.provider,
          model: request.model,
          endpoint: request.endpoint,
          metadata: request.metadata,
        },
        config,
      ),
    };

    if (sessionName) {
      payload.session_name = sessionName;
    }

    return payload;
  };

  return {
    trackRequest: async (request: LlmObservabilityRequest): Promise<{ runId: string }> => {
      const commonFields = buildCommonFields(request);
      const runId = String(commonFields.id);
      await createRun(commonFields);
      return { runId };
    },
    trackResponse: async (response: LlmObservabilityResponse): Promise<void> => {
      await updateRun(response.runId, {
        outputs: sanitizePayload(response.outputs, config),
        end_time: response.endedAt,
      });
    },
    trackError: async (error: LlmObservabilityError): Promise<void> => {
      if (!error.runId) {
        return;
      }

      await updateRun(error.runId, {
        error: error.errorMessage,
        end_time: error.endedAt,
      });
    },
  };
};
