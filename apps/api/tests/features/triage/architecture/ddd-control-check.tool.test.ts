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
