import type { ConfigPort } from '../../../../src/shared/application/ports/config.port';
import { resolveApiVersion } from '../../../../src/infrastructure/composition/api-version-config.service';

const createConfigMock = (values: Record<string, string | undefined>): ConfigPort => ({
  get: (key: string): string | undefined => values[key],
  getBoolean: (_key: string): boolean | undefined => undefined,
});

describe('ApiVersionConfigService', () => {
  it('should resolve API_VERSION when it is configured', () => {
    // Arrange
    const config = createConfigMock({
      API_VERSION: '8.8.8',
      APP_VERSION: '9.9.9',
      npm_package_version: '1.2.3',
    });

    // Act
    const result = resolveApiVersion(config);

    // Assert
    expect(result).toBe('8.8.8');
  });

  it('should fallback to APP_VERSION when API_VERSION is missing', () => {
    // Arrange
    const config = createConfigMock({
      APP_VERSION: '9.9.9',
      npm_package_version: '1.2.3',
    });

    // Act
    const result = resolveApiVersion(config);

    // Assert
    expect(result).toBe('9.9.9');
  });

  it('should fallback to npm_package_version when API_VERSION and APP_VERSION are missing', () => {
    // Arrange
    const config = createConfigMock({
      npm_package_version: '1.2.3',
    });

    // Act
    const result = resolveApiVersion(config);

    // Assert
    expect(result).toBe('1.2.3');
  });

  it('should fallback to default version when no version variables are configured', () => {
    // Arrange
    const config = createConfigMock({});

    // Act
    const result = resolveApiVersion(config);

    // Assert
    expect(result).toBe('0.0.1');
  });
});
