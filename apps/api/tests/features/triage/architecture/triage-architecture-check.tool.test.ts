import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  analyzeFeatureArchitecture,
  analyzeTriageArchitecture,
  type ArchitectureAnalysisReport,
  buildArchitectureHumanReadableOutput,
  runArchitectureCheckCli,
  runArchitectureCheckCliSafely,
} from '../../../../src/tools/architecture/triage-architecture-check.tool';

const TYPESCRIPT_FILE_EXTENSION = '.ts';

const createTempProject = (): string => {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'triage-architecture-tool-'));
};

const writeTypescriptFile = (
  rootPath: string,
  relativeFilePath: string,
  fileContent: string,
): void => {
  const filePath = path.join(rootPath, relativeFilePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, fileContent, 'utf8');
};

const normalizeReport = (report: ArchitectureAnalysisReport): ArchitectureAnalysisReport => {
  return {
    ...report,
    violations: [...report.violations].sort((left, right) => left.localeCompare(right)),
  };
};

describe('TriageArchitectureCheckTool', () => {
  afterEach(() => {
    // Arrange
    const temporaryProjects = fs
      .readdirSync(os.tmpdir())
      .filter((entryName) => entryName.startsWith('triage-architecture-tool-'));

    // Act
    for (const temporaryProject of temporaryProjects) {
      fs.rmSync(path.join(os.tmpdir(), temporaryProject), { recursive: true, force: true });
    }

    // Assert
    expect(true).toBe(true);
  });

  it('should return compliant report with coupling and change-surface metrics', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/domain-policy.service.ts',
      "export const domainPolicy = (): string => 'ok';\n",
    );

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/application/use-cases/use-case.service.ts',
      "import { domainPolicy } from '../../domain/services/domain-policy.service';\nexport const useCase = (): string => domainPolicy();\n",
    );

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/infrastructure/adapters/adapter.ts',
      "import { useCase } from '../../application/use-cases/use-case.service';\nexport const adapter = (): string => useCase();\n",
    );

    // Act
    const report = normalizeReport(analyzeTriageArchitecture(projectRootPath));

    // Assert
    expect(report.isCompliant).toBe(true);
    expect(report.violations).toEqual([]);
    expect(report.metrics.coupling.domain.internalImports).toBe(0);
    expect(report.metrics.coupling.application.internalImports).toBe(1);
    expect(report.metrics.coupling.infrastructure.internalImports).toBe(1);
    expect(report.metrics.changeSurface.domain.fileCount).toBe(1);
    expect(report.metrics.changeSurface.application.fileCount).toBe(1);
    expect(report.metrics.changeSurface.infrastructure.fileCount).toBe(1);
    expect(report.metrics.changeSurface.domain.averageImportsPerFile).toBe(0);
  });

  it('should report a violation when domain imports infrastructure', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/illegal-domain.service.ts',
      "import { githubAdapter } from '../../infrastructure/adapters/github.adapter';\nexport const illegalDomain = (): string => githubAdapter();\n",
    );

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/infrastructure/adapters/github.adapter.ts',
      "export const githubAdapter = (): string => 'github';\n",
    );

    // Act
    const report = normalizeReport(analyzeTriageArchitecture(projectRootPath));

    // Assert
    expect(report.isCompliant).toBe(false);
    expect(report.violations).toEqual([
      'domain/services/illegal-domain.service.ts -> ../../infrastructure/adapters/github.adapter',
    ]);
    expect(report.metrics.coupling.domain.internalImports).toBe(1);
    expect(report.metrics.coupling.domain.importsByLayer.infrastructure).toBe(1);
  });

  it('should ignore non-typescript files when computing metrics', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/domain-policy.service.ts',
      "export const domainPolicy = (): string => 'ok';\n",
    );

    fs.writeFileSync(
      path.join(projectRootPath, 'src/features/triage/domain/services/notes.md'),
      '# Ignore this file',
      'utf8',
    );

    // Act
    const report = analyzeTriageArchitecture(projectRootPath);

    // Assert
    expect(report.metrics.changeSurface.domain.fileCount).toBe(1);
    expect(report.metrics.changeSurface.domain.averageImportsPerFile).toBe(0);
    expect(TYPESCRIPT_FILE_EXTENSION).toBe('.ts');
  });

  it('should report a violation when domain uses side-effect import to infrastructure', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/illegal-side-effect-domain.service.ts',
      "import '../../infrastructure/adapters/github.adapter';\nexport const illegalSideEffectDomain = (): string => 'x';\n",
    );

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/infrastructure/adapters/github.adapter.ts',
      "export const githubAdapter = (): string => 'github';\n",
    );

    // Act
    const report = normalizeReport(analyzeTriageArchitecture(projectRootPath));

    // Assert
    expect(report.isCompliant).toBe(false);
    expect(report.violations).toEqual([
      'domain/services/illegal-side-effect-domain.service.ts -> ../../infrastructure/adapters/github.adapter',
    ]);
    expect(report.metrics.coupling.domain.importsByLayer.infrastructure).toBe(1);
  });

  it('should report a violation when application re-exports from infrastructure', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/application/services/illegal-application-re-export.service.ts',
      "export { githubAdapter } from '../../infrastructure/adapters/github.adapter';\n",
    );

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/infrastructure/adapters/github.adapter.ts',
      "export const githubAdapter = (): string => 'github';\n",
    );

    // Act
    const report = normalizeReport(analyzeTriageArchitecture(projectRootPath));

    // Assert
    expect(report.isCompliant).toBe(false);
    expect(report.violations).toEqual([
      'application/services/illegal-application-re-export.service.ts -> ../../infrastructure/adapters/github.adapter',
    ]);
    expect(report.metrics.coupling.application.importsByLayer.infrastructure).toBe(1);
  });

  it('should count src absolute imports outside triage as external dependencies', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/domain.service.ts',
      "import { prompt } from 'src/shared/application/prompts/prompt';\nexport const domainService = (): string => prompt;\n",
    );
    writeTypescriptFile(
      projectRootPath,
      'src/shared/application/prompts/prompt.ts',
      "export const prompt = 'ok';\n",
    );

    // Act
    const report = analyzeTriageArchitecture(projectRootPath);

    // Assert
    expect(report.isCompliant).toBe(true);
    expect(report.metrics.coupling.domain.importsByLayer.external).toBe(1);
  });

  it('should resolve file and index import paths for metrics and violations', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/application/services/use-index.service.ts',
      "export { adapter } from '../../infrastructure/adapters/indexed';\n",
    );
    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/with-ts-extension.service.ts',
      "import { adapter } from '../../infrastructure/adapters/direct.adapter.ts';\nexport const withTsExtension = (): string => adapter;\n",
    );
    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/infrastructure/adapters/indexed/index.ts',
      "export const adapter = 'indexed';\n",
    );
    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/infrastructure/adapters/direct.adapter.ts',
      "export const adapter = 'direct';\n",
    );
    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/shared/ignored.ts',
      "export const ignored = 'ignored';\n",
    );

    // Act
    const report = normalizeReport(analyzeTriageArchitecture(projectRootPath));

    // Assert
    expect(report.isCompliant).toBe(false);
    expect(report.violations).toEqual([
      'application/services/use-index.service.ts -> ../../infrastructure/adapters/indexed',
      'domain/services/with-ts-extension.service.ts -> ../../infrastructure/adapters/direct.adapter.ts',
    ]);
    expect(report.metrics.changeSurface.infrastructure.fileCount).toBe(2);
  });

  it('should render human readable output for compliant and non-compliant reports', () => {
    // Arrange
    const compliantReport: ArchitectureAnalysisReport = {
      isCompliant: true,
      violations: [],
      metrics: {
        coupling: {
          domain: { internalImports: 0, importsByLayer: { domain: 0, application: 0, infrastructure: 0, external: 0 } },
          application: { internalImports: 0, importsByLayer: { domain: 0, application: 0, infrastructure: 0, external: 0 } },
          infrastructure: { internalImports: 0, importsByLayer: { domain: 0, application: 0, infrastructure: 0, external: 0 } },
        },
        changeSurface: {
          domain: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
          application: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
          infrastructure: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
        },
      },
    };
    const nonCompliantReport: ArchitectureAnalysisReport = {
      ...compliantReport,
      isCompliant: false,
      violations: ['domain/x.ts -> ../../infrastructure/y'],
    };

    // Act
    const compliantOutput = buildArchitectureHumanReadableOutput(compliantReport);
    const nonCompliantOutput = buildArchitectureHumanReadableOutput(nonCompliantReport);

    // Assert
    expect(compliantOutput).toContain('Architecture check passed');
    expect(nonCompliantOutput).toContain('Architecture check failed: 1 violation(s).');
    expect(nonCompliantOutput).toContain('Violations:');
    expect(nonCompliantOutput).toContain('- domain/x.ts -> ../../infrastructure/y');
  });

  it('should run cli in json and text modes and return status code', () => {
    // Arrange
    const projectRootPath = createTempProject();
    const outputs: string[] = [];

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/domain.service.ts',
      "export const domainService = 'ok';\n",
    );

    // Act
    const jsonExitCode = runArchitectureCheckCli({
      argv: ['node', 'tool', '--json'],
      cwd: projectRootPath,
      outputWriter: (output) => outputs.push(output),
    });
    const textExitCode = runArchitectureCheckCli({
      argv: ['node', 'tool'],
      cwd: projectRootPath,
      outputWriter: (output) => outputs.push(output),
    });

    // Assert
    expect(jsonExitCode).toBe(0);
    expect(textExitCode).toBe(0);
    expect(outputs[0]).toContain('"isCompliant": true');
    expect(outputs[1]).toContain('Architecture check passed');
  });

  it('should return failure and error output when safe cli execution throws', () => {
    // Arrange
    const projectRootPath = createTempProject();
    const errors: string[] = [];

    // Act
    const exitCode = runArchitectureCheckCliSafely({
      argv: ['node', 'tool'],
      cwd: projectRootPath,
      errorWriter: (errorOutput) => errors.push(errorOutput),
    });

    // Assert
    expect(exitCode).toBe(1);
    expect(errors[0]).toContain('Architecture check tool failed:');
  });

  it('should treat unresolved imports and triage shared imports as external', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/domain.service.ts',
      "import '../../shared/shared-module';\nimport './missing-module';\nexport const domainService = 'ok';\n",
    );
    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/shared/shared-module.ts',
      "export const shared = 'shared';\n",
    );

    // Act
    const report = analyzeTriageArchitecture(projectRootPath);

    // Assert
    expect(report.isCompliant).toBe(true);
    expect(report.metrics.coupling.domain.importsByLayer.external).toBe(2);
  });

  it('should ignore non-local imports while parsing dependencies', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/domain.service.ts',
      "import fs from 'node:fs';\nexport const domainService = (): number => fs.constants.O_RDONLY;\n",
    );

    // Act
    const report = analyzeTriageArchitecture(projectRootPath);

    // Assert
    expect(report.metrics.changeSurface.domain.importCount).toBe(0);
  });

  it('should run cli using default argv, cwd and output writer', () => {
    // Arrange
    const projectRootPath = createTempProject();
    const originalArgv = process.argv;
    const originalCwd = process.cwd();
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/domain.service.ts',
      "export const domainService = 'ok';\n",
    );

    process.argv = ['node', 'tool'];
    process.chdir(projectRootPath);

    // Act
    const exitCode = runArchitectureCheckCli();

    // Assert
    expect(exitCode).toBe(0);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Architecture check passed'));

    process.argv = originalArgv;
    process.chdir(originalCwd);
    consoleLogSpy.mockRestore();
  });

  it('should return non-zero cli exit code when architecture is not compliant', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/invalid.service.ts',
      "import '../../infrastructure/adapters/github.adapter';\nexport const invalid = 'invalid';\n",
    );
    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/infrastructure/adapters/github.adapter.ts',
      "export const adapter = 'github';\n",
    );

    // Act
    const exitCode = runArchitectureCheckCli({
      argv: ['node', 'tool'],
      cwd: projectRootPath,
      outputWriter: () => undefined,
    });

    // Assert
    expect(exitCode).toBe(1);
  });

  it('should emit unknown_error when safe cli catches a non-error throw', () => {
    // Arrange
    const errors: string[] = [];
    const readdirSpy = jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw 'boom';
    });

    // Act
    const exitCode = runArchitectureCheckCliSafely({
      cwd: createTempProject(),
      argv: ['node', 'tool'],
      errorWriter: (errorOutput) => errors.push(errorOutput),
    });

    // Assert
    expect(exitCode).toBe(1);
    expect(errors[0]).toContain('unknown_error');
    readdirSpy.mockRestore();
  });

  it('should return safe cli success code when execution succeeds', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/domain.service.ts',
      "export const domainService = 'ok';\n",
    );

    // Act
    const exitCode = runArchitectureCheckCliSafely({
      cwd: projectRootPath,
      argv: ['node', 'tool'],
      outputWriter: () => undefined,
    });

    // Assert
    expect(exitCode).toBe(0);
  });

  it('should use default error writer and error message when safe cli catches Error', () => {
    // Arrange
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const readdirSpy = jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw new Error('forced_error');
    });

    // Act
    const exitCode = runArchitectureCheckCliSafely();

    // Assert
    expect(exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Architecture check tool failed: forced_error'),
    );

    readdirSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should analyze all feature contexts and include per-context reports', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/triage-domain.service.ts',
      "export const triageDomainService = (): string => 'triage';\n",
    );
    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/application/use-cases/triage-use-case.service.ts',
      "import { triageDomainService } from '../../domain/services/triage-domain.service';\nexport const triageUseCaseService = (): string => triageDomainService();\n",
    );
    writeTypescriptFile(
      projectRootPath,
      'src/features/governance/domain/services/governance-domain.service.ts',
      "export const governanceDomainService = (): string => 'governance';\n",
    );
    writeTypescriptFile(
      projectRootPath,
      'src/features/governance/application/use-cases/governance-use-case.service.ts',
      "import { governanceDomainService } from '../../domain/services/governance-domain.service';\nexport const governanceUseCaseService = (): string => governanceDomainService();\n",
    );

    // Act
    const report = analyzeFeatureArchitecture(projectRootPath);

    // Assert
    expect(report.isCompliant).toBe(true);
    expect(report.violations).toEqual([]);
    expect(report.contexts).toBeDefined();
    expect(report.contexts?.governance?.isCompliant).toBe(true);
    expect(report.contexts?.triage?.isCompliant).toBe(true);
    expect(report.metrics.changeSurface.domain.fileCount).toBe(2);
    expect(report.metrics.changeSurface.application.fileCount).toBe(2);
  });

  it('should report violation when a feature imports another feature context directly', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/governance/domain/services/governance-domain.service.ts',
      "export const governanceDomainService = (): string => 'governance';\n",
    );
    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/application/use-cases/invalid-cross-context.use-case.ts',
      "import { governanceDomainService } from '../../../governance/domain/services/governance-domain.service';\nexport const invalidCrossContextUseCase = (): string => governanceDomainService();\n",
    );

    // Act
    const report = analyzeFeatureArchitecture(projectRootPath);

    // Assert
    expect(report.isCompliant).toBe(false);
    expect(report.violations).toContain(
      'triage:application/use-cases/invalid-cross-context.use-case.ts -> ../../../governance/domain/services/governance-domain.service (cross_context_import_to_governance)',
    );
  });

  it('should treat root-level features files as cross-context external targets', () => {
    // Arrange
    const projectRootPath = createTempProject();

    writeTypescriptFile(
      projectRootPath,
      'src/features/stray.ts',
      "export const stray = (): string => 'stray';\n",
    );
    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/application/use-cases/use-stray.use-case.ts',
      "import { stray } from 'src/features/stray';\nexport const useStray = (): string => stray();\n",
    );

    // Act
    const report = analyzeFeatureArchitecture(projectRootPath);

    // Assert
    expect(report.isCompliant).toBe(false);
    expect(report.violations).toContain(
      'triage:application/use-cases/use-stray.use-case.ts -> src/features/stray (cross_context_import_to_stray.ts)',
    );
  });

  it('should skip files when normalized path cannot resolve a feature context', () => {
    // Arrange
    const projectRootPath = createTempProject();
    const forcedNormalizedPath = `${projectRootPath}${path.sep}src${path.sep}features${path.sep}`;
    let didForcePath = false;

    writeTypescriptFile(
      projectRootPath,
      'src/features/triage/domain/services/domain.service.ts',
      "export const domainService = 'ok';\n",
    );

    const originalNormalize = path.normalize;
    const normalizeSpy = jest.spyOn(path, 'normalize').mockImplementation((targetPath: string) => {
      if (targetPath.includes(`${path.sep}domain${path.sep}services${path.sep}domain.service.ts`)) {
        didForcePath = true;
        return forcedNormalizedPath;
      }

      return originalNormalize(targetPath);
    });

    try {
      // Act
      const report = analyzeFeatureArchitecture(projectRootPath);

      // Assert
      expect(report.isCompliant).toBe(true);
      expect(report.metrics.changeSurface.domain.fileCount).toBe(0);
      expect(didForcePath).toBe(true);
    } finally {
      normalizeSpy.mockRestore();
    }
  });

  it('should render context compliance lines sorted by context name', () => {
    // Arrange
    const report: ArchitectureAnalysisReport = {
      isCompliant: true,
      violations: [],
      metrics: {
        coupling: {
          domain: {
            internalImports: 0,
            importsByLayer: { domain: 0, application: 0, infrastructure: 0, external: 0 },
          },
          application: {
            internalImports: 0,
            importsByLayer: { domain: 0, application: 0, infrastructure: 0, external: 0 },
          },
          infrastructure: {
            internalImports: 0,
            importsByLayer: { domain: 0, application: 0, infrastructure: 0, external: 0 },
          },
        },
        changeSurface: {
          domain: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
          application: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
          infrastructure: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
        },
      },
      contexts: {
        triage: {
          isCompliant: true,
          violations: [],
          metrics: {
            coupling: {
              domain: {
                internalImports: 0,
                importsByLayer: { domain: 0, application: 0, infrastructure: 0, external: 0 },
              },
              application: {
                internalImports: 0,
                importsByLayer: { domain: 0, application: 0, infrastructure: 0, external: 0 },
              },
              infrastructure: {
                internalImports: 0,
                importsByLayer: { domain: 0, application: 0, infrastructure: 0, external: 0 },
              },
            },
            changeSurface: {
              domain: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
              application: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
              infrastructure: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
            },
          },
        },
        governance: {
          isCompliant: true,
          violations: [],
          metrics: {
            coupling: {
              domain: {
                internalImports: 0,
                importsByLayer: { domain: 0, application: 0, infrastructure: 0, external: 0 },
              },
              application: {
                internalImports: 0,
                importsByLayer: { domain: 0, application: 0, infrastructure: 0, external: 0 },
              },
              infrastructure: {
                internalImports: 0,
                importsByLayer: { domain: 0, application: 0, infrastructure: 0, external: 0 },
              },
            },
            changeSurface: {
              domain: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
              application: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
              infrastructure: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
            },
          },
        },
      },
    };

    // Act
    const output = buildArchitectureHumanReadableOutput(report);

    // Assert
    expect(output.indexOf('governance: compliant=true, violations=0')).toBeLessThan(
      output.indexOf('triage: compliant=true, violations=0'),
    );
  });
});
