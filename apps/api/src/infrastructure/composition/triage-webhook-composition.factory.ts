import type {
  AnalyzeIssueWithAiInput,
  AnalyzeIssueWithAiResult,
} from '../../features/triage/application/ports/issue-ai-triage-runner.port';
import type { GovernanceGateway } from '../../features/triage/application/ports/governance-gateway.port';
import type { RepositoryAuthorizationGateway } from '../../features/triage/application/ports/repository-authorization-gateway.port';
import type { WebhookDeliveryGateway } from '../../features/triage/application/ports/webhook-delivery-gateway.port';
import { createInMemoryWebhookDeliveryAdapter } from '../../features/triage/infrastructure/adapters/in-memory-webhook-delivery.adapter';
import { createStaticRepositoryAuthorizationAdapter } from '../../features/triage/infrastructure/adapters/static-repository-authorization.adapter';
import { createLazyAnalyzeIssueWithAi, isAiTriageEnabled } from './lazy-ai-triage-runner.factory';
import { createLazyGovernanceGateway } from './lazy-governance-gateway.factory';
import { resolveScmProvider, type ScmProvider } from './scm-provider-config.service';
import { resolveWebhookIngressConfig } from './webhook-ingress-config.service';
import { resolveWebhookSignatureConfig } from './webhook-signature-config.service';
import type { ConfigPort } from '../../shared/application/ports/config.port';
import type { QuestionResponseMetricsPort } from '../../shared/application/ports/question-response-metrics.port';
import type { Logger } from '../../shared/infrastructure/logging/env-logger';

const SCM_BOT_LOGIN_ENV_VAR = 'SCM_BOT_LOGIN';
const SCM_BOT_LOGIN_MISSING_ERROR_MESSAGE =
  'Missing SCM_BOT_LOGIN. Configure SCM_BOT_LOGIN when AI_TRIAGE_ENABLED is true.';

export interface TriageWebhookComposition {
  scmProvider: ScmProvider;
  governanceGateway: GovernanceGateway;
  analyzeIssueWithAi?: (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
  webhookSecret?: string;
  webhookDeliveryGateway: WebhookDeliveryGateway;
  webhookDeliveryTtlSeconds: number;
  requireDeliveryId: boolean;
  repositoryAuthorizationGateway: RepositoryAuthorizationGateway;
}

interface CreateTriageWebhookCompositionParams {
  logger: Logger;
  config: ConfigPort;
  questionResponseMetrics: QuestionResponseMetricsPort;
  governanceGateway?: GovernanceGateway;
  analyzeIssueWithAi?: (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
}

const resolveRequiredScmBotLogin = (config: ConfigPort): string => {
  const scmBotLogin = config.get(SCM_BOT_LOGIN_ENV_VAR)?.trim();
  if (!scmBotLogin) {
    throw new Error(SCM_BOT_LOGIN_MISSING_ERROR_MESSAGE);
  }

  return scmBotLogin;
};

export const createTriageWebhookComposition = ({
  logger,
  config,
  questionResponseMetrics,
  governanceGateway,
  analyzeIssueWithAi,
}: CreateTriageWebhookCompositionParams): TriageWebhookComposition => {
  const scmProvider = resolveScmProvider(config);
  const signatureConfig = resolveWebhookSignatureConfig(config);
  const ingressConfig = resolveWebhookIngressConfig(config);
  const resolvedGovernanceGateway =
    governanceGateway ?? createLazyGovernanceGateway({ scmProvider, config });
  const aiTriageEnabled = isAiTriageEnabled(config);
  if (aiTriageEnabled && !analyzeIssueWithAi) {
    resolveRequiredScmBotLogin(config);
  }
  const resolvedAnalyzeIssueWithAi =
    analyzeIssueWithAi ??
    (aiTriageEnabled
      ? createLazyAnalyzeIssueWithAi(resolvedGovernanceGateway, logger, questionResponseMetrics, config, {
          scmProvider,
        })
      : undefined);
  const webhookDeliveryGateway = createInMemoryWebhookDeliveryAdapter();
  const repositoryAuthorizationGateway = createStaticRepositoryAuthorizationAdapter({
    allowedRepositories: ingressConfig.allowedRepositories,
    strictAllowlist: ingressConfig.strictRepositoryAllowlist,
  });

  return {
    scmProvider,
    governanceGateway: resolvedGovernanceGateway,
    analyzeIssueWithAi: resolvedAnalyzeIssueWithAi,
    webhookSecret: signatureConfig.verifyWebhookSignature ? signatureConfig.webhookSecret : undefined,
    webhookDeliveryGateway,
    webhookDeliveryTtlSeconds: ingressConfig.deliveryTtlSeconds,
    requireDeliveryId: ingressConfig.requireDeliveryId,
    repositoryAuthorizationGateway,
  };
};
