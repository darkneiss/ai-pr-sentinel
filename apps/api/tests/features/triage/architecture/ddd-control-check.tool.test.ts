import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  analyzeDddControl,
  buildDddControlHumanReadableOutput,
  runDddControlCheckCli,
  runDddControlCheckCliSafely,
  type DddControlReport,
} from '../../../../src/tools/architecture/ddd-control-check.tool';

const createTempProject = (): string => {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-control-tool-'));
};

const writeFile = (rootPath: string, relativeFilePath: string, fileContent: string): void => {
  const filePath = path.join(rootPath, relativeFilePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, fileContent, 'utf8');
};

const removeTempProjects = (): void => {
  const temporaryProjects = fs
    .readdirSync(os.tmpdir())
    .filter((entryName) => entryName.startsWith('ddd-control-tool-'));

  for (const temporaryProject of temporaryProjects) {
    fs.rmSync(path.join(os.tmpdir(), temporaryProject), { recursive: true, force: true });
  }
};

describe('DddControlCheckTool', () => {
  afterEach(() => {
    // Arrange
    expect(true).toBe(true);

    // Act
    removeTempProjects();

    // Assert
    expect(true).toBe(true);
  });

  it('should return compliant report for explicit context map and valid feature boundaries', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeFile(
      projectRootPath,
      'docs/ddd/context-map.md',
      '# Context Map\n\n- triage\n- governance\n- shared-kernel\n',
    );
    writeFile(
      projectRootPath,
      'src/features/triage/domain/entities/issue.entity.ts',
      "export const issueEntity = 'entity';\n",
    );
    writeFile(
      projectRootPath,
      'src/features/triage/application/use-cases/process-issue.use-case.ts',
      "import { issueEntity } from '../../domain/entities/issue.entity';\nexport const processIssueUseCase = (): string => issueEntity;\n",
    );
    writeFile(
      projectRootPath,
      'src/features/governance/domain/services/policy.service.ts',
      "export const governancePolicy = (): string => 'policy';\n",
    );
    writeFile(
      projectRootPath,
      'src/features/governance/application/use-cases/evaluate-policy.use-case.ts',
      "import { governancePolicy } from '../../domain/services/policy.service';\nexport const evaluatePolicyUseCase = (): string => governancePolicy();\n",
    );

    // Act
    const report = analyzeDddControl(projectRootPath);

    // Assert
    expect(report.isCompliant).toBe(true);
    expect(report.findings.strategic).toEqual([]);
    expect(report.findings.tactical).toEqual([]);
    expect(report.metrics.featureContextCount).toBe(2);
    expect(report.scores.strategic).toBe(100);
    expect(report.scores.tactical).toBe(100);
    expect(report.scores.global).toBe(100);
  });

  it('should report non-compliance when context map is missing and cross-context import exists', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeFile(
      projectRootPath,
      'src/features/triage/domain/services/triage-domain.service.ts',
      "export const triageDomainService = (): string => 'triage';\n",
    );
    writeFile(
      projectRootPath,
      'src/features/triage/application/use-cases/invalid-cross-context.use-case.ts',
      "import { governanceDomainService } from '../../../governance/domain/services/governance-domain.service';\nexport const invalidUseCase = (): string => governanceDomainService();\n",
    );
    writeFile(
      projectRootPath,
      'src/features/governance/domain/services/governance-domain.service.ts',
      "export const governanceDomainService = (): string => 'governance';\n",
    );
    writeFile(
      projectRootPath,
      'src/features/governance/application/services/no-use-case.service.ts',
      "export const noUseCaseService = (): string => 'x';\n",
    );

    // Act
    const report = analyzeDddControl(projectRootPath);

    // Assert
    expect(report.isCompliant).toBe(false);
    expect(report.findings.strategic).toContain('missing_context_map_document');
    expect(report.findings.strategic).toContain('cross_context_imports_detected');
    expect(report.findings.tactical).toContain('contexts_without_use_cases');
    expect(report.metrics.crossContextImportViolationCount).toBe(1);
    expect(report.metrics.contextsWithoutUseCases).toEqual(['governance']);
  });

  it('should resolve context map by walking parent directories from workspace cwd', () => {
    // Arrange
    const projectRootPath = createTempProject();
    const workspaceApiPath = path.join(projectRootPath, 'apps', 'api');

    writeFile(projectRootPath, 'docs/ddd/context-map.md', '# Context Map\n');
    writeFile(
      workspaceApiPath,
      'src/features/triage/domain/entities/issue.entity.ts',
      "export const issueEntity = 'entity';\n",
    );
    writeFile(
      workspaceApiPath,
      'src/features/triage/application/use-cases/process-issue.use-case.ts',
      "import { issueEntity } from '../../domain/entities/issue.entity';\nexport const processIssueUseCase = (): string => issueEntity;\n",
    );

    // Act
    const report = analyzeDddControl(workspaceApiPath);

    // Assert
    expect(report.isCompliant).toBe(true);
    expect(report.findings.strategic).toEqual([]);
  });

  it('should report structural tactical and strategic findings for layer and model gaps', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeFile(projectRootPath, 'docs/ddd/context-map.md', '# Context Map\n');
    writeFile(
      projectRootPath,
      'src/features/triage/domain/services/invalid-domain.service.ts',
      "import { adapter } from '../../infrastructure/adapters/adapter';\nexport const invalidDomainService = (): string => adapter;\n",
    );
    writeFile(
      projectRootPath,
      'src/features/triage/infrastructure/adapters/adapter.ts',
      "export const adapter = 'adapter';\n",
    );
    writeFile(
      projectRootPath,
      'src/features/triage/application/use-cases/process-issue.use-case.ts',
      "export const processIssueUseCase = (): string => 'ok';\n",
    );
    writeFile(
      projectRootPath,
      'src/features/monitoring/domain/services/monitoring-domain.service.ts',
      "export const monitoringDomainService = (): string => 'monitoring';\n",
    );
    writeFile(
      projectRootPath,
      'src/features/ops/application/use-cases/nested/ops.use-case.ts',
      "export const opsUseCase = (): string => 'ops';\n",
    );
    writeFile(
      projectRootPath,
      'src/features/ops/application/use-cases/README.md',
      '# not ts',
    );
    writeFile(
      projectRootPath,
      'src/features/governance/domain/ports/governance.port.ts',
      "export type GovernancePort = { readonly name: string };\n",
    );
    writeFile(
      projectRootPath,
      'src/features/governance/application/use-cases/evaluate.use-case.ts',
      "export const evaluateUseCase = (): string => 'evaluate';\n",
    );

    // Act
    const report = analyzeDddControl(projectRootPath);

    // Assert
    expect(report.isCompliant).toBe(false);
    expect(report.findings.strategic).toEqual([
      'contexts_without_application_layer',
      'contexts_without_domain_layer',
    ]);
    expect(report.findings.tactical).toEqual([
      'boundary_violations_detected',
      'contexts_without_domain_model',
      'contexts_without_use_cases',
      'feature_architecture_not_compliant',
    ]);
    expect(report.metrics.contextsWithoutApplication).toEqual(['monitoring']);
    expect(report.metrics.contextsWithoutDomain).toEqual(['ops']);
    expect(report.metrics.contextsWithoutDomainModel).toEqual(['governance', 'ops']);
    expect(report.metrics.boundaryViolationCount).toBe(1);
  });

  it('should report missing feature contexts when features root is empty', () => {
    // Arrange
    const projectRootPath = createTempProject();
    fs.mkdirSync(path.join(projectRootPath, 'src', 'features'), { recursive: true });
    writeFile(projectRootPath, 'docs/ddd/context-map.md', '# Context Map\n');

    // Act
    const report = analyzeDddControl(projectRootPath);

    // Assert
    expect(report.isCompliant).toBe(false);
    expect(report.findings.strategic).toEqual(['missing_feature_contexts']);
    expect(report.metrics.featureContextCount).toBe(0);
  });

  it('should support threshold parsing from environment including clamps and rounding', () => {
    // Arrange
    const projectRootPath = createTempProject();
    const outputs: string[] = [];

    writeFile(projectRootPath, 'docs/ddd/context-map.md', '# Context Map\n');
    writeFile(
      projectRootPath,
      'src/features/triage/domain/entities/issue.entity.ts',
      "export const issueEntity = 'entity';\n",
    );
    writeFile(
      projectRootPath,
      'src/features/triage/application/use-cases/process-issue.use-case.ts',
      "import { issueEntity } from '../../domain/entities/issue.entity';\nexport const processIssueUseCase = (): string => issueEntity;\n",
    );

    // Act
    const firstExitCode = runDddControlCheckCli({
      argv: ['node', 'tool', '--json'],
      cwd: projectRootPath,
      outputWriter: (output: string) => outputs.push(output),
      env: {
        DDD_MIN_STRATEGIC_SCORE: 'not-a-number',
        DDD_MIN_TACTICAL_SCORE: '-1',
        DDD_MIN_GLOBAL_SCORE: '101',
      },
    });
    const secondExitCode = runDddControlCheckCli({
      argv: ['node', 'tool', '--json'],
      cwd: projectRootPath,
      outputWriter: (output: string) => outputs.push(output),
      env: {
        DDD_MIN_STRATEGIC_SCORE: '79.6',
        DDD_MIN_TACTICAL_SCORE: '85.4',
        DDD_MIN_GLOBAL_SCORE: '84.6',
      },
    });

    const firstReport = JSON.parse(outputs[0]) as DddControlReport;
    const secondReport = JSON.parse(outputs[1]) as DddControlReport;

    // Assert
    expect(firstExitCode).toBe(0);
    expect(secondExitCode).toBe(0);
    expect(firstReport.thresholds).toEqual({
      strategic: 100,
      tactical: 0,
      global: 100,
    });
    expect(secondReport.thresholds).toEqual({
      strategic: 80,
      tactical: 85,
      global: 85,
    });
  });

  it('should render human readable output', () => {
    // Arrange
    const report: DddControlReport = {
      isCompliant: false,
      scores: { strategic: 75, tactical: 80, global: 78 },
      thresholds: { strategic: 80, tactical: 80, global: 80 },
      findings: {
        strategic: ['missing_context_map_document'],
        tactical: ['contexts_without_use_cases'],
      },
      metrics: {
        featureContextCount: 1,
        crossContextImportViolationCount: 0,
        boundaryViolationCount: 0,
        contextsWithoutDomain: [],
        contextsWithoutApplication: [],
        contextsWithoutUseCases: ['triage'],
        contextsWithoutDomainModel: [],
      },
    };

    // Act
    const output = buildDddControlHumanReadableOutput(report);

    // Assert
    expect(output).toContain('DDD control check failed');
    expect(output).toContain('Scores');
    expect(output).toContain('Strategic findings');
    expect(output).toContain('Tactical findings');
  });

  it('should run cli in json and text modes and return status code', () => {
    // Arrange
    const projectRootPath = createTempProject();
    const outputs: string[] = [];

    writeFile(projectRootPath, 'docs/ddd/context-map.md', '# Context Map\n');
    writeFile(
      projectRootPath,
      'src/features/triage/domain/entities/issue.entity.ts',
      "export const issueEntity = 'entity';\n",
    );
    writeFile(
      projectRootPath,
      'src/features/triage/application/use-cases/process-issue.use-case.ts',
      "import { issueEntity } from '../../domain/entities/issue.entity';\nexport const processIssueUseCase = (): string => issueEntity;\n",
    );

    // Act
    const jsonExitCode = runDddControlCheckCli({
      argv: ['node', 'tool', '--json'],
      cwd: projectRootPath,
      outputWriter: (output: string) => outputs.push(output),
    });
    const textExitCode = runDddControlCheckCli({
      argv: ['node', 'tool'],
      cwd: projectRootPath,
      outputWriter: (output: string) => outputs.push(output),
    });

    // Assert
    expect(jsonExitCode).toBe(0);
    expect(textExitCode).toBe(0);
    expect(outputs[0]).toContain('"isCompliant": true');
    expect(outputs[1]).toContain('DDD control check passed');
  });

  it('should return safe cli failure and unknown_error for non-error throw', () => {
    // Arrange
    const errors: string[] = [];
    const readdirSpy = jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw 'boom';
    });

    // Act
    const exitCode = runDddControlCheckCliSafely({
      argv: ['node', 'tool'],
      cwd: createTempProject(),
      errorWriter: (errorOutput: string) => errors.push(errorOutput),
    });

    // Assert
    expect(exitCode).toBe(1);
    expect(errors[0]).toContain('DDD control check tool failed: unknown_error');

    readdirSpy.mockRestore();
  });
});
