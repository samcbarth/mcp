import { describe, it, expect } from 'vitest';
import { McpConnect } from '../src/client.js';
import { ConfigError, NotFoundError } from '../src/errors.js';

describe('McpConnect registration', () => {
  it('registers servers from a config object', () => {
    const mcp = McpConnect.fromConfig({
      servers: {
        hubspot: { preset: 'hubspot', token: 't' },
        make: { preset: 'make', token: 't' },
      },
    });
    expect(mcp.serverNames().sort()).toEqual(['hubspot', 'make']);
  });

  it('skips disabled servers', () => {
    const mcp = McpConnect.fromConfig({
      servers: {
        on: { url: 'https://x.example/mcp' },
        off: { url: 'https://y.example/mcp', disabled: true },
      },
    });
    expect(mcp.serverNames()).toEqual(['on']);
  });

  it('throws when adding a duplicate server name', () => {
    const mcp = new McpConnect();
    mcp.addServer('a', { url: 'https://x.example/mcp' });
    expect(() => mcp.addServer('a', { url: 'https://y.example/mcp' })).toThrow(ConfigError);
  });

  it('throws when getting an unknown server', () => {
    const mcp = new McpConnect();
    expect(() => mcp.getServer('nope')).toThrow(NotFoundError);
  });

  it('namespaces tool ids with the configured separator', () => {
    const mcp = new McpConnect({ toolSeparator: '__' });
    expect(mcp.qualify('hubspot', 'list_contacts')).toBe('hubspot__list_contacts');
  });

  it('honors the tool separator from config', () => {
    const mcp = McpConnect.fromConfig({ servers: {}, toolSeparator: ':' });
    expect(mcp.qualify('s', 't')).toBe('s:t');
  });
});
