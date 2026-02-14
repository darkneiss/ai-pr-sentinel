import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import { createLazyGovernanceGateway } from '../../../../src/infrastructure/composition/lazy-governance-gateway.factory';

const createEnvConfigMock = jest.fn();
const resolveScmProviderMock = jest.fn();
const resolveScmProviderIntegrationMock = jest.fn();
const createProviderGovernanceGatewayMock = jest.fn();

jest.mock('../../../../src/shared/infrastructure/config/env-config.adapter', () => ({
  createEnvConfig: () => createEnvConfigMock(),
}));
jest.mock('../../../../src/infrastructure/composition/scm-provider-config.service', () => ({
  resolveScmProvider: (...args: unknown[]) => resolveScmProviderMock(...args),
}));
jest.mock('../../../../src/infrastructure/composition/scm-provider-integration.registry', () => ({
  resolveScmProviderIntegration: (...args: unknown[]) => resolveScmProviderIntegrationMock(...args),
}));

const createGovernanceGatewayMock = (): jest.Mocked<GovernanceGateway> => ({
  addLabels: jest.fn().mockResolvedValue(undefined),
  removeLabel: jest.fn().mockResolvedValue(undefined),
  createComment: jest.fn().mockResolvedValue(undefined),
  logValidatedIssue: jest.fn().mockResolvedValue(undefined),
});

describe('LazyGovernanceGatewayFactory', () => {
  beforeEach(() => {
    const providerGateway = createGovernanceGatewayMock();
    createProviderGovernanceGatewayMock.mockReturnValue(providerGateway);
    resolveScmProviderMock.mockReturnValue('github');
    resolveScmProviderIntegrationMock.mockReturnValue({
      createGovernanceGateway: createProviderGovernanceGatewayMock,
    });
    createEnvConfigMock.mockReturnValue({
      get: jest.fn(),
      getBoolean: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not read env config when scmProvider is explicitly provided', async () => {
    // Arrange
    const gateway = createLazyGovernanceGateway({ scmProvider: 'github' });

    // Act
    await gateway.logValidatedIssue({ repositoryFullName: 'org/repo', issueNumber: 42 });

    // Assert
    expect(createEnvConfigMock).not.toHaveBeenCalled();
    expect(resolveScmProviderMock).not.toHaveBeenCalled();
  });

  it('should resolve scm provider from provided config when scmProvider is omitted', async () => {
    // Arrange
    const config = {
      get: jest.fn(),
      getBoolean: jest.fn(),
    };
    const gateway = createLazyGovernanceGateway({ config });

    // Act
    await gateway.logValidatedIssue({ repositoryFullName: 'org/repo', issueNumber: 42 });

    // Assert
    expect(resolveScmProviderMock).toHaveBeenCalledWith(config);
    expect(createEnvConfigMock).not.toHaveBeenCalled();
  });

  it('should fallback to env config when provider and config are omitted', async () => {
    // Arrange
    const envConfig = {
      get: jest.fn(),
      getBoolean: jest.fn(),
    };
    createEnvConfigMock.mockReturnValue(envConfig);
    const gateway = createLazyGovernanceGateway();

    // Act
    await gateway.logValidatedIssue({ repositoryFullName: 'org/repo', issueNumber: 42 });

    // Assert
    expect(createEnvConfigMock).toHaveBeenCalledTimes(1);
    expect(resolveScmProviderMock).toHaveBeenCalledWith(envConfig);
  });

  it('should create provider gateway lazily only once', async () => {
    // Arrange
    const gateway = createLazyGovernanceGateway({ scmProvider: 'github' });

    // Act
    await gateway.addLabels({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: ['triage/needs-info'],
    });
    await gateway.removeLabel({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      label: 'triage/needs-info',
    });

    // Assert
    expect(createProviderGovernanceGatewayMock).toHaveBeenCalledTimes(1);
  });
});
