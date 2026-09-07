import { db } from "@/lib/supabase/admin";
import { getCoursesByIds } from "@/lib/db/courses";
import type { CourseWithMeta } from "@/lib/db/types";
import { embed } from "./embeddings";

export type RetrievedPassage = {
  chunkId: string;
  course: CourseWithMeta;
  content: string;
  score: number;
};

type Hit = { chunk_id: string; course_id: string; content: string; score: number };

/**
 * Une question devient « mot1 OR mot2 OR … » : un passage pertinent n'a pas
 * besoin de contenir tous les mots, et ts_rank favorise ceux qui en ont le plus.
 * Les mots vides sont déjà ignorés par la configuration « french » de Postgres.
 */
function ftsQuery(question: string) {
  const terms = [...new Set(question.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [])].filter((t) => t.length >= 2);
  return terms.join(" OR ");
}

/**
 * Recherche hybride : vecteurs Voyage quand ils existent, plein texte sinon,
 * les deux fusionnés par rang réciproque quand les deux répondent.
 */
export async function retrievePassages(query: string, limit = 8): Promise<RetrievedPassage[]> {
  const client = db();
  const [vec] = (await embed([query], "query").catch(() => null)) ?? [];
  const fts = ftsQuery(query);

  const [vectorHits, ftsHits] = await Promise.all([
    vec
      ? client
          .rpc("match_chunks", { query_embedding: vec, match_count: limit * 2, min_similarity: 0.2 })
          .then((r) => (r.data ?? []) as Hit[])
      : Promise.resolve([] as Hit[]),
    fts
      ? client.rpc("search_chunks_fts", { query: fts, match_count: limit * 2 }).then((r) => (r.data ?? []) as Hit[])
      : Promise.resolve([] as Hit[]),
  ]);

  const fused = new Map<string, { hit: Hit; score: number }>();
  const add = (hits: Hit[], weight: number) => {
    hits.forEach((h, rank) => {
      const s = weight / (rank + 10);
      const prev = fused.get(h.chunk_id);
      fused.set(h.chunk_id, { hit: h, score: (prev?.score ?? 0) + s });
    });
  };
  add(vectorHits, 1.2);
  add(ftsHits, 1);

  const ordered = [...fused.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  const courses = await getCoursesByIds([...new Set(ordered.map((o) => o.hit.course_id))]);
  return ordered
    .map((o) => {
      const course = courses.get(o.hit.course_id);
      return course ? { chunkId: o.hit.chunk_id, course, content: o.hit.content, score: o.score } : null;
    })
    .filter((p): p is RetrievedPassage => !!p);
}
