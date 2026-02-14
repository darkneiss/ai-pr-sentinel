import { resolveScmProviderIntegration } from '../../../../src/infrastructure/composition/scm-provider-integration.registry';

describe('ScmProviderIntegrationRegistry', () => {
  it('should resolve github integration with webhook route and provider factories', () => {
    // Arrange
    const scmProvider = 'github';

    // Act
    const integration = resolveScmProviderIntegration(scmProvider);

    // Assert
    expect(integration.webhookRoute).toBe('/webhooks/github');
    expect(typeof integration.createWebhookController).toBe('function');
    expect(typeof integration.createGovernanceGateway).toBe('function');
    expect(typeof integration.createIssueHistoryGateway).toBe('function');
    expect(typeof integration.loadRepositoryContextGatewayFactory).toBe('function');
  });
});
