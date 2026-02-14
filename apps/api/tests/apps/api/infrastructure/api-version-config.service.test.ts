import type { ConfigPort } from '../../../../src/shared/application/ports/config.port';
import { resolveApiVersion } from '../../../../src/infrastructure/composition/api-version-config.service';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const createConfigMock = (values: Record<string, string | undefined>): ConfigPort => ({
  get: (key: string): string | undefined => values[key],
  getBoolean: (_key: string): boolean | undefined => undefined,
});

describe('ApiVersionConfigService', () => {
  it('should resolve version from API_VERSION_FILE when it is configured', () => {
    // Arrange
    const tempDirectory = mkdtempSync(join(tmpdir(), 'api-version-config-'));
    const packageJsonPath = join(tempDirectory, 'package.json');
    writeFileSync(packageJsonPath, JSON.stringify({ version: '2.4.6' }), 'utf8');
    const config = createConfigMock({
      API_VERSION_FILE: packageJsonPath,
      npm_package_version: '1.2.3',
    });

    // Act
    const result = resolveApiVersion(config);

    // Assert
    expect(result).toBe('2.4.6');
  });

  it('should fallback to npm_package_version when API_VERSION_FILE is missing', () => {
    // Arrange
    const config = createConfigMock({
      npm_package_version: '1.2.3',
    });

    // Act
    const result = resolveApiVersion(config);

    // Assert
    expect(result).toBe('1.2.3');
  });

  it('should ignore API_VERSION and APP_VERSION to avoid multiple version sources', () => {
    // Arrange
    const config = createConfigMock({
      API_VERSION: '8.8.8',
      APP_VERSION: '9.9.9',
      npm_package_version: '1.2.3',
    });

    // Act
    const result = resolveApiVersion(config);

    // Assert
    expect(result).toBe('1.2.3');
  });

  it('should ignore invalid API_VERSION_FILE content and fallback to npm_package_version', () => {
    // Arrange
    const tempDirectory = mkdtempSync(join(tmpdir(), 'api-version-config-'));
    const packageJsonPath = join(tempDirectory, 'package.json');
    writeFileSync(packageJsonPath, JSON.stringify({ version: 246 }), 'utf8');
    const config = createConfigMock({
      API_VERSION_FILE: packageJsonPath,
      npm_package_version: '1.2.3',
    });

    // Act
    const result = resolveApiVersion(config);

    // Assert
    expect(result).toBe('1.2.3');
  });

  it('should ignore manifest files without version and fallback to npm_package_version', () => {
    // Arrange
    const tempDirectory = mkdtempSync(join(tmpdir(), 'api-version-config-'));
    const packageJsonPath = join(tempDirectory, 'package.json');
    writeFileSync(packageJsonPath, JSON.stringify({ name: 'api' }), 'utf8');
    const config = createConfigMock({
      API_VERSION_FILE: packageJsonPath,
      npm_package_version: '1.2.3',
    });

    // Act
    const result = resolveApiVersion(config);

    // Assert
    expect(result).toBe('1.2.3');
  });

  it('should ignore missing API_VERSION_FILE and fallback to npm_package_version', () => {
    // Arrange
    const config = createConfigMock({
      API_VERSION_FILE: '/path/that/does/not/exist/package.json',
      npm_package_version: '1.2.3',
    });

    // Act
    const result = resolveApiVersion(config);

    // Assert
    expect(result).toBe('1.2.3');
  });

  it('should fallback to default version when no version sources are configured', () => {
    // Arrange
    const config = createConfigMock({});

    // Act
    const result = resolveApiVersion(config);

    // Assert
    expect(result).toBe('0.0.1');
  });

  it('should log a warning when API_VERSION_FILE cannot be resolved', () => {
    // Arrange
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const config = createConfigMock({
      API_VERSION_FILE: '/path/that/does/not/exist/package.json',
      npm_package_version: '1.2.3',
    });

    try {
      // Act
      const result = resolveApiVersion(config);

      // Assert
      expect(result).toBe('1.2.3');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        'ApiVersionConfigService could not resolve version from API_VERSION_FILE.',
        expect.objectContaining({
          manifestPath: '/path/that/does/not/exist/package.json',
        }),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
