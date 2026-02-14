import type { ConfigPort } from '../../../../src/shared/application/ports/config.port';
import { resolveWebhookSignatureConfig } from '../../../../src/infrastructure/composition/webhook-signature-config.service';

const createConfigMock = (values: Record<string, string | undefined>): ConfigPort => ({
  get: (key: string): string | undefined => values[key],
  getBoolean: (key: string): boolean | undefined => {
    const value = values[key];
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return undefined;
  },
});

describe('WebhookSignatureConfigService (SCM env)', () => {
  it('should require SCM_WEBHOOK_SECRET when SCM_WEBHOOK_VERIFY_SIGNATURE=true', () => {
    // Arrange
    const config = createConfigMock({
      SCM_WEBHOOK_VERIFY_SIGNATURE: 'true',
      SCM_WEBHOOK_SECRET: undefined,
    });

    // Act + Assert
    expect(() => resolveWebhookSignatureConfig(config)).toThrow(
      'Missing SCM_WEBHOOK_SECRET while SCM_WEBHOOK_VERIFY_SIGNATURE=true',
    );
  });

  it('should fail fast when legacy signature secret env var is set without SCM equivalent', () => {
    // Arrange
    const config = createConfigMock({
      GITHUB_WEBHOOK_SECRET: 'legacy-secret',
      SCM_WEBHOOK_SECRET: undefined,
    });

    // Act + Assert
    expect(() => resolveWebhookSignatureConfig(config)).toThrow(
      'Legacy env var GITHUB_WEBHOOK_SECRET is no longer supported. Use SCM_WEBHOOK_SECRET.',
    );
  });
});
