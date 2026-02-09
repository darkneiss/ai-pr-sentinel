import fs from 'fs';
import path from 'path';

import type { ConfigPort } from '../../application/ports/config.port';
import type {
  IssueTriagePrompt,
  IssueTriagePromptGateway,
} from '../../application/ports/issue-triage-prompt-gateway.port';
import { createEnvConfig } from '../config/env-config.adapter';
import { parseIssueTriagePromptYaml } from './issue-triage-prompt-parser.service';

const PROMPT_VERSION_ENV_VAR = 'PROMPT_VERSION';
const PROMPT_REGISTRY_PATH_ENV_VAR = 'PROMPT_REGISTRY_PATH';
const LLM_PROVIDER_ENV_VAR = 'LLM_PROVIDER';
const DEFAULT_PROVIDER = 'generic';
const PROMPT_FILENAME_REGEX = /^issue-triage\.v(.+)\.([a-z0-9-]+)\.ya?ml$/i;

interface CreateIssueTriagePromptRegistryParams {
  basePath?: string;
  config?: ConfigPort;
}

const parsePromptYaml = (contents: string): IssueTriagePrompt => parseIssueTriagePromptYaml(contents);

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
