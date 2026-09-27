"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ChatMarkdown } from "@/components/chat-markdown";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

interface Conversation {
  id: string;
  title: string;
  sessionId: string | null;
  msgs: Msg[];
  updatedAt: number;
}

const LS_CHATS = "eggseller-chats";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function loadChats(): Conversation[] {
  try {
    const raw = localStorage.getItem(LS_CHATS);
    if (raw) return JSON.parse(raw) as Conversation[];
    // Migra la conversación única anterior, si existe
    const m = localStorage.getItem("eggseller-chat-msgs");
    const s = localStorage.getItem("eggseller-chat-session");
    if (m) {
      const msgs = JSON.parse(m) as Msg[];
      if (msgs.length > 0) {
        const first = msgs.find((x) => x.role === "user")?.text ?? "Anterior";
        return [
          {
            id: uid(),
            title: first.slice(0, 40),
            sessionId: s,
            msgs,
            updatedAt: Date.now(),
          },
        ];
      }
    }
  } catch {}
  return [];
}

export default function ChatPage() {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loaded = loadChats();
    setChats(loaded);
    setActiveId(loaded[0]?.id ?? null);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CHATS, JSON.stringify(chats));
    } catch {}
  }, [chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, activeId, loading]);

  const active = chats.find((c) => c.id === activeId) ?? null;

  function patch(id: string, fn: (c: Conversation) => Conversation) {
    setChats((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  }

  function newChat() {
    const c: Conversation = {
      id: uid(),
      title: "Nueva conversación",
      sessionId: null,
      msgs: [],
      updatedAt: Date.now(),
    };
    setChats((prev) => [c, ...prev]);
    setActiveId(c.id);
    setInput("");
  }

  function removeChat(id: string) {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    let id = activeId;
    if (!id) {
      const c: Conversation = {
        id: uid(),
        title: text.slice(0, 40),
        sessionId: null,
        msgs: [],
        updatedAt: Date.now(),
      };
      setChats((prev) => [c, ...prev]);
      setActiveId(c.id);
      id = c.id;
    }
    const target = id;
    setInput("");
    patch(target, (c) => ({
      ...c,
      title: c.msgs.length === 0 ? text.slice(0, 40) : c.title,
      msgs: [...c.msgs, { role: "user" as const, text }],
      updatedAt: Date.now(),
    }));
    setLoading(true);
    try {
      const conv = chats.find((c) => c.id === target);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          ...(conv?.sessionId ? { sessionId: conv.sessionId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error del chat");
      patch(target, (c) => ({
        ...c,
        sessionId: data.sessionId,
        msgs: [...c.msgs, { role: "assistant" as const, text: data.text }],
        updatedAt: Date.now(),
      }));
    } catch (err) {
      patch(target, (c) => ({
        ...c,
        msgs: [
          ...c.msgs,
          {
            role: "assistant" as const,
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        updatedAt: Date.now(),
      }));
    } finally {
      setLoading(false);
    }
  }

  const msgs = active?.msgs ?? [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6 lg:flex-row">
      <Card className="lg:w-64 lg:shrink-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Historial</CardTitle>
          <Button variant="outline" size="sm" onClick={newChat}>
            <Plus className="size-4" /> Nueva
          </Button>
        </CardHeader>
        <CardContent className="flex max-h-48 flex-col gap-1 overflow-y-auto lg:max-h-none">
          {chats.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sin conversaciones todavía.
            </p>
          )}
          {chats.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
                c.id === activeId ? "bg-muted font-medium" : "hover:bg-muted/60",
              )}
            >
              <button
                className="flex-1 truncate text-left"
                onClick={() => setActiveId(c.id)}
              >
                {c.title}
              </button>
              <button
                aria-label="Eliminar conversación"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => removeChat(c.id)}
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Chat con IA</CardTitle>
          <CardDescription>
            Consulta las ventas con Big Pickle (lee Neo4j vía MCP)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex min-h-64 flex-col gap-2">
            {!active && (
              <p className="text-sm text-muted-foreground">
                Crea una conversación para empezar. Prueba: “¿qué producto se
                vendió más en el Q1?”
              </p>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2",
                  m.role === "user"
                    ? "self-end bg-primary text-sm text-primary-foreground"
                    : "self-start bg-muted",
                )}
              >
                {m.role === "user" ? (
                  <span className="text-sm">{m.text}</span>
                ) : (
                  <ChatMarkdown text={m.text} />
                )}
              </div>
            ))}
            {loading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner /> Pensando…
              </p>
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={send} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta sobre las ventas…"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              Enviar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
