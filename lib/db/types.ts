export type Subject = {
  id: string;
  name: string;
  created_at: string;
};

export type SubjectAlias = {
  id: string;
  alias: string;
  subject_id: string;
};

export type CalendarEvent = {
  id: string;
  google_id: string | null;
  source: "google" | "manual";
  title: string;
  subject_id: string | null;
  starts_at: string;
  ends_at: string;
  room: string | null;
  created_at: string;
  updated_at: string;
};

export type ChapterStatus = "confirmed" | "to_verify";

export type Chapter = {
  id: string;
  subject_id: string;
  title: string;
  status: ChapterStatus;
  created_at: string;
};

export type CourseStatus = "draft" | "analyzing" | "ready" | "error";
export type ClassificationStatus = "pending" | "to_verify" | "confirmed" | "annex";

export type Course = {
  id: string;
  subject_id: string | null;
  calendar_event_id: string | null;
  title: string;
  course_date: string;
  content_html: string;
  content_text: string;
  docx_path: string | null;
  docx_name: string | null;
  status: CourseStatus;
  classification_status: ClassificationStatus;
  ai_summary: string | null;
  ai_error: string | null;
  created_at: string;
  updated_at: string;
};

export type CourseChunk = {
  id: string;
  course_id: string;
  position: number;
  content: string;
  embedding: number[] | null;
};

export type SheetFormat = "condense" | "complet";

export type RevisionSheet = {
  id: string;
  chapter_id: string;
  format: SheetFormat;
  title: string;
  content_md: string;
  created_at: string;
  updated_at: string;
};

export type GoogleTokens = {
  id: number;
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string;
  email: string | null;
  calendar_id: string;
  last_synced_at: string | null;
  updated_at: string;
};

/** Cours enrichi de sa matière et de ses chapitres, tel qu'affiché partout. */
export type CourseWithMeta = Course & {
  subject: Subject | null;
  chapters: Chapter[];
};
