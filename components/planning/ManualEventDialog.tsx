"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createManualEventAction } from "@/lib/actions";
import type { Subject } from "@/lib/db/types";
import { Dialog } from "@/components/ui/Dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  defaultDate: string;
};

export function ManualEventDialog({ open, onClose, subjects, defaultDate }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [room, setRoom] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subjectId && !newSubject.trim()) {
      setError("Choisis une matière ou crée-en une.");
      return;
    }
    start(async () => {
      const r = await createManualEventAction({
        title: subjects.find((s) => s.id === subjectId)?.name ?? newSubject,
        subjectId: subjectId || null,
        newSubjectName: newSubject.trim() || null,
        date,
        start: startTime,
        end: endTime,
        room,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onClose();
      router.push(`/planning?week=${date}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nouveau créneau">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-text-3">
          Pour un cours absent de Google Calendar (rattrapage, changement de dernière minute).
        </p>
        <div>
          <label className="label" htmlFor="me-subject">
            Matière
          </label>
          <select id="me-subject" className="field" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">— Nouvelle matière —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {!subjectId && (
            <input
              className="field mt-2"
              placeholder="Nom de la nouvelle matière"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
            />
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3">
            <label className="label" htmlFor="me-date">
              Date
            </label>
            <input id="me-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="me-start">
              Début
            </label>
            <input id="me-start" type="time" className="field" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="me-end">
              Fin
            </label>
            <input id="me-end" type="time" className="field" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="me-room">
              Salle
            </label>
            <input id="me-room" className="field" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Optionnel" />
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Annuler
          </button>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending && <Loader2 size={16} className="animate-spin" />} Ajouter
          </button>
        </div>
      </form>
    </Dialog>
  );
}
