import { createApp } from '../../../../src/app';

describe('App (SCM Provider Configuration)', () => {
  const originalScmProvider = process.env.SCM_PROVIDER;

  afterEach(() => {
    process.env.SCM_PROVIDER = originalScmProvider;
    jest.clearAllMocks();
  });

  it('should fail fast when SCM_PROVIDER is unsupported', () => {
    // Arrange
    process.env.SCM_PROVIDER = 'gitlab';

    // Act + Assert
    expect(() => createApp()).toThrow(
      'Unsupported SCM provider "gitlab". Supported providers: github',
    );
  });
});
