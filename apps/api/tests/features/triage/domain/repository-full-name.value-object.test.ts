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
});
