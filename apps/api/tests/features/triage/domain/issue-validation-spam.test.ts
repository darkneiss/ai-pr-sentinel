import type { Issue } from '../../../../src/features/triage/domain/entities/issue.entity';
import { SPAM_ERROR_MESSAGE } from '../../../../src/features/triage/domain/constants/issue-validation.constants';
import { validateIssueIntegrity } from '../../../../src/features/triage/domain/services/issue-validation.service';

const createIssue = (overrides: Partial<Issue> = {}): Issue => ({
  id: 'ISSUE-SPAM-TEST',
  title: 'Valid title for testing',
  description: 'Valid description for testing purposes that is long enough.',
  author: 'tester',
  createdAt: new Date(),
  ...overrides,
});

describe('IssueValidationService Spam Detection', () => {
  it('should reject when title contains spam keywords', () => {
    // Arrange
    const issue = createIssue({
      title: 'Win free money at the casino!!!',
    });

    // Act
    const result = validateIssueIntegrity(issue);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SPAM_ERROR_MESSAGE);
  });

  it('should reject when description contains spam keywords', () => {
    // Arrange
    const issue = createIssue({
      description: 'Check this out to buy cheap rolex watches now.',
    });

    // Act
    const result = validateIssueIntegrity(issue);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SPAM_ERROR_MESSAGE);
  });

  it('should reject spam content case-insensitively', () => {
    // Arrange
    const issue = createIssue({
      title: 'CAsiNo deals for everyone',
    });

    // Act
    const result = validateIssueIntegrity(issue);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SPAM_ERROR_MESSAGE);
  });

  it('should reject when content includes crypto giveaway spam', () => {
    // Arrange
    const issue = createIssue({
      description: 'Join this CRYPTO GIVEAWAY and claim your reward.',
    });

    // Act
    const result = validateIssueIntegrity(issue);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SPAM_ERROR_MESSAGE);
  });

  it('should reject when content includes common spanish spam phrase', () => {
    // Arrange
    const issue = createIssue({
      title: 'Aprende a trabajar desde casa ya',
    });

    // Act
    const result = validateIssueIntegrity(issue);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SPAM_ERROR_MESSAGE);
  });

  it('should reject when content includes common english spam phrase', () => {
    // Arrange
    const issue = createIssue({
      description: 'Earn dollars now and work from home with this method.',
    });

    // Act
    const result = validateIssueIntegrity(issue);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SPAM_ERROR_MESSAGE);
  });

  it('should add spam error only once when both title and description are spam', () => {
    // Arrange
    const issue = createIssue({
      title: 'Free money from casino',
      description: 'Buy cheap rolex watches now from this casino',
    });

    // Act
    const result = validateIssueIntegrity(issue);

    // Assert
    const spamErrors = result.errors.filter((error) => error === SPAM_ERROR_MESSAGE);
    expect(spamErrors).toHaveLength(1);
  });

  it('should not flag safe content as spam', () => {
    // Arrange
    const issue = createIssue({
      title: 'Bug in the login form',
      description: 'The money symbol is not showing in the dashboard.',
    });

    // Act
    const result = validateIssueIntegrity(issue);

    // Assert
    const spamError = result.errors.find((error) => error === SPAM_ERROR_MESSAGE);
    expect(spamError).toBeUndefined();
    expect(result.isValid).toBe(true);
  });
});
