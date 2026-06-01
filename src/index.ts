/**
 * mcp-connect — a configurable TypeScript client library for connecting to and
 * engaging with multiple MCP servers (HubSpot, Make, and any other) over both
 * remote (HTTP/SSE) and local (stdio) transports.
 */

export { McpConnect, type McpConnectOptions } from './client.js';
export { McpServerConnection, type ConnectionOptions } from './connection.js';

export {
  loadConfig,
  validateConfig,
  resolveServerConfig,
  interpolateEnv,
  type LoadConfigOptions,
} from './config.js';

export {
  createTransport,
  createStreamableHttpTransport,
  createSseTransport,
} from './transport.js';

export {
  presets,
  registerPreset,
  resolvePreset,
  hubspotPreset,
  makePreset,
  type Preset,
} from './presets.js';

export {
  McpConnectError,
  ConfigError,
  ConnectionError,
  NotConnectedError,
  NotFoundError,
} from './errors.js';

export { silentLogger, consoleLogger, type Logger } from './logger.js';

export {
  isStdioConfig,
  isRemoteConfig,
  isPresetConfig,
  type McpConnectConfig,
  type ServerConfig,
  type ResolvedServerConfig,
  type StdioServerConfig,
  type RemoteServerConfig,
  type PresetServerConfig,
  type RemoteTransportKind,
  type ConnectResult,
  type NamespacedTool,
} from './types.js';
