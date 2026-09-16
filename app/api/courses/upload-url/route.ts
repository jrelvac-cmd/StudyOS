import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/admin";

const ALLOWED_EXT = new Set(["docx", "pdf"]);

/** 40 Mo : plafond que l'app impose elle-même (le stockage accepterait davantage). */
export const MAX_BYTES = 40 * 1024 * 1024;

/**
 * Prépare un import : renvoie une URL signée vers laquelle le navigateur envoie
 * le fichier directement (Supabase Storage), sans passer par cette fonction —
 * les fonctions Vercel refusent tout corps de requête au-delà d'environ 4,5 Mo.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { filename?: string; size?: number } | null;
  const filename = body?.filename?.trim();
  if (!filename) return NextResponse.json({ error: "Nom de fichier manquant." }, { status: 400 });

  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: "Seuls les fichiers Word (.docx) ou PDF sont acceptés." }, { status: 400 });
  }
  if (typeof body?.size === "number" && body.size > MAX_BYTES) {
    return NextResponse.json({ error: `Fichier trop lourd (${Math.round(MAX_BYTES / 1024 / 1024)} Mo max).` }, { status: 400 });
  }

  const path = `uploads/${crypto.randomUUID()}-${filename.replace(/[^\w.\-]+/g, "_")}`;
  const { data, error } = await db().storage.from("courses").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "Impossible de préparer l'import." }, { status: 500 });

  return NextResponse.json({ path: data.path, signedUrl: data.signedUrl });
}
