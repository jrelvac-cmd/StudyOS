import { AlertCircle, CheckCircle2, CircleDashed, Loader2, Paperclip } from "lucide-react";
import type { ClassificationStatus, CourseStatus } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export function CourseStatusBadge({
  status,
  classification,
  className,
}: {
  status: CourseStatus;
  classification: ClassificationStatus;
  className?: string;
}) {
  if (status === "draft") {
    return (
      <span className={cn("badge", className)}>
        <CircleDashed size={11} /> Brouillon
      </span>
    );
  }
  if (status === "analyzing") {
    return (
      <span className={cn("badge badge-accent", className)}>
        <Loader2 size={11} className="animate-spin" /> Analyse en cours
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={cn("badge border-danger/40 text-danger", className)}>
        <AlertCircle size={11} /> Erreur d&apos;analyse
      </span>
    );
  }
  if (classification === "annex") {
    return (
      <span className={cn("badge", className)}>
        <Paperclip size={11} /> Cours annexe
      </span>
    );
  }
  if (classification === "to_verify" || classification === "pending") {
    return (
      <span className={cn("badge badge-warn", className)}>
        <AlertCircle size={11} /> À vérifier
      </span>
    );
  }
  return (
    <span className={cn("badge badge-accent", className)}>
      <CheckCircle2 size={11} /> Classé
    </span>
  );
}
