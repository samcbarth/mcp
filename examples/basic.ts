/**
 * Basic usage example.
 *
 * Run with:  npx tsx examples/basic.ts
 *
 * Set HUBSPOT_TOKEN and/or MAKE_MCP_TOKEN in your environment (or a .env file
 * loaded however you prefer) before running against the real services.
 */
import { McpConnect, consoleLogger } from '../src/index.js';

async function main() {
  // You can load from a JSON file (with ${ENV} interpolation)...
  //   const mcp = McpConnect.fromConfig('./examples/mcp.config.example.json', { logger: consoleLogger });
  //
  // ...or build the config inline:
  const mcp = McpConnect.fromConfig(
    {
      servers: {
        hubspot: { preset: 'hubspot', token: process.env.HUBSPOT_TOKEN ?? '' },
        make: { preset: 'make', token: process.env.MAKE_MCP_TOKEN ?? '' },
      },
    },
    { logger: consoleLogger },
  );

  // Connect everything; failures are reported per-server, not thrown.
  const results = await mcp.connectAll();
  for (const r of results) {
    console.log(r.ok ? `✓ connected: ${r.server}` : `✗ ${r.server}: ${r.error?.message}`);
  }

  // Discover every tool across all connected servers, namespaced by server.
  const tools = await mcp.listAllTools();
  console.log(`\nDiscovered ${tools.length} tools:`);
  for (const t of tools) {
    console.log(`  - ${t.qualifiedName}${t.description ? ` — ${t.description}` : ''}`);
  }

  // Call a specific tool. Use the namespaced id to be explicit:
  //   const res = await mcp.callTool('hubspot/crm_list_objects', { objectType: 'contacts', limit: 5 });
  //   console.log(res.content);

  await mcp.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
