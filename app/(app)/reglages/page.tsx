import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { GoogleCard } from "@/components/settings/GoogleCard";
import { SubjectsManager } from "@/components/settings/SubjectsManager";
import { PageHeader } from "@/components/ui/PageHeader";
import { embeddingsAvailable } from "@/lib/ai/embeddings";
import { listAliases, listSubjects } from "@/lib/db/subjects";
import { db } from "@/lib/supabase/admin";
import { getGoogleStatus, isGoogleConfigured, listCalendars } from "@/lib/google";

export const metadata: Metadata = { title: "Réglages" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: PageProps<"/reglages">) {
  const params = await searchParams;
  const googleParam = typeof params.google === "string" ? params.google : null;
  const googleReason = typeof params.reason === "string" ? params.reason : null;

  const [google, subjects, aliases] = await Promise.all([
    getGoogleStatus().catch(() => null),
    listSubjects(),
    listAliases(),
  ]);
  const calendars = google ? await listCalendars().catch(() => []) : [];
  // « primary » est un alias Google : on l'affiche sous son vrai identifiant pour que le sélecteur pointe le bon agenda.
  const selectedCalendarId =
    google?.calendar_id === "primary" ? (calendars.find((c) => c.primary)?.id ?? "primary") : (google?.calendar_id ?? "primary");
  const { count: googleEventCount } = google
    ? await db().from("calendar_events").select("id", { count: "exact", head: true }).eq("source", "google")
    : { count: 0 };

  const checks = [
    { label: "Supabase", ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY },
    { label: "Clé Claude (ANTHROPIC_API_KEY)", ok: !!process.env.ANTHROPIC_API_KEY },
    { label: "Voyage AI (recherche sémantique)", ok: embeddingsAvailable(), soft: true },
    { label: "Google Calendar (OAuth)", ok: isGoogleConfigured() },
    { label: "Secret cron (sync quotidienne)", ok: !!process.env.CRON_SECRET, soft: true },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Réglages" />
      <div className="stagger grid gap-5 px-5 pb-10 md:grid-cols-2 md:px-8">
        <GoogleCard
          configured={isGoogleConfigured()}
          connected={!!google}
          email={google?.email ?? null}
          calendarId={selectedCalendarId}
          calendars={calendars}
          googleEventCount={googleEventCount ?? 0}
          lastSyncedAt={google?.last_synced_at ?? null}
          flash={googleParam}
          reason={googleReason}
          redirectUri={`${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/google/callback`}
        />

        <section className="card px-5 py-5">
          <h2 className="text-sm font-semibold">Configuration</h2>
          <p className="mt-0.5 text-xs text-text-3">Variables d&apos;environnement lues par le serveur.</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-3">
                <span className="text-text-2">{c.label}</span>
                <span className={c.ok ? "badge badge-accent" : c.soft ? "badge" : "badge border-danger/40 text-danger"}>
                  {c.ok ? "ok" : c.soft ? "optionnel" : "manquant"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card px-5 py-5 md:col-span-2">
          <h2 className="text-sm font-semibold">Matières</h2>
          <p className="mt-0.5 text-xs text-text-3">
            Le titre d&apos;un événement Google devient une matière. Renomme, fusionne les doublons, ou réassigne un titre à une autre matière.
          </p>
          <div className="mt-4">
            <SubjectsManager subjects={subjects} aliases={aliases} />
          </div>
        </section>

        <section className="card flex items-center justify-between gap-3 px-5 py-4 md:col-span-2">
          <div>
            <h2 className="text-sm font-semibold">Session</h2>
            <p className="text-xs text-text-3">Le code sera redemandé à la prochaine visite.</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="btn-secondary">
              <LogOut size={14} /> Se déconnecter
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
