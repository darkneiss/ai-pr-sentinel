import type { IssueTriagePrompt } from '../../../../src/shared/application/ports/issue-triage-prompt-gateway.port';
import { parseIssueTriagePromptYaml } from '../../../../src/shared/infrastructure/prompts/issue-triage-prompt-parser.service';

describe('IssueTriagePromptParser', () => {
  it('should parse a minimal prompt definition', () => {
    // Arrange
    const yaml = [
      'version: "1.0.0"',
      'provider: "generic"',
      'system_prompt: |',
      '  System prompt',
      'user_prompt_template: |',
      '  Title: {{issue_title}}',
    ].join('\n');

    // Act
    const result = parseIssueTriagePromptYaml(yaml);

    // Assert
    expect(result).toEqual<IssueTriagePrompt>({
      version: '1.0.0',
      provider: 'generic',
      systemPrompt: 'System prompt',
      userPromptTemplate: 'Title: {{issue_title}}',
      outputContract: undefined,
      config: undefined,
    });
  });

  it('should parse block fields, config values, and output contract', () => {
    // Arrange
    const yaml = [
      'version: "1.1.0"',
      'provider: "ollama"',
      'config:',
      '  temperature: 0.2',
      '  max_tokens: 512',
      'system_prompt: |',
      '  System prompt line 1',
      '  System prompt line 2',
      'user_prompt_template: |',
      '  Title: {{issue_title}}',
      '  Body: {{issue_body}}',
      'output_contract: |',
      '  JSON with fields',
    ].join('\n');

    // Act
    const result = parseIssueTriagePromptYaml(yaml);

    // Assert
    expect(result).toEqual<IssueTriagePrompt>({
      version: '1.1.0',
      provider: 'ollama',
      systemPrompt: 'System prompt line 1\nSystem prompt line 2',
      userPromptTemplate: 'Title: {{issue_title}}\nBody: {{issue_body}}',
      outputContract: 'JSON with fields',
      config: {
        temperature: 0.2,
        maxTokens: 512,
      },
    });
  });

  it('should reject prompt definitions missing required fields', () => {
    // Arrange
    const yaml = [
      'version: "1.0.0"',
      'system_prompt: |',
      '  Missing provider',
      'user_prompt_template: |',
      '  Title: {{issue_title}}',
    ].join('\n');

    // Act + Assert
    expect(() => parseIssueTriagePromptYaml(yaml)).toThrow('Invalid prompt registry entry');
  });
});

  it('should keep empty output_contract values', () => {
    // Arrange
    const yaml = [
      'version: "1.0.1"',
      'provider: "generic"',
      'system_prompt: |',
      '  System prompt',
      'user_prompt_template: |',
      '  Title: {{issue_title}}',
      'output_contract:',
    ].join('\n');

    // Act
    const result = parseIssueTriagePromptYaml(yaml);

    // Assert
    expect(result.outputContract).toBe('');
  });

  it('should parse single-quoted scalars and ignore non-string output contract', () => {
    // Arrange
    const yaml = [
      "version: '1.2.0'",
      "provider: 'generic'",
      'config:',
      '  enabled: true',
      '  disabled: false',
      'system_prompt: |',
      '  System prompt',
      'user_prompt_template: |',
      '  Title: {{issue_title}}',
      'output_contract: true',
    ].join('\n');

    // Act
    const result = parseIssueTriagePromptYaml(yaml);

    // Assert
    expect(result.version).toBe('1.2.0');
    expect(result.provider).toBe('generic');
    expect(result.outputContract).toBeUndefined();
  });

  it('should skip comments and invalid lines while parsing', () => {
    // Arrange
    const yaml = [
      '# comment',
      'version: "2.0.0"',
      'provider: "generic"',
      'invalid_line_without_colon',
      'config:',
      '  label: plain',
      'system_prompt: |',
      '  System prompt',
      'user_prompt_template: |',
      '  Title: {{issue_title}}',
    ].join('\n');

    // Act
    const result = parseIssueTriagePromptYaml(yaml);

    // Assert
    expect(result.version).toBe('2.0.0');
    expect(result.provider).toBe('generic');
  });

  it('should parse camelCase maxTokens in config', () => {
    // Arrange
    const yaml = [
      'version: "3.0.0"',
      'provider: "generic"',
      'config:',
      '  maxTokens: 256',
      '  invalid_line',
      'system_prompt: |',
      '  System prompt',
      'user_prompt_template: |',
      '  Title: {{issue_title}}',
    ].join('\n');

    // Act
    const result = parseIssueTriagePromptYaml(yaml);

    // Assert
    expect(result.config?.maxTokens).toBe(256);
  });

  it('should reject prompts with non-string version values', () => {
    // Arrange
    const yaml = [
      'version: 1',
      'provider: "generic"',
      'system_prompt: |',
      '  System prompt',
      'user_prompt_template: |',
      '  Title: {{issue_title}}',
    ].join('\n');

    // Act + Assert
    expect(() => parseIssueTriagePromptYaml(yaml)).toThrow('Invalid prompt registry entry');
  });

  it('should reject prompts with non-string system_prompt', () => {
    // Arrange
    const yaml = [
      'version: "4.0.0"',
      'provider: "generic"',
      'system_prompt: 123',
      'user_prompt_template: |',
      '  Title: {{issue_title}}',
    ].join('\n');

    // Act + Assert
    expect(() => parseIssueTriagePromptYaml(yaml)).toThrow('Invalid prompt registry entry');
  });

  it('should reject prompts with non-string user_prompt_template', () => {
    // Arrange
    const yaml = [
      'version: "4.0.1"',
      'provider: "generic"',
      'system_prompt: |',
      '  System prompt',
      'user_prompt_template: 456',
    ].join('\n');

    // Act + Assert
    expect(() => parseIssueTriagePromptYaml(yaml)).toThrow('Invalid prompt registry entry');
  });
