"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { updateClassificationAction } from "@/lib/actions";
import type { Chapter, CourseWithMeta, Subject } from "@/lib/db/types";
import { cn } from "@/lib/utils";

type Props = { course: CourseWithMeta; subjects: Subject[]; chapters: Chapter[] };

export function ClassificationEditor({ course, subjects, chapters }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [subjectId, setSubjectId] = useState(course.subject_id ?? "");
  const [chapterIds, setChapterIds] = useState<string[]>(course.chapters.map((c) => c.id));
  const [annex, setAnnex] = useState(course.classification_status === "annex");
  const [newChapter, setNewChapter] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const subjectChapters = chapters.filter((c) => c.subject_id === subjectId);
  const dirty =
    subjectId !== (course.subject_id ?? "") ||
    annex !== (course.classification_status === "annex") ||
    newChapter.trim() !== "" ||
    chapterIds.slice().sort().join() !== course.chapters.map((c) => c.id).sort().join() ||
    course.classification_status === "to_verify" ||
    course.classification_status === "pending";

  function toggle(id: string) {
    setChapterIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function save() {
    setMessage(null);
    start(async () => {
      const r = await updateClassificationAction({
        courseId: course.id,
        subjectId: subjectId || null,
        chapterIds,
        newChapterTitle: newChapter.trim() || null,
        status: annex ? "annex" : "confirmed",
      });
      if (!r.ok) {
        setMessage(r.error);
        return;
      }
      setNewChapter("");
      setMessage("Enregistré");
      router.refresh();
    });
  }

  const proposed = course.classification_status === "to_verify";

  return (
    <div className={cn("card flex flex-col gap-4 px-4 py-4", proposed && "border-accent/40")}>
      <div>
        <h2 className="text-sm font-semibold">Classement</h2>
        {proposed && <p className="mt-0.5 text-xs text-text-2">Proposition de l&apos;IA à vérifier : corrige si besoin, puis valide.</p>}
        {course.classification_status === "pending" && course.status === "ready" && (
          <p className="mt-0.5 text-xs text-text-2">Ce cours n&apos;est pas encore classé.</p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="cls-subject">
          Matière
        </label>
        <select
          id="cls-subject"
          className="field"
          value={subjectId}
          onChange={(e) => {
            setSubjectId(e.target.value);
            setChapterIds([]);
          }}
        >
          <option value="">— Inconnue —</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={annex} onChange={(e) => setAnnex(e.target.checked)} className="accent-accent" />
        Cours annexe (hors chapitre : méthodo, consignes…)
      </label>

      {!annex && (
        <div>
          <span className="label">Chapitres</span>
          {subjectId ? (
            <>
              {subjectChapters.length === 0 && <p className="mb-2 text-xs text-text-3">Aucun chapitre pour cette matière.</p>}
              <ul className="flex flex-col gap-1">
                {subjectChapters.map((ch) => {
                  const on = chapterIds.includes(ch.id);
                  return (
                    <li key={ch.id}>
                      <button
                        type="button"
                        onClick={() => toggle(ch.id)}
                        className={cn(
                          "pressable flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm",
                          on ? "border-accent/50 bg-accent-dim text-text" : "border-border text-text-2 hover:bg-surface-2",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            on ? "border-accent bg-accent text-black" : "border-border-strong",
                          )}
                        >
                          {on && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="flex-1 truncate">{ch.title}</span>
                        {ch.status === "to_verify" && <span className="text-[10px] text-text-3">à vérifier</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex gap-2">
                <input
                  className="field"
                  placeholder="Nouveau chapitre…"
                  value={newChapter}
                  onChange={(e) => setNewChapter(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                />
                <span className="icon-btn shrink-0 text-accent" aria-hidden>
                  <Plus size={16} />
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-text-3">Choisis d&apos;abord une matière.</p>
          )}
        </div>
      )}

      <button type="button" onClick={save} disabled={pending || (!dirty && !proposed)} className="btn-primary">
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        {proposed ? "Valider le classement" : "Enregistrer"}
      </button>
      {message && <p className={cn("text-xs", message === "Enregistré" ? "text-accent" : "text-danger")}>{message}</p>}
    </div>
  );
}
