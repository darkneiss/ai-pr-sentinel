import type { RequestHandler } from 'express';

import type { AnalyzeIssueWithAiInput, AnalyzeIssueWithAiResult } from '../../application/use-cases/analyze-issue-with-ai.use-case';
import type { GovernanceGateway } from '../../application/ports/governance-gateway.port';
import { processIssueWebhook } from '../../application/use-cases/process-issue-webhook.use-case';
import { createEnvLogger, type Logger } from '../../../../shared/infrastructure/logging/env-logger';

interface Dependencies {
  governanceGateway: GovernanceGateway;
  analyzeIssueWithAi?: (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
  logger?: Logger;
}

interface GithubIssueLabel {
  name: string;
}

interface GithubIssueWebhookPayload {
  action: string;
  issue: {
    number: number;
    title: string;
    body: string;
    user: {
      login: string;
    };
    labels: GithubIssueLabel[];
  };
  repository: {
    full_name: string;
  };
}

const isGithubIssueWebhookPayload = (value: unknown): value is GithubIssueWebhookPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const issue = payload.issue as Record<string, unknown> | undefined;
  const repository = payload.repository as Record<string, unknown> | undefined;
  const user = issue?.user as Record<string, unknown> | undefined;
  const labels = issue?.labels;

  return (
    typeof payload.action === 'string' &&
    !!issue &&
    typeof issue.number === 'number' &&
    typeof issue.title === 'string' &&
    typeof issue.body === 'string' &&
    !!user &&
    typeof user.login === 'string' &&
    Array.isArray(labels) &&
    labels.every(
      (label) =>
        !!label &&
        typeof label === 'object' &&
        typeof (label as Record<string, unknown>).name === 'string',
    ) &&
    !!repository &&
    typeof repository.full_name === 'string'
  );
};

export const createGithubWebhookController = ({
  governanceGateway,
  analyzeIssueWithAi,
  logger = createEnvLogger(),
}: Dependencies): RequestHandler => {
  const run = processIssueWebhook({ governanceGateway, analyzeIssueWithAi, logger });

  return async (req, res) => {
    try {
      const payload: unknown = req.body;
      if (!isGithubIssueWebhookPayload(payload)) {
        res.status(400).json({ error: 'Invalid GitHub issue webhook payload' });
        return;
      }

      const result = await run({
        action: payload.action,
        repositoryFullName: payload.repository.full_name,
        issue: {
          number: payload.issue.number,
          title: payload.issue.title,
          body: payload.issue.body,
          author: payload.issue.user.login,
          labels: payload.issue.labels.map((label) => label.name),
        },
      });

      if (result.statusCode === 204) {
        res.status(204).send();
        return;
      }

      res.status(200).json({ status: 'ok' });
    } catch (error: unknown) {
      logger.error('GithubWebhookController failed processing issue webhook', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
};
