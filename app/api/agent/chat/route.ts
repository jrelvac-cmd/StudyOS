import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, CLAUDE_MODEL, effort, webSearchTool } from "@/lib/ai/client";
import { retrievePassages } from "@/lib/ai/retrieval";
import { fmtDay } from "@/lib/dates";

export const maxDuration = 60;

type ClientMessage = { role: "user" | "assistant"; content: string };

export type AgentSource = {
  n: number;
  courseId: string;
  title: string;
  subject: string;
  date: string;
  chapters: string[];
};

const SYSTEM = `Tu es le tuteur personnel de Julien, étudiant en L1 Sciences Économiques (après un Dual Diploma franco-américain). Tu l'aides à réviser à partir de SES propres cours, fournis dans <passages_des_cours> : chaque <source> porte un numéro, une matière, une date et un chapitre.

Règles :
1. Fonde ta réponse d'abord sur les passages. Cite les sources utilisées avec [Source n] à la fin des phrases concernées. Termine par une ligne « Sources : » qui liste, pour chaque source utilisée, matière · date · chapitre.
2. Si les passages ne contiennent rien de pertinent pour la question, dis-le clairement dès la première phrase (« Je n'ai rien trouvé dans tes cours sur ce point. ») avant de proposer, si c'est utile, une réponse générale explicitement signalée comme ne venant pas de ses cours.
3. Recherche internet : tu n'y as accès que si l'outil web_search t'est fourni. Quand tu l'utilises, chaque information qui en vient est introduite par « Trouvé sur internet : » et suivie de sa source (titre et URL). Ne mélange jamais silencieusement cours et internet.
4. Sans outil web_search, ne prétends jamais avoir cherché sur internet.
5. Reste dans le fil : les questions de suivi se rapportent aux échanges précédents.
6. Français, ton d'un tuteur précis et bienveillant. Markdown léger (gras, listes, tableaux si utile). Formules en LaTeX entre $ … $ (en ligne) ou $$ … $$ (bloc). Dans un tableau, jamais de barre verticale | à l'intérieur d'une cellule (écris \\lvert x \\rvert plutôt que |x|). Pas d'emoji.`;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { messages?: ClientMessage[]; webSearch?: boolean } | null;
  const messages = (body?.messages ?? []).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
  const webSearch = !!body?.webSearch;
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || !last.content.trim()) {
    return Response.json({ error: "Message vide" }, { status: 400 });
  }

  // Une question de suivi très courte s'appuie sur la question précédente pour la recherche.
  const previousUser = messages.slice(0, -1).filter((m) => m.role === "user").pop();
  const query = last.content.trim().length < 40 && previousUser ? `${previousUser.content}\n${last.content}` : last.content;
  const passages = await retrievePassages(query, 8).catch(() => []);

  const sources: AgentSource[] = passages.map((p, i) => ({
    n: i + 1,
    courseId: p.course.id,
    title: p.course.title,
    subject: p.course.subject?.name ?? "Matière inconnue",
    date: fmtDay(p.course.course_date),
    chapters: p.course.chapters.map((c) => c.title),
  }));

  const passagesBlock = passages.length
    ? passages
        .map(
          (p, i) =>
            `<source n="${i + 1}" matiere="${sources[i].subject}" date="${sources[i].date}" chapitre="${sources[i].chapters.join(" / ") || "—"}" cours="${p.course.title}">\n${p.content}\n</source>`,
        )
        .join("\n\n")
    : "(aucun passage pertinent trouvé dans les cours)";

  const history: Anthropic.MessageParam[] = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
  let apiMessages: Anthropic.MessageParam[] = [
    ...history,
    {
      role: "user",
      content: [
        { type: "text", text: `<passages_des_cours>\n${passagesBlock}\n</passages_des_cours>` },
        { type: "text", text: last.content },
      ],
    },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      send({ t: "sources", sources });

      let webUsed = false;
      const webSources = new Map<string, { url: string; title: string }>();
      try {
        for (let turn = 0; turn < 4; turn++) {
          const s = anthropic().messages.stream({
            model: CLAUDE_MODEL,
            max_tokens: 8000,
            system: SYSTEM,
            ...effort("medium"),
            messages: apiMessages,
            ...(webSearch ? { tools: [webSearchTool(3)] } : {}),
          });
          s.on("text", (delta) => send({ t: "delta", text: delta }));
          s.on("streamEvent", (event) => {
            if (event.type === "content_block_start" && event.content_block.type === "server_tool_use") {
              webUsed = true;
              send({ t: "status", text: "Recherche sur internet…" });
            }
          });
          const final = await s.finalMessage();
          for (const block of final.content) {
            if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
              for (const r of block.content) {
                if (r.type === "web_search_result") webSources.set(r.url, { url: r.url, title: r.title });
              }
            }
          }
          if (final.stop_reason === "pause_turn") {
            apiMessages = [...apiMessages, { role: "assistant", content: final.content }];
            continue;
          }
          break;
        }
        send({ t: "done", webUsed, webSources: [...webSources.values()] });
      } catch (err) {
        console.error("agent chat", err);
        send({ t: "error", message: err instanceof Error ? err.message : "Erreur de l'agent" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
