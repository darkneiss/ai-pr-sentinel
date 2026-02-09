import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  comparePromptVersions,
  createIssueTriagePromptRegistry,
} from '../../../../src/shared/infrastructure/prompts/issue-triage-prompt-registry.adapter';

const FIXTURES_PATH = path.join(__dirname, '../../../fixtures/prompts/issue-triage');

describe('IssueTriagePromptRegistry', () => {
  it('should return provider-specific prompt when available', () => {
    // Arrange
    const registry = createIssueTriagePromptRegistry({ basePath: FIXTURES_PATH });

    // Act
    const prompt = registry.getPrompt({ provider: 'groq', version: '1.0.0' });

    // Assert
    expect(prompt.provider).toBe('groq');
    expect(prompt.version).toBe('1.0.0');
    expect(prompt.systemPrompt).toContain('System prompt groq');
  });

  it('should fallback to generic prompt when provider variant is missing', () => {
    // Arrange
    const registry = createIssueTriagePromptRegistry({ basePath: FIXTURES_PATH });

    // Act
    const prompt = registry.getPrompt({ provider: 'gemini', version: '1.0.0' });

    // Assert
    expect(prompt.provider).toBe('generic');
    expect(prompt.version).toBe('1.0.0');
  });

  it('should choose the highest available version when version is not provided', () => {
    // Arrange
    const registry = createIssueTriagePromptRegistry({ basePath: FIXTURES_PATH });

    // Act
    const prompt = registry.getPrompt({ provider: 'ollama' });

    // Assert
    expect(prompt.version).toBe('1.1.0');
  });

  it('should map max_tokens config into maxTokens', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v1.2.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "1.2.0"',
        'provider: "generic"',
        'config:',
        '  max_tokens: 512',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.config?.maxTokens).toBe(512);
  });

  it('should map maxTokens when provided in camelCase config', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v1.3.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "1.3.0"',
        'provider: "generic"',
        'config:',
        '  maxTokens: 640',
        '  label: \"quoted\"',
        '  invalid_config_line',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.config?.maxTokens).toBe(640);
  });

  it('should parse quoted scalar values in top-level fields', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v2.0.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: \"2.0.0\"',
        'provider: \"generic\"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        'output_contract: \"Quoted contract\"',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.outputContract).toBe('Quoted contract');
  });

  it('should parse single-quoted scalar values', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v2.1.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        "version: '2.1.0'",
        "provider: 'generic'",
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        "output_contract: 'Single quoted'",
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.outputContract).toBe('Single quoted');
  });

  it('should resolve base path from config when provided', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v1.0.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "1.0.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({
      config: {
        get: (key: string) => (key === 'PROMPT_REGISTRY_PATH' ? tempDir : undefined),
        getBoolean: () => undefined,
      },
    });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.version).toBe('1.0.0');
  });

  it('should parse config blocks with numeric values', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.0.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.0.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        'config:',
        '  temperature: 0.25',
        '  max_tokens: 512',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.config?.temperature).toBe(0.25);
    expect(prompt.config?.maxTokens).toBe(512);
  });

  it('should ignore non-matching config lines while keeping valid entries', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.0.1.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.0.1"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        'config:',
        '  not a config line',
        '  temperature: 0.4',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.config?.temperature).toBe(0.4);
  });

  it('should throw when provider is not a string', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.1.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.1.0"',
        'provider: 123',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );

    // Act + Assert
    expect(() => createIssueTriagePromptRegistry({ basePath: tempDir })).toThrow(
      'Invalid prompt registry entry: missing required fields',
    );
  });

  it('should throw when system prompt is not a string', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.2.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.2.0"',
        'provider: "generic"',
        'system_prompt: 42',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );

    // Act + Assert
    expect(() => createIssueTriagePromptRegistry({ basePath: tempDir })).toThrow(
      'Invalid prompt registry entry: missing required fields',
    );
  });

  it('should parse empty scalar values as empty strings', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.3.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.3.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        'output_contract:',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.outputContract).toBe('');
  });

  it('should parse config keys with empty scalar values', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.3.1.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.3.1"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        'config:',
        '  max_tokens:',
        '  temperature:',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.config?.maxTokens).toBeUndefined();
    expect(prompt.config?.temperature).toBeUndefined();
  });

  it('should compare versions with different segment lengths', () => {
    // Arrange
    const left = '1';
    const right = '1.0.1';

    // Act
    const result = comparePromptVersions(left, right);

    // Assert
    expect(result).toBeLessThan(0);
  });

  it('should compare versions when right side has fewer segments', () => {
    // Arrange
    const left = '1.2.3';
    const right = '1';

    // Act
    const result = comparePromptVersions(left, right);

    // Assert
    expect(result).toBeGreaterThan(0);
  });

  it('should accept unknown top-level keys without failing', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.4.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.4.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        'misc: value',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.version).toBe('3.4.0');
  });

  it('should resolve default registry using repo prompt assets when no params are provided', () => {
    // Arrange
    const registry = createIssueTriagePromptRegistry();

    // Act
    const prompt = registry.getPrompt({ provider: 'generic' });

    // Assert
    expect(prompt.systemPrompt.length).toBeGreaterThan(0);
  });

  it('should throw when prompt registry path does not exist', () => {
    // Arrange
    const missingPath = path.join(os.tmpdir(), 'missing-prompt-registry');

    // Act + Assert
    expect(() => createIssueTriagePromptRegistry({ basePath: missingPath })).toThrow(
      'Prompt registry path does not exist',
    );
  });

  it('should throw when prompt entry is missing required fields', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v1.0.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "1.0.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
      ].join('\n'),
    );

    // Act + Assert
    expect(() => createIssueTriagePromptRegistry({ basePath: tempDir })).toThrow(
      'Invalid prompt registry entry',
    );
  });

  it('should reject non-string version values', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v1.0.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: 1',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );

    // Act + Assert
    expect(() => createIssueTriagePromptRegistry({ basePath: tempDir })).toThrow(
      'Invalid prompt registry entry',
    );
  });

  it('should use dist path when src path is missing', () => {
    // Arrange
    const originalCwd = process.cwd();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const distPath = path.join(tempDir, 'dist/shared/application/prompts/issue-triage');
    fs.mkdirSync(distPath, { recursive: true });
    fs.writeFileSync(
      path.join(distPath, 'issue-triage.v1.0.0.generic.yaml'),
      [
        'version: "1.0.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );

    process.chdir(tempDir);

    try {
      // Act
      const registry = createIssueTriagePromptRegistry({
        config: {
          get: () => undefined,
          getBoolean: () => undefined,
        },
      });
      const prompt = registry.getPrompt();

      // Assert
      expect(prompt.version).toBe('1.0.0');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should ignore non-matching filenames in registry', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    fs.writeFileSync(path.join(tempDir, 'README.txt'), 'not a prompt');
    fs.writeFileSync(
      path.join(tempDir, 'issue-triage.v1.0.0.generic.yaml'),
      [
        'version: "1.0.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );

    // Act
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.version).toBe('1.0.0');
  });

  it('should throw when no prompts exist for provider or generic', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    fs.writeFileSync(
      path.join(tempDir, 'issue-triage.v1.0.0.groq.yaml'),
      [
        'version: "1.0.0"',
        'provider: "groq"',
        'system_prompt: |',
        '  System prompt groq',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act + Assert
    expect(() => registry.getPrompt({ provider: 'ollama' })).toThrow('No prompts available');
  });

  it('should throw when version is not found for provider', () => {
    // Arrange
    const registry = createIssueTriagePromptRegistry({ basePath: FIXTURES_PATH });

    // Act + Assert
    expect(() => registry.getPrompt({ provider: 'groq', version: '9.9.9' })).toThrow(
      'Prompt version "9.9.9" not found',
    );
  });

  it('should prefer stable version over prerelease when core is equal', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    fs.writeFileSync(
      path.join(tempDir, 'issue-triage.v1.2.0-beta.ollama.yaml'),
      [
        'version: "1.2.0-beta"',
        'provider: "ollama"',
        'system_prompt: |',
        '  System prompt ollama beta',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(tempDir, 'issue-triage.v1.2.0.ollama.yaml'),
      [
        'version: "1.2.0"',
        'provider: "ollama"',
        'system_prompt: |',
        '  System prompt ollama stable',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt({ provider: 'ollama' });

    // Assert
    expect(prompt.version).toBe('1.2.0');
  });

  it('should compare prompt versions consistently', () => {
    // Arrange + Act + Assert
    expect(comparePromptVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
    expect(comparePromptVersions('1.0.0', '1.0.0')).toBe(0);
    expect(comparePromptVersions('1.0.0', '1.0.0-beta')).toBeGreaterThan(0);
    expect(comparePromptVersions('1.0.0-beta', '1.0.0')).toBeLessThan(0);
    expect(comparePromptVersions('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
  });

  it('should use src path when available', () => {
    // Arrange
    const originalCwd = process.cwd();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const srcPath = path.join(tempDir, 'src/shared/application/prompts/issue-triage');
    fs.mkdirSync(srcPath, { recursive: true });
    fs.writeFileSync(
      path.join(srcPath, 'issue-triage.v1.0.0.generic.yaml'),
      [
        'version: "1.0.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    process.chdir(tempDir);

    try {
      // Act
      const registry = createIssueTriagePromptRegistry({
        config: {
          get: () => undefined,
          getBoolean: () => undefined,
        },
      });
      const prompt = registry.getPrompt();

      // Assert
      expect(prompt.version).toBe('1.0.0');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should default to src path when neither src nor dist exist', () => {
    // Arrange
    const originalCwd = process.cwd();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    process.chdir(tempDir);

    try {
      // Act + Assert
      expect(() =>
        createIssueTriagePromptRegistry({
          config: {
            get: () => undefined,
            getBoolean: () => undefined,
          },
        }),
      ).toThrow('Prompt registry path does not exist');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should create registry without explicit config', () => {
    // Arrange
    const previousProvider = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = 'generic';

    try {
      // Act
      const registry = createIssueTriagePromptRegistry({ basePath: FIXTURES_PATH });
      const prompt = registry.getPrompt();

      // Assert
      expect(prompt.provider).toBe('generic');
    } finally {
      process.env.LLM_PROVIDER = previousProvider;
    }
  });
});
