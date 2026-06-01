import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ConfigError } from './errors.js';
import { isStdioConfig, type RemoteServerConfig, type ResolvedServerConfig } from './types.js';

/** Build the HTTP headers for a remote server, applying the `token` shortcut. */
function buildHeaders(config: RemoteServerConfig): Record<string, string> {
  const headers: Record<string, string> = { ...config.headers };
  const hasAuth = Object.keys(headers).some((k) => k.toLowerCase() === 'authorization');
  if (config.token && !hasAuth) {
    headers['Authorization'] = `Bearer ${config.token}`;
  }
  return headers;
}

/** Construct a Streamable HTTP transport for a remote server. */
export function createStreamableHttpTransport(config: RemoteServerConfig): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: { headers: buildHeaders(config) },
    authProvider: config.authProvider,
  });
}

/** Construct a legacy SSE transport for a remote server. */
export function createSseTransport(config: RemoteServerConfig): SSEClientTransport {
  return new SSEClientTransport(new URL(config.url), {
    requestInit: { headers: buildHeaders(config) },
    authProvider: config.authProvider,
  });
}

/**
 * Build the appropriate transport(s) for a resolved server config.
 *
 * For remote servers with `type: 'auto'` (the default), this returns the
 * Streamable HTTP transport as `primary` and the SSE transport as `fallback`,
 * letting the connection layer retry on the legacy transport if needed.
 */
export function createTransport(config: ResolvedServerConfig): {
  primary: Transport;
  fallback?: Transport;
} {
  if (isStdioConfig(config)) {
    return {
      primary: new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
        cwd: config.cwd,
        stderr: 'inherit',
      }),
    };
  }

  if (typeof config.url !== 'string' || config.url.length === 0) {
    throw new ConfigError('Remote server config requires a non-empty "url".');
  }
  // Validate the URL eagerly for a clearer error than the transport would give.
  try {
    new URL(config.url);
  } catch (cause) {
    throw new ConfigError(`Invalid server URL: "${config.url}".`, { cause });
  }

  const kind = config.type ?? 'auto';
  if (kind === 'sse') {
    return { primary: createSseTransport(config) };
  }
  if (kind === 'http') {
    return { primary: createStreamableHttpTransport(config) };
  }
  // auto
  return {
    primary: createStreamableHttpTransport(config),
    fallback: createSseTransport(config),
  };
}
