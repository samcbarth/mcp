/** Minimal pluggable logger so the library never hard-depends on `console`. */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** A logger that discards everything. The default. */
export const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

/** A logger that writes to `console`, prefixed with `[mcp-connect]`. */
export const consoleLogger: Logger = {
  debug: (m, ...a) => console.debug(`[mcp-connect] ${m}`, ...a),
  info: (m, ...a) => console.info(`[mcp-connect] ${m}`, ...a),
  warn: (m, ...a) => console.warn(`[mcp-connect] ${m}`, ...a),
  error: (m, ...a) => console.error(`[mcp-connect] ${m}`, ...a),
};
