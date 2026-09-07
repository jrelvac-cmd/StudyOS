"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, RefreshCw, Unplug } from "lucide-react";
import { disconnectGoogleAction, setCalendarAction, syncNowAction } from "@/lib/actions";
import { fmtInstant } from "@/lib/dates";

type Props = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  calendarId: string;
  calendars: { id: string; name: string; primary: boolean }[];
  lastSyncedAt: string | null;
  flash: string | null;
  redirectUri: string;
};

export function GoogleCard({ configured, connected, email, calendarId, calendars, lastSyncedAt, flash, redirectUri }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(
    flash === "connected" ? "Google Calendar connecté." : flash === "error" ? "La connexion Google a échoué. Réessaie." : flash === "not_configured" ? "Renseigne d'abord GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL et TOKEN_ENCRYPTION_KEY." : null,
  );

  return (
    <section className="card px-5 py-5">
      <div className="flex items-center gap-2">
        <CalendarDays size={18} className="text-accent" />
        <h2 className="text-sm font-semibold">Google Calendar</h2>
      </div>
      <p className="mt-0.5 text-xs text-text-3">Lecture seule. Le jeton est chiffré en base.</p>

      {connected ? (
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <div>
            <div className="text-text-2">Connecté{email ? ` en tant que ${email}` : ""}</div>
            <div className="text-xs text-text-3">
              {lastSyncedAt ? `Dernière synchronisation : ${fmtInstant(lastSyncedAt, "d MMM 'à' HH:mm")}` : "Pas encore synchronisé"} · automatique chaque matin
            </div>
          </div>
          {calendars.length > 0 && (
            <div>
              <label className="label" htmlFor="gcal">
                Agenda utilisé
              </label>
              <select
                id="gcal"
                className="field"
                value={calendarId}
                disabled={pending}
                onChange={(e) =>
                  start(async () => {
                    await setCalendarAction(e.target.value);
                    setMessage("Agenda changé et resynchronisé.");
                    router.refresh();
                  })
                }
              >
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.primary ? " (principal)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="btn-secondary"
              onClick={() =>
                start(async () => {
                  const r = await syncNowAction();
                  setMessage(r.ok ? `${r.synced} créneaux synchronisés.` : r.error);
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Synchroniser maintenant
            </button>
            <button
              type="button"
              disabled={pending}
              className="btn-ghost"
              onClick={() => {
                if (!confirm("Déconnecter Google Calendar ? Les créneaux déjà importés restent affichés.")) return;
                start(async () => {
                  await disconnectGoogleAction();
                  setMessage("Déconnecté.");
                  router.refresh();
                });
              }}
            >
              <Unplug size={14} /> Déconnecter
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-text-2">Connecte ton compte pour voir ton emploi du temps dans le planning.</p>
          {configured ? (
            <>
              <a href="/api/google/connect" className="btn-primary self-start">
                Connecter Google Calendar
              </a>
              <p className="text-xs text-text-3">
                Dans Google Cloud, ton client OAuth (type « Application Web ») doit déclarer exactement cette URI de redirection :
              </p>
              <code className="select-all break-all rounded-lg bg-surface-3 px-2.5 py-1.5 font-mono text-xs text-text">{redirectUri}</code>
            </>
          ) : (
            <p className="text-xs text-text-3">
              Configure d&apos;abord GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL et TOKEN_ENCRYPTION_KEY (voir .env.example).
            </p>
          )}
        </div>
      )}
      {message && <p className="mt-3 text-xs text-accent">{message}</p>}
    </section>
  );
}
