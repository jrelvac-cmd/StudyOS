"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Globe, Loader2, RotateCcw, Square } from "lucide-react";
import { Markdown } from "@/components/ui/Markdown";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils";

type Source = { n: number; courseId: string; title: string; subject: string; date: string; chapters: string[] };
type WebSource = { url: string; title: string };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  webSources?: WebSource[];
  webUsed?: boolean;
  status?: string | null;
  error?: string | null;
  done?: boolean;
};

const SUGGESTIONS = [
  "Explique-moi la loi de l'offre et de la demande vue en cours",
  "Résume le dernier cours que j'ai importé",
  "Quelles notions dois-je réviser en priorité ?",
];

/**
 * Une seule conversation, en mémoire vive : rien n'est enregistré, fermer
 * l'onglet efface tout. L'historique complet est renvoyé à chaque message.
 */
export function Chat({ courseCount, semantic }: { courseCount: number; semantic: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function stop() {
    abortRef.current?.abort();
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: question };
    const assistantId = crypto.randomUUID();
    const history = [...messages, userMsg];
    setMessages([...history, { id: assistantId, role: "assistant", content: "", status: "Je cherche dans tes cours…" }]);
    setBusy(true);

    const patch = (p: Partial<Message> | ((m: Message) => Partial<Message>)) =>
      setMessages((ms) => ms.map((m) => (m.id === assistantId ? { ...m, ...(typeof p === "function" ? p(m) : p) } : m)));

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          webSearch,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        patch({ error: data.error ?? `Erreur ${res.status}`, status: null, done: true });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as
            | { t: "sources"; sources: Source[] }
            | { t: "delta"; text: string }
            | { t: "status"; text: string }
            | { t: "done"; webUsed: boolean; webSources: WebSource[] }
            | { t: "error"; message: string };
          if (ev.t === "sources") patch({ sources: ev.sources });
          else if (ev.t === "delta") patch((m) => ({ content: m.content + ev.text, status: null }));
          else if (ev.t === "status") patch({ status: ev.text });
          else if (ev.t === "done") patch({ webUsed: ev.webUsed, webSources: ev.webSources, status: null, done: true });
          else if (ev.t === "error") patch({ error: ev.message, status: null, done: true });
        }
      }
      patch({ status: null, done: true });
    } catch (err) {
      if ((err as Error).name === "AbortError") patch({ status: null, done: true });
      else patch({ error: "Connexion interrompue", status: null, done: true });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="flex h-dvh flex-col md:h-dvh">
      <header className="chrome sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border px-5 py-3 md:px-8">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Agent</h1>
          <p className="truncate text-xs text-text-3">
            {courseCount} cours indexés
            <span className="hidden sm:inline"> · {semantic ? "recherche sémantique" : "recherche plein texte"}</span> · non enregistré
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              stop();
              setMessages([]);
            }}
            className="btn-ghost shrink-0"
            aria-label="Nouvelle conversation"
          >
            <RotateCcw size={14} /> <span className="hidden sm:inline">Nouvelle conversation</span>
          </button>
        )}
      </header>

      <div className="scroll-edge-top min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.length === 0 && (
            <div className="materialize flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-dim text-accent">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Pose une question sur tes cours</h2>
                <p className="mt-1 max-w-md text-sm text-text-3">
                  Je réponds à partir de tes cours et je cite lesquels. Active « Internet » pour que je complète avec le web, en le signalant.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="pill border border-border bg-surface">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <div ref={bottomRef} className="h-px" />
        </div>
      </div>

      <div className="chrome border-t border-border px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <div className="flex items-end gap-2 rounded-3xl border border-border bg-surface px-3 py-2 focus-within:border-accent/60">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ta question…"
              aria-label="Message"
              className="max-h-[200px] min-h-[2.5rem] flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-text-3"
            />
            {busy ? (
              <button type="button" onClick={stop} className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3 text-text" aria-label="Arrêter">
                <Square size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void send(input)}
                disabled={!input.trim()}
                className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-black disabled:opacity-40"
                aria-label="Envoyer"
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between px-2">
            <Switch checked={webSearch} onChange={setWebSearch} label="Chercher sur internet si mes cours ne suffisent pas" />
            <Globe size={14} className={cn(webSearch ? "text-accent" : "text-text-3")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-accent px-4 py-2.5 text-sm text-black">{message.content}</div>
      </div>
    );
  }
  const usedSources = message.sources?.filter((s) => message.content.includes(`[Source ${s.n}]`)) ?? [];
  const shownSources = usedSources.length ? usedSources : (message.sources ?? []).slice(0, 3);

  return (
    <div className="flex flex-col gap-3">
      {message.status && (
        <div className="flex items-center gap-2 text-xs text-text-3">
          <Loader2 size={12} className="animate-spin" /> {message.status}
        </div>
      )}
      {message.content && <Markdown className="text-[0.95rem]">{message.content}</Markdown>}
      {!message.content && !message.status && !message.error && message.done && (
        <p className="text-sm text-text-3">Réponse vide.</p>
      )}
      {message.error && <p className="text-sm text-danger">{message.error}</p>}

      {message.done && (shownSources.length > 0 || message.webUsed) && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {shownSources.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {shownSources.map((s) => (
                <Link
                  key={s.n}
                  href={`/cours/${s.courseId}`}
                  className="badge badge-accent pressable"
                  title={`${s.title} · ${s.chapters.join(", ") || "sans chapitre"}`}
                >
                  <span className="text-[10px] opacity-70">{s.n}</span>
                  {s.subject} · {s.date}
                  {s.chapters[0] && <span className="opacity-70">· {s.chapters[0]}</span>}
                </Link>
              ))}
            </div>
          )}
          {message.webUsed && (
            <div className="flex flex-col gap-1 text-xs">
              <span className="flex items-center gap-1 font-medium text-text-2">
                <Globe size={12} className="text-accent" /> Complété avec une recherche internet
              </span>
              {message.webSources?.slice(0, 5).map((w) => (
                <a key={w.url} href={w.url} target="_blank" rel="noreferrer" className="truncate text-text-3 underline-offset-2 hover:text-accent hover:underline">
                  {w.title || w.url}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
