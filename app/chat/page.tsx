"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

const LS_MSGS = "eggseller-chat-msgs";
const LS_SESSION = "eggseller-chat-session";

export default function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const m = localStorage.getItem(LS_MSGS);
      const s = localStorage.getItem(LS_SESSION);
      if (m) setMsgs(JSON.parse(m));
      if (s) setSessionId(s);
    } catch {}
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    try {
      localStorage.setItem(LS_MSGS, JSON.stringify(msgs));
    } catch {}
  }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next = [...msgs, { role: "user" as const, text }];
    setMsgs(next);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error del chat");
      setSessionId(data.sessionId);
      try {
        localStorage.setItem(LS_SESSION, data.sessionId);
      } catch {}
      setMsgs([...next, { role: "assistant" as const, text: data.text }]);
    } catch (err) {
      setMsgs([
        ...next,
        {
          role: "assistant",
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMsgs([]);
    setSessionId(null);
    try {
      localStorage.removeItem(LS_MSGS);
      localStorage.removeItem(LS_SESSION);
    } catch {}
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Chat con IA</CardTitle>
              <CardDescription>
                Consulta las ventas con Big Pickle (lee Neo4j vía MCP)
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>
              Nueva conversación
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex min-h-64 flex-col gap-2">
            {msgs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Prueba: “¿qué producto se vendió más en el Q1?”
              </p>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  m.role === "user"
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start bg-muted",
                )}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <p className="text-sm text-muted-foreground">Pensando…</p>
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
