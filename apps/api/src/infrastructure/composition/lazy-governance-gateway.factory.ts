import type { GovernanceGateway } from '../../features/triage/application/ports/governance-gateway.port';
import type { ConfigPort } from '../../shared/application/ports/config.port';
import { createEnvConfig } from '../../shared/infrastructure/config/env-config.adapter';
import { resolveScmProvider, type ScmProvider } from './scm-provider-config.service';
import { resolveScmProviderIntegration } from './scm-provider-integration.registry';

interface CreateLazyGovernanceGatewayParams {
  scmProvider?: ScmProvider;
  config?: ConfigPort;
}

export const createLazyGovernanceGateway = (
  params: CreateLazyGovernanceGatewayParams = {},
): GovernanceGateway => {
  const scmProvider = (() => {
    if (params.scmProvider) {
      return params.scmProvider;
    }

    const config = params.config ?? createEnvConfig();
    return resolveScmProvider(config);
  })();
  let gateway: GovernanceGateway | undefined;

  const getGateway = (): GovernanceGateway => {
    if (!gateway) {
      gateway = resolveScmProviderIntegration(scmProvider).createGovernanceGateway();
    }
    return gateway;
  };

  return {
    addLabels: async (input) => getGateway().addLabels(input),
    removeLabel: async (input) => getGateway().removeLabel(input),
    createComment: async (input) => getGateway().createComment(input),
    logValidatedIssue: async (input) => getGateway().logValidatedIssue(input),
  };
};
