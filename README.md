# mcp-connect

A small, configurable TypeScript client library for connecting to and engaging
with **multiple [MCP](https://modelcontextprotocol.io) servers at once** —
HubSpot, Make, and any other — over both **remote** (Streamable HTTP / SSE) and
**local** (stdio) transports.

You give it a config (object or JSON file). It connects to each server, gives
you a single namespaced view of every tool, and lets you call those tools
programmatically. No LLM and no UI are bundled — it's the connectivity layer you
build those on top of.

```ts
import { McpConnect } from 'mcp-connect';

const mcp = McpConnect.fromConfig({
  servers: {
    hubspot: { preset: 'hubspot', token: process.env.HUBSPOT_TOKEN },
    make: { preset: 'make', token: process.env.MAKE_MCP_TOKEN },
    local: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] },
  },
});

await mcp.connectAll();

const tools = await mcp.listAllTools();
// [{ qualifiedName: 'hubspot/crm_list_objects', ... }, { qualifiedName: 'make/run_scenario', ... }, ...]

const result = await mcp.callTool('hubspot/crm_list_objects', { objectType: 'contacts', limit: 10 });
console.log(result.content);

await mcp.close();
```

## Features

- **One library, many servers.** Register any number of MCP servers and address
  their tools through a single, namespaced API (`server/tool`).
- **Remote and local, configurable.** Each server can be a hosted HTTP endpoint
  or a locally-spawned stdio process — chosen per server in config.
- **Presets for HubSpot & Make.** Supply a token; the URLs and transport are
  filled in for you. Easy to register your own presets.
- **Auto transport negotiation.** Remote servers default to Streamable HTTP and
  transparently fall back to the legacy SSE transport when needed.
- **Resilient connect.** `connectAll()` connects concurrently and reports
  failures per-server instead of aborting the batch.
- **`${ENV}` interpolation** in config files, so tokens stay out of source.
- **Typed.** Ships with full TypeScript types, built on the official
  `@modelcontextprotocol/sdk`.

## Install

```bash
npm install mcp-connect
# peer runtime deps are bundled: @modelcontextprotocol/sdk, zod
```

Requires Node.js 18+.

## Configuration

A config is `{ servers: { <name>: <ServerConfig> } }`. Each server is one of
three shapes:

### Preset server

```jsonc
{ "preset": "hubspot", "token": "${HUBSPOT_TOKEN}" }
{ "preset": "make", "token": "${MAKE_MCP_TOKEN}", "options": { "zone": "eu2.make.com" } }
```

| Preset    | Endpoint                        | Auth                                   |
| --------- | ------------------------------- | -------------------------------------- |
| `hubspot` | `https://mcp.hubspot.com`       | OAuth 2.0 + PKCE (`authProvider`) or bearer `token` |
| `make`    | `https://mcp.make.com/stream`   | MCP `token` (sent as `Authorization`)  |

Make options: `zone` (region host, e.g. `eu2.make.com`) and `maxToolNameLength`.

### Remote server

```jsonc
{
  "type": "auto",                     // "http" | "sse" | "auto" (default)
  "url": "https://mcp.example.com/mcp",
  "token": "${API_TOKEN}",            // shortcut for Authorization: Bearer ...
  "headers": { "X-Api-Key": "${KEY}" },
  "timeout": 30000                     // default per-request timeout (ms)
}
```

### Local (stdio) server

```jsonc
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
  "env": { "FOO": "bar" },
  "cwd": "/some/dir"
}
```

Any server may also set `"disabled": true` to keep it in config but skip it.

### Loading from a file

```ts
const mcp = McpConnect.fromConfig('./mcp.config.json');
```

String values support `${VAR}` and `${VAR:-default}` interpolation against
`process.env`. A referenced variable that is unset (and has no default) throws a
`ConfigError` at load time, so a missing token fails loudly instead of sending an
empty header. See [`examples/mcp.config.example.json`](./examples/mcp.config.example.json).

> OAuth `authProvider` instances can't live in JSON. For presets/servers that
> need one, load the rest from a file and attach the provider in code, or build
> the config object inline.

## API

### `McpConnect`

| Method | Description |
| ------ | ----------- |
| `McpConnect.fromConfig(source, options?)` | Build a manager from a config object or JSON file path. |
| `addServer(name, config)` | Register a server (does not connect). |
| `removeServer(name)` | Close and unregister a server. |
| `getServer(name)` | Get the underlying `McpServerConnection`. |
| `servers()` / `serverNames()` | List registered connections / names. |
| `connect(name)` | Connect one server. |
| `connectAll()` | Connect all concurrently; returns `ConnectResult[]`. |
| `listAllTools()` | Namespaced tools across all connected servers. |
| `findTool(name)` | Resolve a bare tool name (errors if ambiguous). |
| `callTool(ref, args?, opts?)` | Call a tool by `server/tool` id or a bare, unambiguous name. |
| `qualify(server, tool)` | Build a namespaced tool id. |
| `close()` | Close every connection. |

### `McpServerConnection`

A single server, exposed for finer control: `connect()`, `isConnected`,
`listTools(force?)`, `callTool(name, args?, opts?)`, `listPrompts()`,
`getPrompt(name, args?)`, `listResources()`, `readResource(uri)`,
`serverInfo()`, `capabilities()`, `close()`.

```ts
const hs = mcp.getServer('hubspot');
const tools = await hs.listTools();
const res = await hs.callTool('crm_list_objects', { objectType: 'contacts' });
```

### Custom presets

```ts
import { registerPreset } from 'mcp-connect';

registerPreset('acme', (cfg) => ({
  type: 'http',
  url: cfg.url ?? 'https://mcp.acme.com',
  token: cfg.token,
}));
// then: { preset: 'acme', token: '...' }
```

### Logging

Pass a `logger` (the bundled `consoleLogger`, or your own implementing the
`Logger` interface) to surface connection diagnostics. Defaults to silent.

```ts
import { consoleLogger } from 'mcp-connect';
McpConnect.fromConfig(cfg, { logger: consoleLogger });
```

### Errors

All errors extend `McpConnectError`: `ConfigError`, `ConnectionError`,
`NotConnectedError`, `NotFoundError`.

## Development

```bash
npm install
npm run build       # compile to dist/
npm test            # unit + an end-to-end stdio integration test
npm run typecheck
```

The test suite includes an end-to-end check that spawns a real fixture MCP
server over stdio ([`test/fixtures/echo-server.ts`](./test/fixtures/echo-server.ts))
and drives it through the public API — no network required.

## License

MIT
