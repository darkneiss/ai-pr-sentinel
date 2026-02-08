import { createEnvLogger } from '../../../../src/shared/infrastructure/logging/env-logger';

interface MockSink {
  debug: jest.Mock<void, unknown[]>;
  info: jest.Mock<void, unknown[]>;
  warn: jest.Mock<void, unknown[]>;
  error: jest.Mock<void, unknown[]>;
}

const createMockSink = (): MockSink => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('EnvLogger', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousLogLevel = process.env.LOG_LEVEL;

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
    process.env.LOG_LEVEL = previousLogLevel;
    jest.clearAllMocks();
  });

  it('should log debug/info/warn/error when level is debug', () => {
    // Arrange
    const sink = createMockSink();
    const logger = createEnvLogger({ level: 'debug', sink });

    // Act
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    // Assert
    expect(sink.debug).toHaveBeenCalledWith('debug message');
    expect(sink.info).toHaveBeenCalledWith('info message');
    expect(sink.warn).toHaveBeenCalledWith('warn message');
    expect(sink.error).toHaveBeenCalledWith('error message');
  });

  it('should suppress debug logs when configured level is info', () => {
    // Arrange
    const sink = createMockSink();
    const logger = createEnvLogger({ level: 'info', sink });

    // Act
    logger.debug('debug message');
    logger.info('info message');

    // Assert
    expect(sink.debug).not.toHaveBeenCalled();
    expect(sink.info).toHaveBeenCalledWith('info message');
  });

  it('should use LOG_LEVEL environment variable when explicit level is missing', () => {
    // Arrange
    process.env.LOG_LEVEL = 'warn';
    const sink = createMockSink();
    const logger = createEnvLogger({ sink });

    // Act
    logger.info('info message');
    logger.warn('warn message');

    // Assert
    expect(sink.info).not.toHaveBeenCalled();
    expect(sink.warn).toHaveBeenCalledWith('warn message');
  });

  it('should default to info in production when LOG_LEVEL is not set', () => {
    // Arrange
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'production';
    const sink = createMockSink();
    const logger = createEnvLogger({ sink });

    // Act
    logger.debug('debug message');
    logger.info('info message');

    // Assert
    expect(sink.debug).not.toHaveBeenCalled();
    expect(sink.info).toHaveBeenCalledWith('info message');
  });

  it('should default to debug outside production when LOG_LEVEL is invalid', () => {
    // Arrange
    process.env.LOG_LEVEL = 'verbose';
    process.env.NODE_ENV = 'development';
    const sink = createMockSink();
    const logger = createEnvLogger({ sink });

    // Act
    logger.debug('debug message');

    // Assert
    expect(sink.debug).toHaveBeenCalledWith('debug message');
  });

  it('should pass context values to sink methods', () => {
    // Arrange
    const sink = createMockSink();
    const logger = createEnvLogger({ level: 'error', sink });

    // Act
    logger.error('error message', { code: 'E_TEST' }, 'extra');

    // Assert
    expect(sink.error).toHaveBeenCalledWith('error message', { code: 'E_TEST' }, 'extra');
  });

  it('should default to error in test environment when LOG_LEVEL is not set', () => {
    // Arrange
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'test';
    const sink = createMockSink();
    const logger = createEnvLogger({ sink });

    // Act
    logger.warn('warn message');
    logger.error('error message');

    // Assert
    expect(sink.warn).not.toHaveBeenCalled();
    expect(sink.error).toHaveBeenCalledWith('error message');
  });

  it('should default to debug when NODE_ENV is undefined and LOG_LEVEL is not set', () => {
    // Arrange
    delete process.env.LOG_LEVEL;
    delete process.env.NODE_ENV;
    const sink = createMockSink();
    const logger = createEnvLogger({ sink });

    // Act
    logger.debug('debug message');

    // Assert
    expect(sink.debug).toHaveBeenCalledWith('debug message');
  });
});
