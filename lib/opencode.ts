import { statSync } from "node:fs";
import { createServer } from "node:net";
import { createOpencode, type OpencodeClient } from "@opencode-ai/sdk";
import type { Config } from "@opencode-ai/sdk";

interface OpencodeInstance {
  client: OpencodeClient;
  server: { url: string; close(): void };
}

let instance: OpencodeInstance | null = null;

function ensureProjectBinFirst(): void {
  // Siempre el binario pineado del proyecto, nunca el del entorno global:
  // el SDK 1.18.32 solo entiende al CLI 1.18.x (línea "opencode server
  // listening"). El binario global del usuario (v2.x) es incompatible.
  const override = process.env.OPENCODE_BIN_DIR;
  const projectBin = `${process.cwd()}/node_modules/.bin`;
  const dir = override ?? projectBin;
  try {
    statSync(override ? dir : `${dir}/opencode`);
  } catch {
    throw new Error(
      `No se encontró el binario opencode en ${dir}. Ejecuta npm install.`,
    );
  }
  const parts = (process.env.PATH ?? "").split(":").filter((p) => p !== dir);
  process.env.PATH = `${dir}:${parts.join(":")}`;
}

/** Puerto libre empezando en `base` (el hijo puede quedar huérfano tras un hot-reload). */
function findFreePort(base: number): Promise<number> {
  return new Promise((resolve) => {
    const tryPort = (port: number, attempts: number) => {
      if (attempts <= 0) return resolve(base);
      const srv = createServer();
      srv.once("error", () => {
        srv.close();
        tryPort(port + 1, attempts - 1);
      });
      srv.listen(port, "127.0.0.1", () => {
        srv.close(() => resolve(port));
      });
    };
    tryPort(base, 20);
  });
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
  ensureProjectBinFirst();
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
    port: await findFreePort(Number(process.env.OPENCODE_PORT ?? "4096")),
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
