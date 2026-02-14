import type { ConfigPort } from '../../../../src/shared/application/ports/config.port';
import { resolveApiPort } from '../../../../src/infrastructure/composition/api-port-config.service';

const createConfigMock = (values: Record<string, string | undefined>): ConfigPort => ({
  get: (key: string): string | undefined => values[key],
  getBoolean: (_key: string): boolean | undefined => undefined,
});

describe('ApiPortConfigService', () => {
  it('should resolve API_PORT when it is a valid positive integer', () => {
    // Arrange
    const config = createConfigMock({
      API_PORT: '4100',
    });

    // Act
    const result = resolveApiPort(config);

    // Assert
    expect(result).toBe(4100);
  });

  it('should resolve default port when API_PORT is missing', () => {
    // Arrange
    const config = createConfigMock({});

    // Act
    const result = resolveApiPort(config);

    // Assert
    expect(result).toBe(3000);
  });

  it('should resolve default port when API_PORT is not a valid integer', () => {
    // Arrange
    const config = createConfigMock({
      API_PORT: 'invalid-value',
    });

    // Act
    const result = resolveApiPort(config);

    // Assert
    expect(result).toBe(3000);
  });

  it('should resolve default port when API_PORT is zero', () => {
    // Arrange
    const config = createConfigMock({
      API_PORT: '0',
    });

    // Act
    const result = resolveApiPort(config);

    // Assert
    expect(result).toBe(3000);
  });
});
