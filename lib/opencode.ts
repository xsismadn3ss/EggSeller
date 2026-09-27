import { createOpencode, type OpencodeClient } from "@opencode-ai/sdk";
import type { Config } from "@opencode-ai/sdk";

interface OpencodeInstance {
  client: OpencodeClient;
  server: { url: string; close(): void };
}

let instance: OpencodeInstance | null = null;

function ensureBinOnPath(): void {
  const candidates = [
    process.env.OPENCODE_BIN_DIR,
    // CLI parejo del SDK, instalado como dependencia del proyecto
    `${process.cwd()}/node_modules/.bin`,
    process.env.HOME ? `${process.env.HOME}/.opencode/bin` : undefined,
  ].filter(Boolean) as string[];
  const path = process.env.PATH ?? "";
  for (const dir of candidates) {
    if (!path.split(":").includes(dir)) {
      process.env.PATH = `${dir}:${path}`;
      return;
    }
  }
}

function baseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  return `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
}

/** Singleton servidor+cliente OpenCode (solo server-side). */
export async function getOpencode(): Promise<OpencodeInstance> {
  if (instance) return instance;
  if (!process.env.OPENCODE_API_KEY) {
    throw new Error("Falta variable de entorno OPENCODE_API_KEY");
  }
  ensureBinOnPath();
  // NOTA: no usar `permission: {edit/bash: deny}` aquí: el gateway
  // gratuito de OpenCode (zen) responde 403 FreeTierError cuando se
  // incluye ese bloque. Endurecer luego con un agente custom de solo
  // lectura (AgentConfig.tools) cuando se use una clave de pago.
  const config: Config = {
    // Big Pickle: modelo gratuito de OpenCode, se usa siempre
    model: process.env.OPENCODE_MODEL ?? "opencode/big-pickle",
    mcp: {
      eggseller: {
        type: "remote",
        url: `${baseUrl()}/api/mcp`,
      },
    },
    share: "disabled",
  };
  instance = await createOpencode({
    hostname: "127.0.0.1",
    port: Number(process.env.OPENCODE_PORT ?? "4096"),
    timeout: Number(process.env.OPENCODE_TIMEOUT_MS ?? "30000"),
    config,
  });
  return instance;
}

export interface ChatReply {
  sessionId: string;
  text: string;
}

/** Envía un mensaje a una sesión (creándola si es nueva) y devuelve el texto agregado. */
export async function chat(
  message: string,
  sessionId?: string,
): Promise<ChatReply> {
  const { client } = await getOpencode();
  let id = sessionId;
  if (!id) {
    const created = await client.session.create({ body: { title: "EggSeller chat" } });
    if (created.error) throw new Error(`session.create: ${JSON.stringify(created.error)}`);
    id = created.data.id;
  }
  const res = await client.session.prompt({
    path: { id },
    body: {
      parts: [{ type: "text", text: message }],
    },
  });
  if (res.error) throw new Error(`session.prompt: ${JSON.stringify(res.error)}`);
  const text = (res.data.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n");
  return { sessionId: id, text };
}
