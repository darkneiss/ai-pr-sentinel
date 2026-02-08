import {
  buildIssueTriageUserPrompt,
  ISSUE_TRIAGE_SYSTEM_PROMPT,
} from '../../../../src/shared/application/prompts/issue-triage.prompt';

describe('IssueTriagePrompt', () => {
  it('should expose a stable system prompt string', () => {
    // Arrange
    const expectedFragment = 'Return valid JSON only';
    const expectedGroundingFragment = 'Ground question responses in repository context';

    // Act
    const systemPrompt = ISSUE_TRIAGE_SYSTEM_PROMPT;

    // Assert
    expect(systemPrompt).toContain(expectedFragment);
    expect(systemPrompt).toContain(expectedGroundingFragment);
  });

  it('should include issue content and recent issues in user prompt', () => {
    // Arrange
    const input = {
      issueTitle: 'How can I run this locally?',
      issueBody: 'I need a setup checklist for local development.',
      recentIssues: [{ number: 12, title: 'Cannot run webhook listener' }],
    };

    // Act
    const userPrompt = buildIssueTriageUserPrompt(input);

    // Assert
    expect(userPrompt).toContain('Issue title: How can I run this locally?');
    expect(userPrompt).toContain('Issue body: I need a setup checklist for local development.');
    expect(userPrompt).toContain('#12: Cannot run webhook listener');
    expect(userPrompt).toContain('suggestedResponse is mandatory');
    expect(userPrompt).toContain('must reference concrete repository context');
    expect(userPrompt).toContain('classification.type in ["bug","feature","question"]');
    expect(userPrompt).toContain('Return only valid JSON');
  });

  it('should include "(none)" when there are no recent issues', () => {
    // Arrange
    const input = {
      issueTitle: 'Question about setup',
      issueBody: 'Need help with environment variables.',
      recentIssues: [],
    };

    // Act
    const userPrompt = buildIssueTriageUserPrompt(input);

    // Assert
    expect(userPrompt).toContain('(none)');
  });
});
