import { createStaticRepositoryAuthorizationAdapter } from '../../../../src/features/triage/infrastructure/adapters/static-repository-authorization.adapter';

describe('StaticRepositoryAuthorizationAdapter', () => {
  it('should allow any repository when allowlist is empty and strict mode is disabled', () => {
    // Arrange
    const adapter = createStaticRepositoryAuthorizationAdapter({
      allowedRepositories: [],
      strictAllowlist: false,
    });

    // Act
    const result = adapter.isAllowed('org/repo');

    // Assert
    expect(result).toBe(true);
  });

  it('should block repositories when allowlist is empty and strict mode is enabled', () => {
    // Arrange
    const adapter = createStaticRepositoryAuthorizationAdapter({
      allowedRepositories: [],
      strictAllowlist: true,
    });

    // Act
    const result = adapter.isAllowed('org/repo');

    // Assert
    expect(result).toBe(false);
  });

  it('should allow only repositories configured in allowlist', () => {
    // Arrange
    const adapter = createStaticRepositoryAuthorizationAdapter({
      allowedRepositories: ['org/repo', 'org/another-repo'],
      strictAllowlist: true,
    });

    // Act
    const isAllowed = adapter.isAllowed('Org/Repo');
    const isDenied = adapter.isAllowed('org/not-allowed');

    // Assert
    expect(isAllowed).toBe(true);
    expect(isDenied).toBe(false);
  });
});
