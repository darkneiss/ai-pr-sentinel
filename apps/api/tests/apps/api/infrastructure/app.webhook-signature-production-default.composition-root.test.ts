import { createApp } from '../../../../src/app';

describe('App (Webhook Signature Production Default)', () => {
  const originalVerifySignature = process.env.SCM_WEBHOOK_VERIFY_SIGNATURE;
  const originalWebhookSecret = process.env.SCM_WEBHOOK_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.SCM_WEBHOOK_VERIFY_SIGNATURE = originalVerifySignature;
    process.env.SCM_WEBHOOK_SECRET = originalWebhookSecret;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should fail fast in production when secret is missing even without explicit override', () => {
    // Arrange
    delete process.env.SCM_WEBHOOK_VERIFY_SIGNATURE;
    process.env.NODE_ENV = 'production';
    delete process.env.SCM_WEBHOOK_SECRET;

    // Act + Assert
    expect(() => createApp()).toThrow(
      'Missing SCM_WEBHOOK_SECRET while SCM_WEBHOOK_VERIFY_SIGNATURE=true',
    );
  });
});
