export interface ConfigPort {
  get(key: string): string | undefined;
  getBoolean(key: string): boolean | undefined;
}
