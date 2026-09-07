"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { ArrowLeft, Bold, Heading1, Heading2, Heading3, Italic, List, ListOrdered, Loader2, Sparkles } from "lucide-react";
import { finalizeCourseAction, reindexCourseAction, saveDraftAction } from "@/lib/actions";
import type { Subject } from "@/lib/db/types";
import { cn } from "@/lib/utils";

type Initial = {
  courseId: string | null;
  eventId: string | null;
  subjectId: string | null;
  title: string;
  date: string;
  contentHtml: string;
};

type Props = { mode: "create" | "edit"; subjects: Subject[]; initial: Initial };

const AUTOSAVE_MS = 30_000;

export function CourseEditor({ mode, subjects, initial }: Props) {
  const [courseId, setCourseId] = useState(initial.courseId);
  const [title, setTitle] = useState(initial.title);
  const [subjectId, setSubjectId] = useState(initial.subjectId ?? "");
  const [date, setDate] = useState(initial.date);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [finalizing, startFinalize] = useTransition();
  const savingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Tape ou colle ton cours ici…" }),
    ],
    content: initial.contentHtml,
    immediatelyRender: false,
    editorProps: { attributes: { class: "tiptap prose-course" } },
    onUpdate: () => setDirty(true),
  });

  const save = useCallback(async (): Promise<string | null> => {
    if (!editor || savingRef.current) return courseId;
    savingRef.current = true;
    setSaveState("saving");
    setError(null);
    const r = await saveDraftAction({
      courseId,
      eventId: initial.eventId,
      subjectId: subjectId || null,
      title,
      date,
      contentHtml: editor.getHTML(),
      contentText: editor.getText({ blockSeparator: "\n\n" }),
    });
    savingRef.current = false;
    if (!r.ok) {
      setSaveState("error");
      setError(r.error);
      return null;
    }
    setCourseId(r.id);
    setDirty(false);
    setSaveState("saved");
    return r.id;
  }, [editor, courseId, initial.eventId, subjectId, title, date]);

  // Brouillon enregistré toutes les 30 s tant qu'il y a du nouveau.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, save]);

  // On ne quitte pas la page avec des modifications non enregistrées sans prévenir.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function finalize() {
    if (!editor) return;
    const text = editor.getText().trim();
    if (text.length < 40) {
      setError("Le cours est trop court pour être analysé (40 caractères minimum).");
      return;
    }
    startFinalize(async () => {
      const id = await save();
      if (!id) return;
      if (mode === "create") await finalizeCourseAction(id);
      else await reindexCourseAction(id);
    });
  }

  const wordCount = editor ? editor.getText().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 md:px-8 md:pt-7">
        <Link href={courseId && mode === "edit" ? `/cours/${courseId}` : "/bibliotheque"} className="btn-ghost -ml-3 text-xs">
          <ArrowLeft size={14} /> {mode === "edit" ? "Retour au cours" : "Bibliothèque"}
        </Link>
        <div className="flex items-center gap-3 text-xs text-text-3">
          <span>
            {saveState === "saving" && "Enregistrement…"}
            {saveState === "saved" && !dirty && "Brouillon enregistré"}
            {saveState === "error" && <span className="text-danger">Échec de l&apos;enregistrement</span>}
            {dirty && saveState !== "saving" && "Modifications non enregistrées"}
          </span>
          <span>{wordCount} mots</span>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_16rem] md:px-8">
        <div className="min-w-0">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            placeholder="Titre du cours (sinon l'IA en proposera un)"
            aria-label="Titre"
            className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-text-3 md:text-3xl"
          />

          <div className="chrome sticky top-0 z-10 -mx-1 mt-3 flex flex-wrap gap-1 rounded-xl border border-border px-2 py-1.5">
            {editor && (
              <>
                <ToolButton label="Titre 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                  <Heading1 size={16} />
                </ToolButton>
                <ToolButton label="Titre 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                  <Heading2 size={16} />
                </ToolButton>
                <ToolButton label="Titre 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                  <Heading3 size={16} />
                </ToolButton>
                <span className="mx-1 w-px self-stretch bg-border" />
                <ToolButton label="Gras" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                  <Bold size={16} />
                </ToolButton>
                <ToolButton label="Italique" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                  <Italic size={16} />
                </ToolButton>
                <span className="mx-1 w-px self-stretch bg-border" />
                <ToolButton label="Liste" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                  <List size={16} />
                </ToolButton>
                <ToolButton label="Liste numérotée" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                  <ListOrdered size={16} />
                </ToolButton>
              </>
            )}
          </div>

          <div className="card mt-3 px-5 py-5 md:px-7 md:py-6" onClick={() => editor?.commands.focus()}>
            <EditorContent editor={editor} />
          </div>
        </div>

        <aside className="flex flex-col gap-4 md:sticky md:top-6 md:self-start">
          <div className="card flex flex-col gap-3 px-4 py-4">
            <div>
              <label className="label" htmlFor="ed-subject">
                Matière
              </label>
              <select
                id="ed-subject"
                className="field"
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setDirty(true);
                }}
              >
                <option value="">— L&apos;IA la déduira —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ed-date">
                Date du cours
              </label>
              <input
                id="ed-date"
                type="date"
                className="field"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setDirty(true);
                }}
              />
            </div>
          </div>

          <div className="card flex flex-col gap-2 px-4 py-4">
            <button type="button" onClick={finalize} disabled={finalizing || !editor} className="btn-primary">
              {finalizing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {mode === "create" ? "Valider et analyser" : "Enregistrer"}
            </button>
            <button type="button" onClick={() => void save()} disabled={saveState === "saving" || !dirty} className="btn-secondary">
              Enregistrer le brouillon
            </button>
            {error && <p className="text-xs text-danger">{error}</p>}
            <p className="text-xs text-text-3">
              {mode === "create"
                ? "Valider lance la détection de la matière et du chapitre, puis l'indexation pour l'agent."
                : "Le texte est ré-indexé pour l'agent. Le classement n'est pas modifié."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ToolButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("icon-btn h-8 w-8", active && "bg-accent-dim text-accent")}
    >
      {children}
    </button>
  );
}
