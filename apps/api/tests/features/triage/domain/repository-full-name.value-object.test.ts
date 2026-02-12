import { RepositoryFullName } from '../../../../src/features/triage/domain/value-objects/repository-full-name.value-object';

describe('RepositoryFullNameValueObject', () => {
  it('should create repository full name with owner and repo parts', () => {
    // Arrange
    const repositoryFullName = 'octo-org/ai-pr-sentinel';

    // Act
    const result = RepositoryFullName.create(repositoryFullName);

    // Assert
    expect(result.value).toBe('octo-org/ai-pr-sentinel');
    expect(result.owner).toBe('octo-org');
    expect(result.repo).toBe('ai-pr-sentinel');
  });

  it('should throw when repository full name format is invalid', () => {
    // Arrange
    const repositoryFullName = 'invalid-repository-name';

    // Act
    const run = () => RepositoryFullName.create(repositoryFullName);

    // Assert
    expect(run).toThrow('Invalid repository full name');
  });

  it('should parse repository full name from unknown string input', () => {
    // Arrange
    const input: unknown = 'octo-org/ai-pr-sentinel';

    // Act
    const result = RepositoryFullName.fromUnknown(input);

    // Assert
    expect(result?.value).toBe('octo-org/ai-pr-sentinel');
    expect(result?.owner).toBe('octo-org');
    expect(result?.repo).toBe('ai-pr-sentinel');
  });

  it('should return null when unknown input is not a valid repository full name', () => {
    // Arrange
    const input: unknown = 'invalid-repository-name';

    // Act
    const result = RepositoryFullName.fromUnknown(input);

    // Assert
    expect(result).toBeNull();
  });

  it('should return null when unknown input is not a string', () => {
    // Arrange
    const input: unknown = { owner: 'octo-org', repo: 'ai-pr-sentinel' };

    // Act
    const result = RepositoryFullName.fromUnknown(input);

    // Assert
    expect(result).toBeNull();
  });
});
