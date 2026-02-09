import { renderIssueTriageUserPrompt } from '../../../../src/shared/application/prompts/issue-triage-prompt.builder';

describe('IssueTriagePromptBuilder', () => {
  it('should replace template variables with sanitized values', () => {
    // Arrange
    const template = [
      'Title: {{issue_title}}',
      'Body: {{issue_body}}',
      'Repo: {{repository_context}}',
      'Recent: {{recent_issues}}',
    ].join('\n');

    // Act
    const prompt = renderIssueTriageUserPrompt({
      template,
      issueTitle: 'What is this repo?\u0007',
      issueBody: 'Need help with setup\u0000',
      repositoryContext: 'README content',
      recentIssues: [{ number: 10, title: 'Old issue' }],
    });

    // Assert
    expect(prompt).toContain('Title: What is this repo?');
    expect(prompt).toContain('Body: Need help with setup');
    expect(prompt).toContain('Repo: README content');
    expect(prompt).toContain('Recent: #10: Old issue');
    expect(prompt).not.toContain('\u0007');
    expect(prompt).not.toContain('\u0000');
  });

  it('should render "(none)" when repository context is empty', () => {
    // Arrange
    const template = 'Repo: {{repository_context}}';

    // Act
    const prompt = renderIssueTriageUserPrompt({
      template,
      issueTitle: 'Title',
      issueBody: 'Body',
      repositoryContext: '   ',
      recentIssues: [],
    });

    // Assert
    expect(prompt).toContain('Repo: (none)');
  });
});
