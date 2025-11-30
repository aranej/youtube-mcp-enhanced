import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createYouTubeMcpServer } from './server-utils.js';

export async function startMcpServer() {
    const server = createYouTubeMcpServer();

    // Create transport and connect
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Log the server info to stderr (stdout is reserved for JSON-RPC)
    console.error(`YouTube MCP Server started successfully`);
    console.error(`Server will validate YouTube API key when tools are called`);

    return server;
}