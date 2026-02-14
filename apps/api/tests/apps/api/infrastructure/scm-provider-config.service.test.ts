import type { ConfigPort } from '../../../../src/shared/application/ports/config.port';
import { resolveScmProvider } from '../../../../src/infrastructure/composition/scm-provider-config.service';

const createConfigMock = (values: Record<string, string | undefined>): ConfigPort => ({
  get: (key: string): string | undefined => values[key],
  getBoolean: (_key: string): boolean | undefined => undefined,
});

describe('ScmProviderConfigService', () => {
  it('should resolve github by default when SCM_PROVIDER is missing', () => {
    // Arrange
    const config = createConfigMock({});

    // Act
    const result = resolveScmProvider(config);

    // Assert
    expect(result).toBe('github');
  });

  it('should resolve github when SCM_PROVIDER is uppercase with extra spaces', () => {
    // Arrange
    const config = createConfigMock({
      SCM_PROVIDER: '  GITHUB  ',
    });

    // Act
    const result = resolveScmProvider(config);

    // Assert
    expect(result).toBe('github');
  });

  it('should resolve github by default when SCM_PROVIDER is an empty string', () => {
    // Arrange
    const config = createConfigMock({
      SCM_PROVIDER: '   ',
    });

    // Act
    const result = resolveScmProvider(config);

    // Assert
    expect(result).toBe('github');
  });

  it('should fail fast when SCM_PROVIDER is unsupported', () => {
    // Arrange
    const config = createConfigMock({
      SCM_PROVIDER: 'gitlab',
    });

    // Act + Assert
    expect(() => resolveScmProvider(config)).toThrow(
      'Unsupported SCM provider "gitlab". Supported providers: github',
    );
  });
});
