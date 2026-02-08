import { buildIssueTriageUserPrompt } from '../../../../src/shared/application/prompts/issue-triage.prompt';

describe('IssueTriagePrompt repository context', () => {
  it('should include README context when provided', () => {
    // Arrange
    const input = {
      issueTitle: 'How do I run this?',
      issueBody: 'Need setup instructions',
      repositoryReadme: '# Setup\nUse pnpm install',
      recentIssues: [],
    };

    // Act
    const prompt = buildIssueTriageUserPrompt(input);

    // Assert
    expect(prompt).toContain('Repository context (README excerpt):');
    expect(prompt).toContain('# Setup\nUse pnpm install');
  });

  it('should show (none) when README context is missing', () => {
    // Arrange
    const input = {
      issueTitle: 'How do I run this?',
      issueBody: 'Need setup instructions',
      recentIssues: [],
    };

    // Act
    const prompt = buildIssueTriageUserPrompt(input);

    // Assert
    expect(prompt).toContain('Repository context (README excerpt):');
    expect(prompt).toContain('(none)');
  });
});
