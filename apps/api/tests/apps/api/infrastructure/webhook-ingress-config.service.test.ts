import type { ConfigPort } from '../../../../src/shared/application/ports/config.port';
import { resolveWebhookIngressConfig } from '../../../../src/infrastructure/composition/webhook-ingress-config.service';

const createConfigMock = (values: Record<string, string | undefined>): ConfigPort => ({
  get: (key: string): string | undefined => values[key],
  getBoolean: (key: string): boolean | undefined => {
    const value = values[key];
    if (value === undefined) {
      return undefined;
    }

    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return undefined;
  },
});

describe('WebhookIngressConfigService', () => {
  it('should resolve defaults when ingress env vars are not set', () => {
    // Arrange
    const config = createConfigMock({});

    // Act
    const result = resolveWebhookIngressConfig(config);

    // Assert
    expect(result).toEqual({
      allowedRepositories: [],
      strictRepositoryAllowlist: false,
      requireDeliveryId: false,
      deliveryTtlSeconds: 86400,
    });
  });

  it('should parse allowlist, strict mode, required delivery id, and custom ttl', () => {
    // Arrange
    const config = createConfigMock({
      SCM_WEBHOOK_ALLOWED_REPOSITORIES: 'org/repo, org/another-repo',
      SCM_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST: 'true',
      SCM_WEBHOOK_REQUIRE_DELIVERY_ID: 'true',
      SCM_WEBHOOK_DELIVERY_TTL_SECONDS: '7200',
    });

    // Act
    const result = resolveWebhookIngressConfig(config);

    // Assert
    expect(result).toEqual({
      allowedRepositories: ['org/repo', 'org/another-repo'],
      strictRepositoryAllowlist: true,
      requireDeliveryId: true,
      deliveryTtlSeconds: 7200,
    });
  });

  it('should fallback to default ttl when ttl env var is invalid', () => {
    // Arrange
    const config = createConfigMock({
      SCM_WEBHOOK_DELIVERY_TTL_SECONDS: '-1',
    });

    // Act
    const result = resolveWebhookIngressConfig(config);

    // Assert
    expect(result.deliveryTtlSeconds).toBe(86400);
  });

  it('should fallback to default ttl when ttl env var is zero', () => {
    // Arrange
    const config = createConfigMock({
      SCM_WEBHOOK_DELIVERY_TTL_SECONDS: '0',
    });

    // Act
    const result = resolveWebhookIngressConfig(config);

    // Assert
    expect(result.deliveryTtlSeconds).toBe(86400);
  });

  it('should fallback to default ttl when ttl env var has partially numeric format', () => {
    // Arrange
    const configWithScientificNotation = createConfigMock({
      SCM_WEBHOOK_DELIVERY_TTL_SECONDS: '1e6',
    });
    const configWithUnitSuffix = createConfigMock({
      SCM_WEBHOOK_DELIVERY_TTL_SECONDS: '3600s',
    });

    // Act
    const scientificNotationResult = resolveWebhookIngressConfig(configWithScientificNotation);
    const unitSuffixResult = resolveWebhookIngressConfig(configWithUnitSuffix);

    // Assert
    expect(scientificNotationResult.deliveryTtlSeconds).toBe(86400);
    expect(unitSuffixResult.deliveryTtlSeconds).toBe(86400);
  });

  it('should fail fast when legacy ingress env var is set without SCM equivalent', () => {
    // Arrange
    const config = createConfigMock({
      GITHUB_WEBHOOK_ALLOWED_REPOSITORIES: 'org/repo',
      SCM_WEBHOOK_ALLOWED_REPOSITORIES: undefined,
    });

    // Act + Assert
    expect(() => resolveWebhookIngressConfig(config)).toThrow(
      'Legacy env var GITHUB_WEBHOOK_ALLOWED_REPOSITORIES is no longer supported. Use SCM_WEBHOOK_ALLOWED_REPOSITORIES.',
    );
  });

  it('should fail fast in production when allowlist is empty', () => {
    // Arrange
    const config = createConfigMock({
      NODE_ENV: 'production',
      SCM_WEBHOOK_ALLOWED_REPOSITORIES: '',
      SCM_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST: 'true',
      SCM_WEBHOOK_REQUIRE_DELIVERY_ID: 'true',
    });

    // Act + Assert
    expect(() => resolveWebhookIngressConfig(config)).toThrow(
      'Production security policy violations:\n- SCM_WEBHOOK_ALLOWED_REPOSITORIES must include at least one repository in production.',
    );
  });

  it('should fail fast in production when strict allowlist is disabled', () => {
    // Arrange
    const config = createConfigMock({
      NODE_ENV: 'production',
      SCM_WEBHOOK_ALLOWED_REPOSITORIES: 'org/repo',
      SCM_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST: 'false',
      SCM_WEBHOOK_REQUIRE_DELIVERY_ID: 'true',
    });

    // Act + Assert
    expect(() => resolveWebhookIngressConfig(config)).toThrow(
      'Production security policy violations:\n- SCM_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST must be true in production.',
    );
  });

  it('should fail fast in production when delivery id requirement is disabled', () => {
    // Arrange
    const config = createConfigMock({
      NODE_ENV: 'production',
      SCM_WEBHOOK_ALLOWED_REPOSITORIES: 'org/repo',
      SCM_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST: 'true',
      SCM_WEBHOOK_REQUIRE_DELIVERY_ID: 'false',
    });

    // Act + Assert
    expect(() => resolveWebhookIngressConfig(config)).toThrow(
      'Production security policy violations:\n- SCM_WEBHOOK_REQUIRE_DELIVERY_ID must be true in production.',
    );
  });

  it('should fail fast in production with aggregated security policy violations', () => {
    // Arrange
    const config = createConfigMock({
      NODE_ENV: 'production',
      SCM_WEBHOOK_ALLOWED_REPOSITORIES: '',
      SCM_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST: 'false',
      SCM_WEBHOOK_REQUIRE_DELIVERY_ID: 'false',
    });

    // Act + Assert
    expect(() => resolveWebhookIngressConfig(config)).toThrow(
      'Production security policy violations:\n- SCM_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST must be true in production.\n- SCM_WEBHOOK_REQUIRE_DELIVERY_ID must be true in production.\n- SCM_WEBHOOK_ALLOWED_REPOSITORIES must include at least one repository in production.',
    );
  });

  it('should enforce secure defaults in production when explicit booleans are not provided', () => {
    // Arrange
    const config = createConfigMock({
      NODE_ENV: 'production',
      SCM_WEBHOOK_ALLOWED_REPOSITORIES: 'org/repo',
    });

    // Act
    const result = resolveWebhookIngressConfig(config);

    // Assert
    expect(result).toEqual({
      allowedRepositories: ['org/repo'],
      strictRepositoryAllowlist: true,
      requireDeliveryId: true,
      deliveryTtlSeconds: 86400,
    });
  });
});
