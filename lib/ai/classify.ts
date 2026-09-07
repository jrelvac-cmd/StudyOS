import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, CLAUDE_MODEL, effort } from "./client";

export const ClassificationSchema = z.object({
  title: z.string().describe("Titre court et précis du cours (5 à 10 mots), sans numéro de séance"),
  summary: z.string().describe("Résumé en 2 phrases de ce que couvre le cours"),
  subject_name: z
    .string()
    .nullable()
    .describe("Nom de la matière si elle n'était pas fournie, sinon null"),
  is_annex: z
    .boolean()
    .describe(
      "true si ce n'est pas un cours de contenu mais un document annexe : consignes, méthodologie générale, annonce, organisation, corrigé isolé",
    ),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Certitude sur le rattachement au(x) chapitre(s) proposé(s)"),
  chapters: z
    .array(
      z.object({
        existing_chapter_id: z.string().nullable().describe("Identifiant d'un chapitre existant, sinon null"),
        title: z.string().describe("Titre du chapitre (repris tel quel s'il existe, sinon un titre de chapitre clair)"),
        starts_with: z
          .string()
          .nullable()
          .describe("Premiers mots du passage où ce chapitre commence dans le cours, ou null si dès le début"),
      }),
    )
    .describe("Chapitres couverts, dans l'ordre. Plusieurs seulement si un nouveau chapitre commence au milieu du cours. Vide si is_annex."),
});

export type Classification = z.infer<typeof ClassificationSchema>;

const SYSTEM = `Tu classes les cours d'un étudiant en L1 Sciences Économiques (après un Dual Diploma franco-américain). Tu reçois le texte d'un cours, sa matière (si connue) et la liste des chapitres déjà connus de cette matière.

Règles :
- Un « chapitre » est une unité thématique de programme (ex. « L'offre et la demande », « Les fonctions dérivées », « La Révolution française »). Il regroupe souvent plusieurs séances. Ne crée pas un chapitre par séance.
- Rattache en priorité à un chapitre EXISTANT quand le sujet correspond, même si la formulation diffère ; recopie alors son identifiant et son titre exactement.
- Ne crée un nouveau chapitre que si aucun chapitre existant ne couvre le sujet. Titre sobre, sans numéro, sans « Chapitre X ».
- Si le cours commence clairement un nouveau chapitre en cours de route (transition explicite, nouveau grand titre), renvoie deux chapitres dans l'ordre, avec starts_with pour le second.
- is_annex = true pour ce qui n'est pas du contenu de cours (consignes d'examen, méthodologie générale, planning, corrigé seul). Dans ce cas, chapters est vide.
- confidence : high si le rattachement est évident, medium si probable, low si tu hésites vraiment (le cours sera marqué « à vérifier »).
- Réponds en français.`;

export async function classifyCourse(input: {
  text: string;
  subjectName: string | null;
  knownChapters: { id: string; title: string }[];
}): Promise<Classification> {
  const chapterList = input.knownChapters.length
    ? input.knownChapters.map((c) => `- id: ${c.id} — ${c.title}`).join("\n")
    : "(aucun chapitre connu pour l'instant)";

  const response = await anthropic().messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: SYSTEM,
    ...effort("medium", zodOutputFormat(ClassificationSchema)),
    messages: [
      {
        role: "user",
        content: `Matière : ${input.subjectName ?? "inconnue (à déduire)"}

Chapitres déjà connus pour cette matière :
${chapterList}

Texte du cours :
<cours>
${input.text.slice(0, 60_000)}
</cours>`,
      },
    ],
  });

  if (!response.parsed_output) throw new Error("Classification illisible");
  return response.parsed_output;
}
