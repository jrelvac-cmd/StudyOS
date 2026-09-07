"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw } from "lucide-react";
import { syncNowAction } from "@/lib/actions";
import type { EventWithSubject } from "@/lib/db/events";
import type { Subject } from "@/lib/db/types";
import { isoDate, localParts, todayKey, weekDays } from "@/lib/dates";
import { subjectColor } from "@/lib/subjectColor";
import { cn } from "@/lib/utils";
import { EventPanel } from "./EventPanel";
import { ManualEventDialog } from "./ManualEventDialog";

type Props = {
  weekStart: string;
  events: EventWithSubject[];
  subjects: Subject[];
  googleConnected: boolean;
  lastSyncedAt: string | null;
};

const HOUR_PX = 56;

type Placed = EventWithSubject & { dayKey: string; startH: number; endH: number };

export function WeekView({ weekStart, events, subjects, googleConnected, lastSyncedAt }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<EventWithSubject | null>(null);
  const [creating, setCreating] = useState(false);
  const [syncing, startSync] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const start = parseISO(weekStart);
  const days = weekDays(start);
  const today = todayKey();

  const placed = useMemo<Placed[]>(
    () =>
      events.map((e) => {
        const s = localParts(e.starts_at);
        const en = localParts(e.ends_at);
        const endH = en.dayKey === s.dayKey ? en.hours : 24;
        return { ...e, dayKey: s.dayKey, startH: s.hours, endH: Math.max(endH, s.hours + 0.5) };
      }),
    [events],
  );

  const firstHour = Math.min(8, ...placed.map((p) => Math.floor(p.startH)));
  const lastHour = Math.max(19, ...placed.map((p) => Math.ceil(p.endH)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);

  const prev = isoDate(addDays(start, -7));
  const next = isoDate(addDays(start, 7));
  const rangeLabel = `${format(start, "d MMM", { locale: fr })} – ${format(addDays(start, 6), "d MMM yyyy", { locale: fr })}`;

  function sync() {
    setSyncMessage(null);
    startSync(async () => {
      const r = await syncNowAction();
      setSyncMessage(r.ok ? `${r.synced} créneaux synchronisés` : r.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-6 pb-4 md:px-8 md:pt-8">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Planning</h1>
          <p className="mt-1 text-sm text-text-3">
            {googleConnected
              ? lastSyncedAt
                ? `Google Calendar · synchronisé ${format(new Date(lastSyncedAt), "d MMM 'à' HH:mm", { locale: fr })}`
                : "Google Calendar connecté"
              : "Google Calendar non connecté"}
            {syncMessage && <span className="ml-2 text-accent">· {syncMessage}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {googleConnected ? (
            <button type="button" onClick={sync} disabled={syncing} className="btn-secondary">
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Synchroniser
            </button>
          ) : (
            <Link href="/reglages" className="btn-secondary">
              Connecter Google
            </Link>
          )}
          <button type="button" onClick={() => setCreating(true)} className="btn-primary">
            <Plus size={16} /> Créneau
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between px-5 pb-3 md:px-8">
        <Link href={`/planning?week=${prev}`} className="icon-btn" aria-label="Semaine précédente">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium capitalize">{rangeLabel}</span>
          <Link href="/planning" className="btn-ghost px-3 py-1 text-xs">
            Aujourd&apos;hui
          </Link>
        </div>
        <Link href={`/planning?week=${next}`} className="icon-btn" aria-label="Semaine suivante">
          <ChevronRight size={18} />
        </Link>
      </div>

      {/* Grille (ordinateur) */}
      <div className="hidden flex-1 overflow-x-auto px-8 pb-8 md:block">
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border">
            <div />
            {days.map((d) => {
              const key = isoDate(d);
              const isToday = key === today;
              return (
                <div key={key} className="border-l border-border px-2 py-2 text-center">
                  <div className="text-[11px] uppercase tracking-wide text-text-3">{format(d, "EEE", { locale: fr })}</div>
                  <div
                    className={cn(
                      "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                      isToday && "bg-accent text-black",
                    )}
                  >
                    {format(d, "d")}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
            <div className="relative" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h) => (
                <div key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-text-3" style={{ top: (h - firstHour) * HOUR_PX }}>
                  {h}h
                </div>
              ))}
            </div>
            {days.map((d) => {
              const key = isoDate(d);
              const dayEvents = placed.filter((p) => p.dayKey === key);
              return (
                <div
                  key={key}
                  className={cn("planning-grid relative border-l border-border", key === today && "bg-accent/[0.03]")}
                  style={{ height: hours.length * HOUR_PX, backgroundSize: `100% ${HOUR_PX}px` }}
                >
                  {dayEvents.map((ev) => (
                    <EventBlock
                      key={ev.id}
                      event={ev}
                      top={(ev.startH - firstHour) * HOUR_PX}
                      height={(ev.endH - ev.startH) * HOUR_PX}
                      onClick={() => setSelected(ev)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Agenda (téléphone) */}
      <div className="flex flex-col gap-4 px-5 pb-6 md:hidden">
        {days.map((d) => {
          const key = isoDate(d);
          const dayEvents = placed.filter((p) => p.dayKey === key);
          return (
            <section key={key}>
              <h2 className={cn("mb-2 text-sm font-semibold capitalize", key === today ? "text-accent" : "text-text-2")}>
                {format(d, "EEEE d MMMM", { locale: fr })}
              </h2>
              {dayEvents.length === 0 ? (
                <p className="text-xs text-text-3">Rien de prévu</p>
              ) : (
                <ul className="stagger flex flex-col gap-2">
                  {dayEvents.map((ev) => {
                    const color = subjectColor(ev.subject_id);
                    return (
                      <li key={ev.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(ev)}
                          className="pressable card flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left"
                          style={{ borderLeftColor: color.border }}
                        >
                          <div className="w-14 shrink-0 text-xs text-text-2">
                            <div>{localParts(ev.starts_at).time}</div>
                            <div className="text-text-3">{localParts(ev.ends_at).time}</div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium" style={{ color: color.text }}>
                              {ev.subject?.name ?? ev.title}
                            </div>
                            <div className="truncate text-xs text-text-3">
                              {ev.room ?? ""}
                              {ev.course_count > 0 && <span className="ml-1 text-accent">· {ev.course_count} cours</span>}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {selected && (
        <EventPanel
          event={selected}
          subjects={subjects}
          onClose={() => setSelected(null)}
        />
      )}
      <ManualEventDialog open={creating} onClose={() => setCreating(false)} subjects={subjects} defaultDate={today} />
    </div>
  );
}

function EventBlock({ event, top, height, onClick }: { event: Placed; top: number; height: number; onClick: () => void }) {
  const color = subjectColor(event.subject_id);
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable absolute inset-x-1 flex flex-col overflow-hidden rounded-lg border px-2 py-1.5 text-left"
      style={{ top: top + 1, height: Math.max(height - 2, 22), borderColor: color.border, backgroundColor: color.bg }}
      title={`${event.subject?.name ?? event.title} · ${localParts(event.starts_at).time}–${localParts(event.ends_at).time}`}
    >
      <span className="truncate text-xs font-semibold" style={{ color: color.text }}>
        {event.subject?.name ?? event.title}
      </span>
      {height > 40 && (
        <span className="truncate text-[11px] text-text-2">
          {localParts(event.starts_at).time}
          {event.room ? ` · ${event.room}` : ""}
        </span>
      )}
      {event.course_count > 0 && height > 56 && (
        <span className="mt-auto text-[10px] text-text-2">{event.course_count} cours</span>
      )}
    </button>
  );
}
