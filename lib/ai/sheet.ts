import { fmtDay } from "@/lib/dates";
import { anthropic, CLAUDE_MODEL, effort } from "./client";
import type { CourseWithMeta, SheetFormat } from "@/lib/db/types";

const SYSTEM = `Tu rédiges des fiches de révision pour un étudiant en L1 Sciences Économiques, à partir de SES propres cours. Tu t'appuies uniquement sur le contenu fourni : tu n'inventes pas de notions absentes des cours. Si le contenu est court, la fiche est courte mais complète pour ce qui est couvert.

Style : français clair, direct, sans remplissage. Markdown propre (titres ##, listes, **gras** sur les termes clés, tableaux si utile). Formules en LaTeX entre $ … $ ou $$ … $$ ; dans un tableau, jamais de barre verticale | dans une cellule (\\lvert x \\rvert plutôt que |x|). Pas de préambule ni de conclusion du type « voici la fiche ».`;

const FORMATS: Record<SheetFormat, string> = {
  condense: `FORMAT CONDENSÉ — une page maximum (environ 350 à 500 mots) :
## L'essentiel en 5 lignes
## Définitions clés (terme en gras : définition en une phrase)
## Points à retenir (liste courte, un point = une idée)
## Pièges / erreurs fréquentes (2 à 4 puces)
## 5 questions flash (réponse courte entre parenthèses)`,
  complet: `FORMAT COMPLET — fiche détaillée (environ 900 à 1500 mots) :
## Plan du chapitre
## Définitions clés (terme en gras : définition précise)
## Notions et mécanismes (sections ### par notion : explication, exemple tiré du cours, formule ou schéma en texte si présent)
## Liens entre les notions
## Points à retenir
## Pièges / erreurs fréquentes
## Questions de révision (8 à 10, avec réponse attendue en italique)`,
};

export async function generateSheet(input: {
  chapterTitle: string;
  subjectName: string;
  format: SheetFormat;
  courses: CourseWithMeta[];
}): Promise<{ title: string; content_md: string }> {
  const sources = input.courses
    .map((c, i) => {
      const date = fmtDay(c.course_date, "d MMMM yyyy");
      return `<cours n="${i + 1}" date="${date}" titre="${c.title}">\n${c.content_text.slice(0, 40_000)}\n</cours>`;
    })
    .join("\n\n");

  const stream = anthropic().messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    ...effort("medium"),
    messages: [
      {
        role: "user",
        content: `Matière : ${input.subjectName}
Chapitre : ${input.chapterTitle}

${FORMATS[input.format]}

Commence directement par le premier titre ## (pas de titre # général, il est ajouté par l'application).

Cours de l'étudiant sur ce chapitre :
${sources}`,
      },
    ],
  });
  const message = await stream.finalMessage();
  const text = message.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error("Fiche vide");
  return { title: input.chapterTitle, content_md: text };
}
