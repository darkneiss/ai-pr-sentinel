import type { GovernanceGateway } from '../ports/governance-gateway.port';
import type { IssueWebhookGovernancePlan } from '../../domain/services/issue-webhook-governance-plan.service';
import type { IssueWebhookIdentity } from '../../domain/services/issue-webhook-identity-policy.service';

interface ApplyIssueWebhookGovernanceActionsInput {
  governanceGateway: GovernanceGateway;
  issueWebhookIdentity: IssueWebhookIdentity;
  governancePlan: Pick<IssueWebhookGovernancePlan, 'actions'>;
}

export const applyIssueWebhookGovernanceActions = async ({
  governanceGateway,
  issueWebhookIdentity,
  governancePlan,
}: ApplyIssueWebhookGovernanceActionsInput): Promise<void> => {
  for (const action of governancePlan.actions) {
    if (action.type === 'add_label') {
      await governanceGateway.addLabels({
        repositoryFullName: issueWebhookIdentity.repositoryFullName,
        issueNumber: issueWebhookIdentity.issueNumber,
        labels: [action.label],
      });
      continue;
    }

    if (action.type === 'remove_label') {
      await governanceGateway.removeLabel({
        repositoryFullName: issueWebhookIdentity.repositoryFullName,
        issueNumber: issueWebhookIdentity.issueNumber,
        label: action.label,
      });
      continue;
    }

    if (action.type === 'create_comment') {
      await governanceGateway.createComment({
        repositoryFullName: issueWebhookIdentity.repositoryFullName,
        issueNumber: issueWebhookIdentity.issueNumber,
        body: action.body,
      });
      continue;
    }

    await governanceGateway.logValidatedIssue({
      repositoryFullName: issueWebhookIdentity.repositoryFullName,
      issueNumber: issueWebhookIdentity.issueNumber,
    });
  }
};
