import type { IssueTriagePrompt } from '../../application/ports/issue-triage-prompt-gateway.port';

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
      config[match[1]] = parseScalarValue(match[2]!);
    }
    index += 1;
  }

  return { value: config, nextIndex: index };
};

export const parseIssueTriagePromptYaml = (contents: string): IssueTriagePrompt => {
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
    const rawValue = match[2]!;
    const trimmedValue = rawValue.trim();
    if (key === 'config' && trimmedValue.length === 0) {
      const configBlock = parseConfigBlock(lines, index + 1);
      result[key] = configBlock.value;
      index = configBlock.nextIndex;
      continue;
    }

    if (trimmedValue === '|') {
      const block = parseBlockScalar(lines, index + 1);
      result[key] = block.value;
      index = block.nextIndex;
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
