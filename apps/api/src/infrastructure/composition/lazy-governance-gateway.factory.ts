import type { GovernanceGateway } from '../../features/triage/application/ports/governance-gateway.port';

export const createLazyGovernanceGateway = (): GovernanceGateway => {
  let gateway: GovernanceGateway | undefined;

  const getGateway = (): GovernanceGateway => {
    if (!gateway) {
      // Lazy-load adapter to keep app composition testable without loading Octokit at module import time.
      const { createGithubGovernanceAdapter } = require('../../features/triage/infrastructure/adapters/github-governance.adapter') as {
        createGithubGovernanceAdapter: () => GovernanceGateway;
      };
      gateway = createGithubGovernanceAdapter();
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
