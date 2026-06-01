/**
 * A minimal MCP server used by the integration test. It exposes a single
 * `echo` tool over stdio so we can verify the client end-to-end without any
 * network access.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'echo-server', version: '0.0.1' });

server.registerTool(
  'echo',
  {
    description: 'Echo back the provided message.',
    inputSchema: { message: z.string() },
  },
  async ({ message }) => ({
    content: [{ type: 'text', text: `echo: ${message}` }],
  }),
);

await server.connect(new StdioServerTransport());
