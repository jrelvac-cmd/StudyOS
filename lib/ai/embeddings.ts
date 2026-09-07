const MODEL = "voyage-3.5";
const BATCH = 64;

export function embeddingsAvailable() {
  return !!process.env.VOYAGE_API_KEY;
}

/**
 * Embeddings Voyage (1024 dimensions). Rend null sans clé : la recherche
 * retombe alors sur le plein texte Postgres.
 */
export async function embed(texts: string[], inputType: "document" | "query"): Promise<number[][] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key || !texts.length) return null;

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ input: texts.slice(i, i + BATCH), model: MODEL, input_type: inputType }),
    });
    if (!res.ok) throw new Error(`Voyage: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    for (const d of data.data.sort((a, b) => a.index - b.index)) out.push(d.embedding);
  }
  return out;
}
