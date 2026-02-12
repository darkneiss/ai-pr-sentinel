import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  analyzeTriageArchitecture,
  type ArchitectureAnalysisReport,
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
});
