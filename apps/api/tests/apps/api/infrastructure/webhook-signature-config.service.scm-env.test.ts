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
});
