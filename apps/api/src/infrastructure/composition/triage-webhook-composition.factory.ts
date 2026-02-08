import type {
  AnalyzeIssueWithAiInput,
  AnalyzeIssueWithAiResult,
} from '../../features/triage/application/use-cases/analyze-issue-with-ai.use-case';
import type { GovernanceGateway } from '../../features/triage/application/ports/governance-gateway.port';
import { createLazyAnalyzeIssueWithAi, isAiTriageEnabled } from './lazy-ai-triage-runner.factory';
import { createLazyGovernanceGateway } from './lazy-governance-gateway.factory';
import { resolveWebhookSignatureConfig } from './webhook-signature-config.service';
import type { ConfigPort } from '../../shared/application/ports/config.port';
import type { QuestionResponseMetricsPort } from '../../shared/application/ports/question-response-metrics.port';
import type { Logger } from '../../shared/infrastructure/logging/env-logger';

export interface TriageWebhookComposition {
  governanceGateway: GovernanceGateway;
  analyzeIssueWithAi?: (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
  webhookSecret?: string;
}

interface CreateTriageWebhookCompositionParams {
  logger: Logger;
  config: ConfigPort;
  questionResponseMetrics: QuestionResponseMetricsPort;
  governanceGateway?: GovernanceGateway;
  analyzeIssueWithAi?: (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
}

export const createTriageWebhookComposition = ({
  logger,
  config,
  questionResponseMetrics,
  governanceGateway,
  analyzeIssueWithAi,
}: CreateTriageWebhookCompositionParams): TriageWebhookComposition => {
  const signatureConfig = resolveWebhookSignatureConfig(config);
  const resolvedGovernanceGateway = governanceGateway ?? createLazyGovernanceGateway();
  const resolvedAnalyzeIssueWithAi =
    analyzeIssueWithAi ??
    (isAiTriageEnabled(config)
      ? createLazyAnalyzeIssueWithAi(resolvedGovernanceGateway, logger, questionResponseMetrics, config)
      : undefined);

  return {
    governanceGateway: resolvedGovernanceGateway,
    analyzeIssueWithAi: resolvedAnalyzeIssueWithAi,
    webhookSecret: signatureConfig.verifyWebhookSignature ? signatureConfig.webhookSecret : undefined,
  };
};
