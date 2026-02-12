import { IssueId } from '../../../../src/features/triage/domain/value-objects/issue-id.value-object';

describe('IssueIdValueObject', () => {
  it('should expose raw and normalized values', () => {
    // Arrange
    const rawValue = '  org/repo#123  ';

    // Act
    const issueId = IssueId.create(rawValue);

    // Assert
    expect(issueId.value).toBe(rawValue);
    expect(issueId.normalizedValue).toBe('org/repo#123');
  });

  it('should report whether id has text', () => {
    // Arrange
    const issueId = IssueId.create('   ');

    // Act
    const hasText = issueId.hasText();

    // Assert
    expect(hasText).toBe(false);
  });
});
