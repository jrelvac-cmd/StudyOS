"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Delete, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const LENGTH = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export function CodePad() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shaking, setShaking] = useState(false);
  const submittingRef = useRef(false);

  const submit = useCallback(
    async (value: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: value }),
        });
        if (res.ok) {
          router.replace("/planning");
          router.refresh();
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Code incorrect");
        setShaking(true);
        setTimeout(() => {
          setShaking(false);
          setCode("");
        }, 500);
      } catch {
        setError("Connexion impossible");
      } finally {
        setBusy(false);
        submittingRef.current = false;
      }
    },
    [router],
  );

  const press = useCallback(
    (key: string) => {
      if (busy) return;
      if (key === "⌫") {
        setCode((c) => c.slice(0, -1));
        return;
      }
      if (!/^\d$/.test(key)) return;
      setCode((c) => {
        if (c.length >= LENGTH) return c;
        const next = c + key;
        if (next.length === LENGTH) void submit(next);
        return next;
      });
    },
    [busy, submit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") press("⌫");
      else if (/^\d$/.test(e.key)) press(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <div className="materialize flex w-full max-w-xs flex-col items-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface text-accent">
        <Lock size={22} strokeWidth={1.8} />
      </div>
      <h1 className="text-xl font-semibold">StudyOS</h1>
      <p className="mt-1 text-sm text-text-3">Entre ton code</p>

      <div className={cn("mt-8 flex gap-4", shaking && "shake")} aria-live="polite">
        {Array.from({ length: LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              "code-dot h-3.5 w-3.5 rounded-full border border-border-strong",
              i < code.length && "code-dot-filled border-accent bg-accent",
            )}
          />
        ))}
      </div>

      <p className="mt-4 h-5 text-sm text-danger" role="status">
        {error ?? ""}
      </p>

      <div className="mt-6 grid w-full grid-cols-3 gap-3">
        {KEYS.map((key, i) =>
          key === "" ? (
            <span key={`k-${i}`} />
          ) : (
            <button
              key={`k-${i}`}
              type="button"
              onPointerDown={(e) => {
                // Retour sur l'appui, pas sur le relâchement.
                if (e.pointerType === "mouse" && e.button !== 0) return;
                e.preventDefault();
                press(key);
              }}
              aria-label={key === "⌫" ? "Effacer" : key}
              disabled={busy}
              className="pressable pressable-strong flex h-16 items-center justify-center rounded-full border border-border bg-surface text-2xl font-medium text-text hover:bg-surface-2 disabled:opacity-60"
            >
              {key === "⌫" ? <Delete size={22} /> : key}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
