import type { RepositoryContextReader } from '../../domain/ports/repository-context-reader.port';

export type { RepositoryContext } from '../../domain/ports/repository-context-reader.port';

export interface RepositoryContextGateway extends RepositoryContextReader {}
