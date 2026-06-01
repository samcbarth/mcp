import { describe, it, expect } from 'vitest';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createTransport } from '../src/transport.js';
import { ConfigError } from '../src/errors.js';

describe('createTransport', () => {
  it('builds a stdio transport for command configs', () => {
    const { primary, fallback } = createTransport({ command: 'node', args: ['s.js'] });
    expect(primary).toBeInstanceOf(StdioClientTransport);
    expect(fallback).toBeUndefined();
  });

  it('builds a Streamable HTTP transport for type "http"', () => {
    const { primary, fallback } = createTransport({ type: 'http', url: 'https://x.example/mcp' });
    expect(primary).toBeInstanceOf(StreamableHTTPClientTransport);
    expect(fallback).toBeUndefined();
  });

  it('builds an SSE transport for type "sse"', () => {
    const { primary } = createTransport({ type: 'sse', url: 'https://x.example/mcp' });
    expect(primary).toBeInstanceOf(SSEClientTransport);
  });

  it('builds primary HTTP + SSE fallback for "auto"', () => {
    const { primary, fallback } = createTransport({ type: 'auto', url: 'https://x.example/mcp' });
    expect(primary).toBeInstanceOf(StreamableHTTPClientTransport);
    expect(fallback).toBeInstanceOf(SSEClientTransport);
  });

  it('defaults to auto when no type is given', () => {
    const { fallback } = createTransport({ url: 'https://x.example/mcp' });
    expect(fallback).toBeInstanceOf(SSEClientTransport);
  });

  it('throws on an invalid url', () => {
    expect(() => createTransport({ type: 'http', url: 'not a url' })).toThrow(ConfigError);
  });
});
