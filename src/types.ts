import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';

/**
 * How a remote server should be reached.
 *
 * - `http`: MCP Streamable HTTP transport (the modern default).
 * - `sse`: Legacy HTTP+SSE transport. Some servers still only speak this.
 * - `auto`: Try Streamable HTTP first and transparently fall back to SSE if
 *   the server appears to only support the legacy transport.
 */
export type RemoteTransportKind = 'http' | 'sse' | 'auto';

/** Configuration for a server launched locally and spoken to over stdio. */
export interface StdioServerConfig {
  /** Explicit discriminator. Optional — inferred from the presence of `command`. */
  type?: 'stdio';
  /** Executable to spawn, e.g. `npx`. */
  command: string;
  /** Arguments passed to the executable. */
  args?: string[];
  /** Extra environment variables for the child process. */
  env?: Record<string, string>;
  /** Working directory for the child process. */
  cwd?: string;
  /** Disable this server without removing it from config. */
  disabled?: boolean;
  /** Default per-request timeout in milliseconds. */
  timeout?: number;
}

/** Configuration for a remote server reached over HTTP (Streamable HTTP or SSE). */
export interface RemoteServerConfig {
  type?: RemoteTransportKind;
  /** Endpoint URL of the remote MCP server. */
  url: string;
  /** Extra HTTP headers sent with every request. */
  headers?: Record<string, string>;
  /**
   * Convenience for bearer auth. When set, an `Authorization: Bearer <token>`
   * header is added (unless `headers` already defines `Authorization`).
   */
  token?: string;
  /** OAuth client provider for servers that require an OAuth/PKCE flow (e.g. HubSpot). */
  authProvider?: OAuthClientProvider;
  /** Disable this server without removing it from config. */
  disabled?: boolean;
  /** Default per-request timeout in milliseconds. */
  timeout?: number;
}

/** A reference to a built-in preset (e.g. `hubspot`, `make`) plus its options. */
export interface PresetServerConfig {
  /** Name of a registered preset. */
  preset: string;
  /** A bearer token / API key forwarded to the preset. */
  token?: string;
  /** Override the preset's default URL. */
  url?: string;
  /** Extra headers merged on top of the preset's defaults. */
  headers?: Record<string, string>;
  /** OAuth client provider, for presets that support it. */
  authProvider?: OAuthClientProvider;
  /** Preset-specific options (e.g. Make's `zone`). */
  options?: Record<string, unknown>;
  /** Disable this server without removing it from config. */
  disabled?: boolean;
  /** Default per-request timeout in milliseconds. */
  timeout?: number;
}

/** Any accepted form of a single server's configuration. */
export type ServerConfig = StdioServerConfig | RemoteServerConfig | PresetServerConfig;

/** A resolved server config — presets have been expanded away. */
export type ResolvedServerConfig = StdioServerConfig | RemoteServerConfig;

/** Top-level configuration: a named map of servers. */
export interface McpConnectConfig {
  /** Map of server name -> server configuration. */
  servers: Record<string, ServerConfig>;
  /**
   * Separator used when namespacing tool names across servers, e.g. the `/`
   * in `hubspot/list_contacts`. Defaults to `/`.
   */
  toolSeparator?: string;
}

/** Result of attempting to connect a single server. */
export interface ConnectResult {
  server: string;
  ok: boolean;
  error?: Error;
}

/** A tool, annotated with the server it belongs to and its namespaced id. */
export interface NamespacedTool {
  /** Server name the tool belongs to. */
  server: string;
  /** Bare tool name as reported by the server. */
  name: string;
  /** Namespaced id, e.g. `hubspot/list_contacts`. */
  qualifiedName: string;
  /** Human-readable description, if provided by the server. */
  description?: string;
  /** JSON Schema for the tool's input, if provided. */
  inputSchema?: unknown;
}

/** Type guards. */
export function isStdioConfig(c: ServerConfig): c is StdioServerConfig {
  return (
    (c as StdioServerConfig).type === 'stdio' ||
    (!('preset' in c) && typeof (c as StdioServerConfig).command === 'string')
  );
}

export function isPresetConfig(c: ServerConfig): c is PresetServerConfig {
  return typeof (c as PresetServerConfig).preset === 'string';
}

export function isRemoteConfig(c: ServerConfig): c is RemoteServerConfig {
  return !isPresetConfig(c) && typeof (c as RemoteServerConfig).url === 'string';
}
