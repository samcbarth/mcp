/** Base class for all errors thrown by mcp-connect. */
export class McpConnectError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/** Thrown when a configuration is malformed or references something unknown. */
export class ConfigError extends McpConnectError {}

/** Thrown when an operation requires a connection that isn't established. */
export class NotConnectedError extends McpConnectError {}

/** Thrown when a referenced server or tool cannot be found. */
export class NotFoundError extends McpConnectError {}

/** Thrown when establishing a transport/connection fails. */
export class ConnectionError extends McpConnectError {}
