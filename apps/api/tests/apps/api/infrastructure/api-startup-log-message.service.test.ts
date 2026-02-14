import { resolveApiStartupLogMessages } from '../../../../src/infrastructure/composition/api-startup-log-message.service';

describe('ApiStartupLogMessageService', () => {
  it('should include api version and port in startup message', () => {
    // Arrange
    const version = '0.0.1';
    const port = 3000;

    // Act
    const result = resolveApiStartupLogMessages({ version, port });

    // Assert
    expect(result.startupMessage).toBe('AI-PR-Sentinel API v0.0.1 running on port 3000');
  });

  it('should include health check URL with the current port', () => {
    // Arrange
    const version = '1.2.3';
    const port = 4100;

    // Act
    const result = resolveApiStartupLogMessages({ version, port });

    // Assert
    expect(result.healthMessage).toBe('Health check available at http://localhost:4100/health');
  });
});
