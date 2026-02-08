import { createEnvConfig } from '../../../../src/shared/infrastructure/config/env-config.adapter';

describe('EnvConfigAdapter', () => {
  it('should read string values from process env', () => {
    // Arrange
    const previousValue = process.env.TEST_CONFIG_VALUE;
    process.env.TEST_CONFIG_VALUE = 'hello';
    const config = createEnvConfig();

    try {
      // Act
      const value = config.get('TEST_CONFIG_VALUE');

      // Assert
      expect(value).toBe('hello');
    } finally {
      process.env.TEST_CONFIG_VALUE = previousValue;
    }
  });

  it('should parse boolean values using normalized string values', () => {
    // Arrange
    const previousValue = process.env.TEST_CONFIG_BOOLEAN;
    process.env.TEST_CONFIG_BOOLEAN = ' TrUe ';
    const config = createEnvConfig();

    try {
      // Act
      const value = config.getBoolean('TEST_CONFIG_BOOLEAN');

      // Assert
      expect(value).toBe(true);
    } finally {
      process.env.TEST_CONFIG_BOOLEAN = previousValue;
    }
  });

  it('should return undefined for invalid boolean values', () => {
    // Arrange
    const previousValue = process.env.TEST_CONFIG_BOOLEAN;
    process.env.TEST_CONFIG_BOOLEAN = 'invalid';
    const config = createEnvConfig();

    try {
      // Act
      const value = config.getBoolean('TEST_CONFIG_BOOLEAN');

      // Assert
      expect(value).toBeUndefined();
    } finally {
      process.env.TEST_CONFIG_BOOLEAN = previousValue;
    }
  });
});
