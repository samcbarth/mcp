import { readFileSync } from 'node:fs';
import { ConfigError } from './errors.js';
import { resolvePreset } from './presets.js';
import {
  isPresetConfig,
  isRemoteConfig,
  isStdioConfig,
  type McpConnectConfig,
  type ResolvedServerConfig,
  type ServerConfig,
} from './types.js';

/**
 * Interpolate `${VAR}` and `${VAR:-default}` references against an environment
 * map. Unknown variables without a default throw, so a typo surfaces early
 * instead of silently sending an empty token.
 */
export function interpolateEnv(value: string, env: NodeJS.ProcessEnv = process.env): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (_match, name: string, fallback?: string) => {
    const resolved = env[name];
    if (resolved !== undefined && resolved !== '') return resolved;
    if (fallback !== undefined) return fallback;
    throw new ConfigError(`Environment variable "${name}" referenced in config is not set.`);
  });
}

/** Recursively interpolate env references in all string values of an object. */
function interpolateDeep<T>(input: T, env: NodeJS.ProcessEnv): T {
  if (typeof input === 'string') return interpolateEnv(input, env) as T;
  if (Array.isArray(input)) return input.map((v) => interpolateDeep(v, env)) as T;
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) out[k] = interpolateDeep(v, env);
    return out as T;
  }
  return input;
}

export interface LoadConfigOptions {
  /** Environment used for `${VAR}` interpolation. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Disable `${VAR}` interpolation entirely. */
  interpolate?: boolean;
}

/**
 * Load and validate configuration from either a parsed object or a path to a
 * JSON file. Preset references are kept intact here; they are expanded by
 * {@link resolveServerConfig} at connection time so that `authProvider`
 * instances (which can't live in JSON) can still be attached in code.
 */
export function loadConfig(
  source: McpConnectConfig | string,
  options: LoadConfigOptions = {},
): McpConnectConfig {
  const env = options.env ?? process.env;
  let raw: unknown;

  if (typeof source === 'string') {
    let text: string;
    try {
      text = readFileSync(source, 'utf8');
    } catch (cause) {
      throw new ConfigError(`Could not read config file at "${source}".`, { cause });
    }
    try {
      raw = JSON.parse(text);
    } catch (cause) {
      throw new ConfigError(`Config file at "${source}" is not valid JSON.`, { cause });
    }
  } else {
    raw = source;
  }

  if (options.interpolate !== false) {
    raw = interpolateDeep(raw, env);
  }

  return validateConfig(raw);
}

/** Validate the shape of a config object, throwing {@link ConfigError} on problems. */
export function validateConfig(raw: unknown): McpConnectConfig {
  if (!raw || typeof raw !== 'object') {
    throw new ConfigError('Config must be an object.');
  }
  const cfg = raw as Partial<McpConnectConfig>;
  if (!cfg.servers || typeof cfg.servers !== 'object') {
    throw new ConfigError('Config must contain a "servers" object.');
  }

  for (const [name, server] of Object.entries(cfg.servers)) {
    if (!server || typeof server !== 'object') {
      throw new ConfigError(`Server "${name}" must be an object.`);
    }
    const isStdio = isStdioConfig(server);
    const isRemote = isRemoteConfig(server);
    const isPreset = isPresetConfig(server);
    if (!isStdio && !isRemote && !isPreset) {
      throw new ConfigError(
        `Server "${name}" must specify one of: "command" (stdio), "url" (remote), or "preset".`,
      );
    }
  }

  return {
    servers: cfg.servers,
    toolSeparator: cfg.toolSeparator ?? '/',
  };
}

/** Expand presets and normalize a single server config into a concrete form. */
export function resolveServerConfig(name: string, config: ServerConfig): ResolvedServerConfig {
  if (isPresetConfig(config)) {
    return resolvePreset(config);
  }
  if (isStdioConfig(config) || isRemoteConfig(config)) {
    return config;
  }
  throw new ConfigError(`Server "${name}" has an unrecognized configuration shape.`);
}
