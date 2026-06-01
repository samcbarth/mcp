import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { interpolateEnv, loadConfig, validateConfig, resolveServerConfig } from '../src/config.js';
import { ConfigError } from '../src/errors.js';

describe('interpolateEnv', () => {
  const env = { TOKEN: 'abc123', EMPTY: '' };

  it('substitutes a defined variable', () => {
    expect(interpolateEnv('Bearer ${TOKEN}', env)).toBe('Bearer abc123');
  });

  it('uses the default when a variable is unset', () => {
    expect(interpolateEnv('${MISSING:-fallback}', env)).toBe('fallback');
  });

  it('treats an empty variable as unset and uses the default', () => {
    expect(interpolateEnv('${EMPTY:-fallback}', env)).toBe('fallback');
  });

  it('throws on an unset variable with no default', () => {
    expect(() => interpolateEnv('${MISSING}', env)).toThrow(ConfigError);
  });

  it('leaves plain strings untouched', () => {
    expect(interpolateEnv('no vars here', env)).toBe('no vars here');
  });
});

describe('validateConfig', () => {
  it('accepts a valid stdio server', () => {
    const cfg = validateConfig({ servers: { local: { command: 'npx', args: ['x'] } } });
    expect(cfg.servers.local).toBeDefined();
    expect(cfg.toolSeparator).toBe('/');
  });

  it('accepts a valid remote server', () => {
    const cfg = validateConfig({ servers: { remote: { url: 'https://example.com/mcp' } } });
    expect(cfg.servers.remote).toBeDefined();
  });

  it('accepts a preset server', () => {
    const cfg = validateConfig({ servers: { hs: { preset: 'hubspot', token: 't' } } });
    expect(cfg.servers.hs).toBeDefined();
  });

  it('rejects a config with no servers object', () => {
    expect(() => validateConfig({})).toThrow(ConfigError);
  });

  it('rejects a server with neither command, url, nor preset', () => {
    expect(() => validateConfig({ servers: { bad: { foo: 'bar' } } })).toThrow(ConfigError);
  });

  it('honors a custom tool separator', () => {
    const cfg = validateConfig({ servers: {}, toolSeparator: '__' });
    expect(cfg.toolSeparator).toBe('__');
  });
});

describe('loadConfig from file', () => {
  it('reads JSON and interpolates env', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-connect-'));
    const file = join(dir, 'mcp.json');
    writeFileSync(
      file,
      JSON.stringify({ servers: { make: { preset: 'make', token: '${MY_TOKEN}' } } }),
    );
    const cfg = loadConfig(file, { env: { MY_TOKEN: 'secret' } as NodeJS.ProcessEnv });
    expect((cfg.servers.make as { token?: string }).token).toBe('secret');
  });

  it('throws a ConfigError for a missing file', () => {
    expect(() => loadConfig('/no/such/file.json')).toThrow(ConfigError);
  });
});

describe('resolveServerConfig', () => {
  it('expands a preset into a remote config', () => {
    const resolved = resolveServerConfig('hs', { preset: 'hubspot', token: 't' });
    expect('url' in resolved && resolved.url).toBe('https://mcp.hubspot.com');
  });

  it('passes stdio configs through unchanged', () => {
    const resolved = resolveServerConfig('local', { command: 'node', args: ['s.js'] });
    expect('command' in resolved && resolved.command).toBe('node');
  });
});
