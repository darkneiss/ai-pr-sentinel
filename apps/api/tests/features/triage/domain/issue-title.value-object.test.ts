import { IssueTitle } from '../../../../src/features/triage/domain/value-objects/issue-title.value-object';

describe('IssueTitleValueObject', () => {
  it('should expose raw and normalized values', () => {
    // Arrange
    const rawValue = '  Bug: Login crash on refresh  ';

    // Act
    const issueTitle = IssueTitle.create(rawValue);

    // Assert
    expect(issueTitle.value).toBe(rawValue);
    expect(issueTitle.normalizedValue).toBe('Bug: Login crash on refresh');
  });

  it('should report title text and minimum length checks', () => {
    // Arrange
    const issueTitle = IssueTitle.create('  short  ');

    // Act
    const hasText = issueTitle.hasText();
    const hasMinimumLength = issueTitle.hasMinLength(10);

    // Assert
    expect(hasText).toBe(true);
    expect(hasMinimumLength).toBe(false);
  });
});
