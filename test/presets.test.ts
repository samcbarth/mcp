import { describe, it, expect } from 'vitest';
import { resolvePreset, registerPreset, presets } from '../src/presets.js';
import { ConfigError } from '../src/errors.js';

describe('hubspot preset', () => {
  it('defaults to the hosted Streamable HTTP endpoint', () => {
    const cfg = resolvePreset({ preset: 'hubspot', token: 't' });
    expect(cfg.url).toBe('https://mcp.hubspot.com');
    expect(cfg.type).toBe('http');
    expect(cfg.token).toBe('t');
  });

  it('allows overriding the url', () => {
    const cfg = resolvePreset({ preset: 'hubspot', url: 'https://eu.mcp.hubspot.com' });
    expect(cfg.url).toBe('https://eu.mcp.hubspot.com');
  });
});

describe('make preset', () => {
  it('defaults to the /stream endpoint', () => {
    const cfg = resolvePreset({ preset: 'make', token: 't' });
    expect(cfg.url).toBe('https://mcp.make.com/stream');
    expect(cfg.token).toBe('t');
  });

  it('builds a zone-specific host', () => {
    const cfg = resolvePreset({ preset: 'make', options: { zone: 'eu2.make.com' } });
    expect(cfg.url).toBe('https://mcp.eu2.make.com/stream');
  });

  it('appends maxToolNameLength as a query param', () => {
    const cfg = resolvePreset({ preset: 'make', options: { maxToolNameLength: 40 } });
    expect(cfg.url).toContain('maxToolNameLength=40');
  });
});

describe('preset registry', () => {
  it('throws on an unknown preset', () => {
    expect(() => resolvePreset({ preset: 'nope' })).toThrow(ConfigError);
  });

  it('supports registering a custom preset', () => {
    registerPreset('custom', (c) => ({ type: 'http', url: c.url ?? 'https://custom.example/mcp' }));
    expect(presets.custom).toBeDefined();
    const cfg = resolvePreset({ preset: 'custom' });
    expect(cfg.url).toBe('https://custom.example/mcp');
  });
});
