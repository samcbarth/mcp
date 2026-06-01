import { ConfigError } from './errors.js';
import type { PresetServerConfig, RemoteServerConfig } from './types.js';

/**
 * A preset turns a small set of options into a full {@link RemoteServerConfig}
 * for a known MCP provider, so callers only need to supply a token.
 */
export type Preset = (config: PresetServerConfig) => RemoteServerConfig;

/**
 * HubSpot's remote MCP server.
 *
 * Endpoint: https://mcp.hubspot.com (Streamable HTTP).
 * Auth: OAuth 2.0 with PKCE (pass an `authProvider`) or, where supported, a
 * bearer token via `token`.
 *
 * @see https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server
 */
export const hubspotPreset: Preset = (config) => {
  return {
    type: 'http',
    url: config.url ?? 'https://mcp.hubspot.com',
    token: config.token,
    authProvider: config.authProvider,
    headers: config.headers,
    timeout: config.timeout,
    disabled: config.disabled,
  };
};

/**
 * Make's remote MCP server.
 *
 * Endpoint: https://mcp.make.com/stream (Streamable HTTP). Generate an MCP
 * token in your Make profile and pass it as `token`; it is sent in the
 * `Authorization` header.
 *
 * Options:
 * - `zone`: Your Make zone host (e.g. `eu2.make.com`) if you need a
 *   region-specific endpoint. Overridden by an explicit `url`.
 * - `maxToolNameLength`: Sets the `?maxToolNameLength=` query parameter.
 *
 * @see https://developers.make.com/mcp-server
 */
export const makePreset: Preset = (config) => {
  const zone = config.options?.['zone'];
  const maxToolNameLength = config.options?.['maxToolNameLength'];

  let url = config.url;
  if (!url) {
    const host = typeof zone === 'string' && zone.length > 0 ? `mcp.${zone}` : 'mcp.make.com';
    url = `https://${host}/stream`;
  }
  if (typeof maxToolNameLength === 'number') {
    const u = new URL(url);
    u.searchParams.set('maxToolNameLength', String(maxToolNameLength));
    url = u.toString();
  }

  return {
    type: 'http',
    url,
    token: config.token,
    authProvider: config.authProvider,
    headers: config.headers,
    timeout: config.timeout,
    disabled: config.disabled,
  };
};

/** The built-in preset registry. Extend it with {@link registerPreset}. */
export const presets: Record<string, Preset> = {
  hubspot: hubspotPreset,
  make: makePreset,
};

/** Register a custom preset (or override a built-in one). */
export function registerPreset(name: string, preset: Preset): void {
  presets[name] = preset;
}

/** Expand a preset reference into a concrete remote server config. */
export function resolvePreset(config: PresetServerConfig): RemoteServerConfig {
  const preset = presets[config.preset];
  if (!preset) {
    const known = Object.keys(presets).join(', ') || '(none)';
    throw new ConfigError(`Unknown preset "${config.preset}". Known presets: ${known}.`);
  }
  return preset(config);
}
