"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, PenLine, Trash2 } from "lucide-react";
import { deleteEventAction, setEventSubjectAction } from "@/lib/actions";
import type { EventWithSubject } from "@/lib/db/events";
import type { Subject } from "@/lib/db/types";
import { fmtInstant, localParts } from "@/lib/dates";
import { Dialog } from "@/components/ui/Dialog";
import { DocxDropzone } from "@/components/course/DocxDropzone";

type Props = {
  event: EventWithSubject;
  subjects: Subject[];
  onClose: () => void;
};

type LinkedCourse = { id: string; title: string; status: string; classification_status: string };

export function EventPanel({ event, subjects, onClose }: Props) {
  const router = useRouter();
  const [courses, setCourses] = useState<LinkedCourse[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [newSubject, setNewSubject] = useState("");
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (loadedFor.current === event.id) return;
    loadedFor.current = event.id;
    fetch(`/api/events/${event.id}/courses`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: LinkedCourse[]) => setCourses(data))
      .catch(() => setCourses([]));
  }, [event.id]);

  const dayKey = localParts(event.starts_at).dayKey;
  const subjectName = event.subject?.name ?? null;

  function changeSubject(value: string) {
    startTransition(async () => {
      if (value === "__new__") return;
      await setEventSubjectAction(event.id, value || null);
      router.refresh();
    });
  }

  function createSubject() {
    if (!newSubject.trim()) return;
    startTransition(async () => {
      await setEventSubjectAction(event.id, null, newSubject);
      setNewSubject("");
      router.refresh();
    });
  }

  return (
    <Dialog open onClose={onClose} title={subjectName ?? event.title}>
      <div className="flex flex-col gap-5">
        <div className="text-sm text-text-2">
          <div className="capitalize">{fmtInstant(event.starts_at, "EEEE d MMMM")}</div>
          <div>
            {localParts(event.starts_at).time} – {localParts(event.ends_at).time}
            {event.room && <span> · {event.room}</span>}
          </div>
          {event.source === "google" && event.title !== subjectName && (
            <div className="mt-1 text-xs text-text-3">Événement Google : « {event.title} »</div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="event-subject">
            Matière
          </label>
          <div className="flex gap-2">
            <select
              id="event-subject"
              className="field"
              value={event.subject_id ?? ""}
              onChange={(e) => changeSubject(e.target.value)}
              disabled={pending}
            >
              <option value="">— Aucune —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {!event.subject_id && (
            <div className="mt-2 flex gap-2">
              <input
                className="field"
                placeholder="Nouvelle matière…"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createSubject()}
              />
              <button type="button" onClick={createSubject} disabled={pending || !newSubject.trim()} className="btn-secondary shrink-0">
                Créer
              </button>
            </div>
          )}
          {event.source === "google" && (
            <p className="mt-1.5 text-xs text-text-3">Le choix est mémorisé pour tous les événements portant ce titre.</p>
          )}
        </div>

        <div>
          <h3 className="label">Cours rattachés</h3>
          {courses === null ? (
            <div className="flex items-center gap-2 text-sm text-text-3">
              <Loader2 size={14} className="animate-spin" /> Chargement…
            </div>
          ) : courses.length === 0 ? (
            <p className="text-sm text-text-3">Aucun cours pour ce créneau.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {courses.map((c) => (
                <li key={c.id}>
                  <Link href={`/cours/${c.id}`} className="pressable card flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-2">
                    <span className="truncate">{c.title || "Sans titre"}</span>
                    <span className="ml-2 shrink-0 text-xs text-text-3">
                      {c.status === "analyzing" ? "analyse…" : c.status === "draft" ? "brouillon" : c.classification_status === "to_verify" ? "à vérifier" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href={`/cours/nouveau?event=${event.id}${event.subject_id ? `&subject=${event.subject_id}` : ""}&date=${dayKey}`}
            className="btn-primary"
          >
            <PenLine size={16} /> Écrire le cours
          </Link>
          <DocxDropzone eventId={event.id} subjectId={event.subject_id} date={dayKey} compact />
        </div>

        {event.source === "manual" && (
          <button
            type="button"
            className="btn-danger self-start"
            disabled={pending}
            onClick={() => {
              if (!confirm("Supprimer ce créneau manuel ?")) return;
              startTransition(async () => {
                await deleteEventAction(event.id);
                onClose();
                router.refresh();
              });
            }}
          >
            <Trash2 size={14} /> Supprimer le créneau
          </button>
        )}
        <p className="flex items-center gap-1.5 text-xs text-text-3">
          <FileUp size={12} /> Tu peux importer un cours le soir même ou plus tard : rien n&apos;est lié à l&apos;heure.
        </p>
      </div>
    </Dialog>
  );
}
