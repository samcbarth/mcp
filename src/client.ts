import type { CallToolResult, Implementation, Tool } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { McpServerConnection, type ConnectionOptions } from './connection.js';
import { ConfigError, NotFoundError } from './errors.js';
import { silentLogger, type Logger } from './logger.js';
import type { ConnectResult, McpConnectConfig, NamespacedTool, ServerConfig } from './types.js';

export interface McpConnectOptions {
  /** Identity advertised to every server during initialization. */
  clientInfo?: Implementation;
  /** Logger shared by the manager and its connections. */
  logger?: Logger;
  /** Separator for namespaced tool ids (e.g. `/` in `hubspot/list_contacts`). */
  toolSeparator?: string;
}

/**
 * The entry point of the library: a manager that owns connections to many MCP
 * servers and exposes an aggregated, namespaced view over their tools.
 *
 * @example
 * ```ts
 * const mcp = McpConnect.fromConfig('./mcp.config.json');
 * await mcp.connectAll();
 * const tools = await mcp.listAllTools();
 * const result = await mcp.callTool('hubspot/list_contacts', { limit: 10 });
 * await mcp.close();
 * ```
 */
export class McpConnect {
  private readonly connections = new Map<string, McpServerConnection>();
  private readonly clientInfo?: Implementation;
  private readonly logger: Logger;
  private readonly toolSeparator: string;

  constructor(options: McpConnectOptions = {}) {
    this.clientInfo = options.clientInfo;
    this.logger = options.logger ?? silentLogger;
    this.toolSeparator = options.toolSeparator ?? '/';
  }

  /** Build a manager from a config object or a path to a JSON config file. */
  static fromConfig(source: McpConnectConfig | string, options: McpConnectOptions = {}): McpConnect {
    const config = loadConfig(source);
    const manager = new McpConnect({
      ...options,
      toolSeparator: options.toolSeparator ?? config.toolSeparator,
    });
    for (const [name, server] of Object.entries(config.servers)) {
      if ((server as { disabled?: boolean }).disabled) continue;
      manager.addServer(name, server);
    }
    return manager;
  }

  private connectionOptions(): ConnectionOptions {
    return { clientInfo: this.clientInfo, logger: this.logger };
  }

  /** Register a server. Does not connect until {@link connect}/{@link connectAll}. */
  addServer(name: string, config: ServerConfig): McpServerConnection {
    if (this.connections.has(name)) {
      throw new ConfigError(`A server named "${name}" is already registered.`);
    }
    const connection = new McpServerConnection(name, config, this.connectionOptions());
    this.connections.set(name, connection);
    return connection;
  }

  /** Remove a server, closing it first if connected. */
  async removeServer(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (!connection) return;
    await connection.close();
    this.connections.delete(name);
  }

  /** Look up a registered server connection by name. */
  getServer(name: string): McpServerConnection {
    const connection = this.connections.get(name);
    if (!connection) {
      throw new NotFoundError(`No server named "${name}" is registered.`);
    }
    return connection;
  }

  /** All registered server connections. */
  servers(): McpServerConnection[] {
    return [...this.connections.values()];
  }

  /** Registered server names. */
  serverNames(): string[] {
    return [...this.connections.keys()];
  }

  /** Connect a single registered server by name. */
  async connect(name: string): Promise<void> {
    await this.getServer(name).connect();
  }

  /**
   * Connect every registered server concurrently. Failures are captured per
   * server rather than aborting the whole batch, so one bad token doesn't take
   * down the others.
   */
  async connectAll(): Promise<ConnectResult[]> {
    const results = await Promise.all(
      this.servers().map(async (connection): Promise<ConnectResult> => {
        try {
          await connection.connect();
          return { server: connection.name, ok: true };
        } catch (error) {
          return { server: connection.name, ok: false, error: error as Error };
        }
      }),
    );
    return results;
  }

  /** Compose a namespaced tool id from a server and tool name. */
  qualify(server: string, tool: string): string {
    return `${server}${this.toolSeparator}${tool}`;
  }

  /** List tools across all connected servers, each namespaced by server. */
  async listAllTools(): Promise<NamespacedTool[]> {
    const perServer = await Promise.all(
      this.servers()
        .filter((c) => c.isConnected)
        .map(async (connection) => {
          const tools = await connection.listTools();
          return tools.map((tool) => this.toNamespaced(connection.name, tool));
        }),
    );
    return perServer.flat();
  }

  private toNamespaced(server: string, tool: Tool): NamespacedTool {
    return {
      server,
      name: tool.name,
      qualifiedName: this.qualify(server, tool.name),
      description: tool.description,
      inputSchema: tool.inputSchema,
    };
  }

  /** Find a bare tool name across connected servers (must be unambiguous). */
  async findTool(name: string): Promise<{ server: string; tool: Tool } | undefined> {
    const matches: { server: string; tool: Tool }[] = [];
    for (const connection of this.servers()) {
      if (!connection.isConnected) continue;
      const tool = (await connection.listTools()).find((t) => t.name === name);
      if (tool) matches.push({ server: connection.name, tool });
    }
    if (matches.length === 0) return undefined;
    if (matches.length > 1) {
      const where = matches.map((m) => this.qualify(m.server, m.tool.name)).join(', ');
      throw new NotFoundError(
        `Tool "${name}" is ambiguous across servers (${where}). Qualify it, e.g. "${where.split(', ')[0]}".`,
      );
    }
    return matches[0];
  }

  /**
   * Call a tool. Accepts either a namespaced id (`hubspot/list_contacts`) or a
   * bare tool name when it's unambiguous across connected servers.
   */
  async callTool(
    ref: string,
    args: Record<string, unknown> = {},
    options: { timeout?: number } = {},
  ): Promise<CallToolResult> {
    const sepIndex = ref.indexOf(this.toolSeparator);
    if (sepIndex !== -1) {
      const serverName = ref.slice(0, sepIndex);
      const tool = ref.slice(sepIndex + this.toolSeparator.length);
      if (this.connections.has(serverName)) {
        return this.getServer(serverName).callTool(tool, args, options);
      }
    }
    const found = await this.findTool(ref);
    if (!found) {
      throw new NotFoundError(
        `Could not resolve tool "${ref}". Qualify it with a server, e.g. "<server>${this.toolSeparator}${ref}".`,
      );
    }
    return this.getServer(found.server).callTool(found.tool.name, args, options);
  }

  /** Close every connection. */
  async close(): Promise<void> {
    await Promise.all(this.servers().map((c) => c.close()));
  }
}
