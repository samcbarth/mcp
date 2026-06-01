import { describe, it, expect, afterAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { McpConnect } from '../src/client.js';

const here = dirname(fileURLToPath(import.meta.url));
const echoServer = join(here, 'fixtures', 'echo-server.ts');

/**
 * End-to-end test: spawn the fixture MCP server over stdio, then drive it
 * through the public McpConnect API exactly as a consumer would.
 */
describe('McpConnect end-to-end (stdio)', () => {
  const mcp = McpConnect.fromConfig({
    servers: {
      echo: { command: 'npx', args: ['tsx', echoServer] },
    },
  });

  afterAll(async () => {
    await mcp.close();
  });

  it('connects, lists tools, and calls a tool', async () => {
    const results = await mcp.connectAll();
    expect(results).toEqual([{ server: 'echo', ok: true }]);

    const tools = await mcp.listAllTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      server: 'echo',
      name: 'echo',
      qualifiedName: 'echo/echo',
    });

    const byQualified = await mcp.callTool('echo/echo', { message: 'hello' });
    expect(byQualified.content).toEqual([{ type: 'text', text: 'echo: hello' }]);

    // Bare, unambiguous tool name resolves too.
    const byBare = await mcp.callTool('echo', { message: 'world' });
    expect(byBare.content).toEqual([{ type: 'text', text: 'echo: world' }]);
  }, 30_000);
});
