import fs from 'fs';
import path from 'path';

import type { ConfigPort } from '../../application/ports/config.port';
import type {
  IssueTriagePrompt,
  IssueTriagePromptGateway,
} from '../../application/ports/issue-triage-prompt-gateway.port';
import { createEnvConfig } from '../config/env-config.adapter';

const PROMPT_VERSION_ENV_VAR = 'PROMPT_VERSION';
const PROMPT_REGISTRY_PATH_ENV_VAR = 'PROMPT_REGISTRY_PATH';
const LLM_PROVIDER_ENV_VAR = 'LLM_PROVIDER';
const DEFAULT_PROVIDER = 'generic';
const PROMPT_FILENAME_REGEX = /^issue-triage\.v(.+)\.([a-z0-9-]+)\.ya?ml$/i;

interface CreateIssueTriagePromptRegistryParams {
  basePath?: string;
  config?: ConfigPort;
}

const parseScalarValue = (value: string): string | number | boolean => {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  if (trimmed === 'true') {
    return true;
  }

  if (trimmed === 'false') {
    return false;
  }

  const numericValue = Number(trimmed);
  if (!Number.isNaN(numericValue) && trimmed.length > 0) {
    return numericValue;
  }

  return trimmed;
};

const parseBlockScalar = (lines: string[], startIndex: number): { value: string; nextIndex: number } => {
  const blockLines: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.startsWith('  ')) {
      break;
    }
    blockLines.push(line.slice(2));
    index += 1;
  }

  return {
    value: blockLines.join('\n').trimEnd(),
    nextIndex: index,
  };
};

const parseConfigBlock = (lines: string[], startIndex: number): { value: Record<string, unknown>; nextIndex: number } => {
  const config: Record<string, unknown> = {};
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.startsWith('  ')) {
      break;
    }
    const trimmed = line.slice(2);
    const match = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (match) {
      /* istanbul ignore next */
      config[match[1]] = parseScalarValue(match[2] ?? '');
    }
    index += 1;
  }

  return { value: config, nextIndex: index };
};

const parsePromptYaml = (contents: string): IssueTriagePrompt => {
  const lines = contents.split(/\r?\n/);
  const result: Record<string, unknown> = {};

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line || line.trim().length === 0 || line.trim().startsWith('#')) {
      index += 1;
      continue;
    }

    const match = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(line);
    if (!match) {
      index += 1;
      continue;
    }

    const key = match[1];
    /* istanbul ignore next */
    const rawValue = match[2] ?? '';
    if (rawValue.trim() === '|') {
      const block = parseBlockScalar(lines, index + 1);
      result[key] = block.value;
      index = block.nextIndex;
      continue;
    }

    if (key === 'config' && rawValue.trim().length === 0) {
      const configBlock = parseConfigBlock(lines, index + 1);
      result[key] = configBlock.value;
      index = configBlock.nextIndex;
      continue;
    }

    result[key] = parseScalarValue(rawValue);
    index += 1;
  }

  const version = typeof result.version === 'string' ? result.version : undefined;
  const provider = typeof result.provider === 'string' ? result.provider : undefined;
  const systemPrompt = typeof result.system_prompt === 'string' ? result.system_prompt : undefined;
  const userPromptTemplate =
    typeof result.user_prompt_template === 'string' ? result.user_prompt_template : undefined;
  const outputContract = typeof result.output_contract === 'string' ? result.output_contract : undefined;
  const rawConfig =
    typeof result.config === 'object' && result.config ? (result.config as Record<string, unknown>) : undefined;
  const config =
    rawConfig && typeof rawConfig === 'object'
      ? {
          temperature: typeof rawConfig.temperature === 'number' ? rawConfig.temperature : undefined,
          maxTokens:
            typeof rawConfig.max_tokens === 'number'
              ? rawConfig.max_tokens
              : typeof rawConfig.maxTokens === 'number'
                ? rawConfig.maxTokens
                : undefined,
        }
      : undefined;

  if (!version || !provider || !systemPrompt || !userPromptTemplate) {
    throw new Error('Invalid prompt registry entry: missing required fields');
  }

  return {
    version,
    provider,
    systemPrompt,
    userPromptTemplate,
    outputContract,
    config,
  };
};

const parseVersionParts = (version: string): { core: number[]; pre: string | null } => {
  const [corePart, prePart] = version.split('-', 2);
  const core = corePart.split('.').map((segment) => Number(segment));
  return { core, pre: prePart ?? null };
};

const compareVersions = (left: string, right: string): number => {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  const maxLength = Math.max(leftParts.core.length, rightParts.core.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts.core[index] ?? 0;
    const rightValue = rightParts.core[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  if (leftParts.pre === rightParts.pre) {
    return 0;
  }

  if (leftParts.pre === null) {
    return 1;
  }

  if (rightParts.pre === null) {
    return -1;
  }

  return leftParts.pre.localeCompare(rightParts.pre);
};

export const comparePromptVersions = (left: string, right: string): number => compareVersions(left, right);

const resolveBasePath = (params: CreateIssueTriagePromptRegistryParams, config: ConfigPort): string => {
  if (params.basePath) {
    return params.basePath;
  }

  const configuredPath = config.get(PROMPT_REGISTRY_PATH_ENV_VAR);
  if (configuredPath) {
    return configuredPath;
  }

  const cwd = process.cwd();
  const srcPath = path.join(cwd, 'src/shared/application/prompts/issue-triage');
  if (fs.existsSync(srcPath)) {
    return srcPath;
  }

  const distPath = path.join(cwd, 'dist/shared/application/prompts/issue-triage');
  if (fs.existsSync(distPath)) {
    return distPath;
  }

  return srcPath;
};

const loadPromptRegistry = (basePath: string): IssueTriagePrompt[] => {
  if (!fs.existsSync(basePath)) {
    throw new Error(`Prompt registry path does not exist: ${basePath}`);
  }

  const entries = fs.readdirSync(basePath);
  return entries
    .map((entry) => {
      const match = PROMPT_FILENAME_REGEX.exec(entry);
      if (!match) {
        return undefined;
      }

      const filePath = path.join(basePath, entry);
      const contents = fs.readFileSync(filePath, 'utf-8');
      const parsed = parsePromptYaml(contents);
      return {
        ...parsed,
        version: match[1],
        provider: match[2],
      };
    })
    .filter((prompt): prompt is IssueTriagePrompt => !!prompt);
};

const selectPrompt = (
  prompts: IssueTriagePrompt[],
  provider: string,
  version?: string,
): IssueTriagePrompt => {
  const providerPrompts = prompts.filter((prompt) => prompt.provider === provider);
  const genericPrompts = prompts.filter((prompt) => prompt.provider === DEFAULT_PROVIDER);
  const candidates = providerPrompts.length > 0 ? providerPrompts : genericPrompts;

  if (candidates.length === 0) {
    throw new Error(`No prompts available for provider: ${provider}`);
  }

  if (version) {
    const match = candidates.find((prompt) => prompt.version === version);
    if (!match) {
      throw new Error(`Prompt version "${version}" not found for provider "${provider}"`);
    }
    return match;
  }

  return [...candidates].sort((left, right) => compareVersions(left.version, right.version)).pop()!;
};

export const createIssueTriagePromptRegistry = (
  params: CreateIssueTriagePromptRegistryParams = {},
): IssueTriagePromptGateway => {
  const config = params.config ?? createEnvConfig();
  const basePath = resolveBasePath(params, config);
  const prompts = loadPromptRegistry(basePath);

  return {
    getPrompt: (overrideParams) => {
      const provider =
        overrideParams?.provider ?? config.get(LLM_PROVIDER_ENV_VAR) ?? DEFAULT_PROVIDER;
      const version = overrideParams?.version ?? config.get(PROMPT_VERSION_ENV_VAR) ?? undefined;
      return selectPrompt(prompts, provider, version);
    },
  };
};
