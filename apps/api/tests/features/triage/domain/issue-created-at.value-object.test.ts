import { IssueCreatedAt } from '../../../../src/features/triage/domain/value-objects/issue-created-at.value-object';

describe('IssueCreatedAtValueObject', () => {
  it('should expose the same date value when valid', () => {
    // Arrange
    const createdAt = new Date('2026-02-11T10:00:00.000Z');

    // Act
    const issueCreatedAt = IssueCreatedAt.create(createdAt);

    // Assert
    expect(issueCreatedAt.value.toISOString()).toBe('2026-02-11T10:00:00.000Z');
  });

  it('should throw when date is invalid', () => {
    // Arrange
    const invalidDate = new Date(Number.NaN);
    const act = (): void => {
      IssueCreatedAt.create(invalidDate);
    };

    // Act
    // Assert
    expect(act).toThrow('Invalid issue createdAt date');
  });
});
