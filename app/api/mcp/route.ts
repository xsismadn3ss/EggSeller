export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp-tools";

/**
 * MCP embebido (stateless): una instancia fresca por request.
 * El cleanup se difiere hasta que el body del stream se envía por
 * completo; cerrar antes rompe el SSE a mitad de escritura.
 */
export async function POST(request: Request) {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  const cleanup = () => {
    void Promise.allSettled([server.close(), transport.close()]);
  };
  if (response.body) {
    const { readable, writable } = new TransformStream();
    response.body.pipeTo(writable).then(cleanup, cleanup);
    return new Response(readable, {
      status: response.status,
      headers: response.headers,
    });
  }
  cleanup();
  return response;
}

export async function GET() {
  return Response.json({ error: "MCP stateless: usa POST" }, { status: 405 });
}

export async function DELETE() {
  return Response.json({ error: "MCP stateless: usa POST" }, { status: 405 });
}
