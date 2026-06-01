import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  CallToolResult,
  GetPromptResult,
  Implementation,
  ListPromptsResult,
  ListResourcesResult,
  ReadResourceResult,
  ServerCapabilities,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ConnectionError, NotConnectedError } from './errors.js';
import { silentLogger, type Logger } from './logger.js';
import { createTransport } from './transport.js';
import { resolveServerConfig } from './config.js';
import type { ResolvedServerConfig, ServerConfig } from './types.js';

export interface ConnectionOptions {
  /** Identity advertised to the server during initialization. */
  clientInfo?: Implementation;
  /** Logger for connection diagnostics. Defaults to a silent logger. */
  logger?: Logger;
}

/**
 * A connection to a single MCP server. Wraps the SDK {@link Client}, builds the
 * right transport from config, and exposes a focused, ergonomic surface for the
 * primitives most callers need: tools, prompts and resources.
 */
export class McpServerConnection {
  readonly name: string;
  readonly config: ResolvedServerConfig;

  private readonly clientInfo: Implementation;
  private readonly logger: Logger;
  private client?: Client;
  private toolCache?: Tool[];

  constructor(name: string, config: ServerConfig, options: ConnectionOptions = {}) {
    this.name = name;
    this.config = resolveServerConfig(name, config);
    this.clientInfo = options.clientInfo ?? { name: 'mcp-connect', version: '0.1.0' };
    this.logger = options.logger ?? silentLogger;
  }

  /** Whether the underlying client is currently connected. */
  get isConnected(): boolean {
    return this.client !== undefined;
  }

  /**
   * Establish the connection. For `auto` remote servers this tries Streamable
   * HTTP first and transparently falls back to the legacy SSE transport.
   */
  async connect(): Promise<void> {
    if (this.client) return;

    const { primary, fallback } = createTransport(this.config);
    try {
      this.client = await this.tryConnect(primary);
      this.logger.info(`Connected to "${this.name}".`);
    } catch (primaryError) {
      if (!fallback) {
        throw new ConnectionError(`Failed to connect to "${this.name}".`, { cause: primaryError });
      }
      this.logger.warn(
        `Streamable HTTP connection to "${this.name}" failed; falling back to SSE.`,
        primaryError,
      );
      try {
        this.client = await this.tryConnect(fallback);
        this.logger.info(`Connected to "${this.name}" over SSE.`);
      } catch (fallbackError) {
        throw new ConnectionError(
          `Failed to connect to "${this.name}" over both Streamable HTTP and SSE.`,
          { cause: fallbackError },
        );
      }
    }
  }

  private async tryConnect(transport: Transport): Promise<Client> {
    const client = new Client(this.clientInfo, { capabilities: {} });
    await client.connect(transport);
    return client;
  }

  private requireClient(): Client {
    if (!this.client) {
      throw new NotConnectedError(`Server "${this.name}" is not connected. Call connect() first.`);
    }
    return this.client;
  }

  /** The server's reported name and version (available after connecting). */
  serverInfo(): Implementation | undefined {
    return this.client?.getServerVersion();
  }

  /** The server's advertised capabilities (available after connecting). */
  capabilities(): ServerCapabilities | undefined {
    return this.client?.getServerCapabilities();
  }

  /** List the server's tools. Results are cached; pass `force` to refresh. */
  async listTools(force = false): Promise<Tool[]> {
    if (this.toolCache && !force) return this.toolCache;
    const { tools } = await this.requireClient().listTools();
    this.toolCache = tools;
    return tools;
  }

  /** Invoke a tool by name with the given arguments. */
  async callTool(
    name: string,
    args: Record<string, unknown> = {},
    options: { timeout?: number } = {},
  ): Promise<CallToolResult> {
    const result = await this.requireClient().callTool(
      { name, arguments: args },
      undefined,
      { timeout: options.timeout ?? this.config.timeout },
    );
    return result as CallToolResult;
  }

  /** List the server's prompts. */
  async listPrompts(): Promise<ListPromptsResult> {
    return this.requireClient().listPrompts();
  }

  /** Fetch a prompt by name with optional arguments. */
  async getPrompt(name: string, args: Record<string, string> = {}): Promise<GetPromptResult> {
    return this.requireClient().getPrompt({ name, arguments: args });
  }

  /** List the server's resources. */
  async listResources(): Promise<ListResourcesResult> {
    return this.requireClient().listResources();
  }

  /** Read a resource by URI. */
  async readResource(uri: string): Promise<ReadResourceResult> {
    return this.requireClient().readResource({ uri });
  }

  /** Close the connection and release the transport. */
  async close(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.close();
    } finally {
      this.client = undefined;
      this.toolCache = undefined;
      this.logger.info(`Closed connection to "${this.name}".`);
    }
  }
}
