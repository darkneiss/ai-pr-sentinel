import type { ConfigPort } from '../../shared/application/ports/config.port';
import { readFileSync } from 'node:fs';

const API_VERSION_FILE_ENV_VAR = 'API_VERSION_FILE';
const NPM_PACKAGE_VERSION_ENV_VAR = 'npm_package_version';
const DEFAULT_API_VERSION = '0.0.1';

const resolveVersionFromManifestFile = (manifestPath: string | undefined): string | undefined => {
  if (!manifestPath) {
    return undefined;
  }

  try {
    const manifestRaw = readFileSync(manifestPath, 'utf8');
    const manifest: unknown = JSON.parse(manifestRaw);

    if (typeof manifest !== 'object' || manifest === null || !('version' in manifest)) {
      return undefined;
    }

    const { version } = manifest as { version?: unknown };
    return typeof version === 'string' && version.trim().length > 0 ? version : undefined;
  } catch (error: unknown) {
    console.warn('ApiVersionConfigService could not resolve version from API_VERSION_FILE.', {
      manifestPath,
      error,
    });
    return undefined;
  }
};

export const resolveApiVersion = (config: ConfigPort): string =>
  resolveVersionFromManifestFile(config.get(API_VERSION_FILE_ENV_VAR)) ??
  config.get(NPM_PACKAGE_VERSION_ENV_VAR) ??
  DEFAULT_API_VERSION;
