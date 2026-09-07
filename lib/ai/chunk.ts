const TARGET = 1200;
const MAX = 1800;

/**
 * Découpe un cours en passages d'environ 1200 caractères sur les frontières de
 * paragraphes, pour que chaque passage retrouvé par l'agent reste lisible seul.
 */
export function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    const pieces = p.length > MAX ? splitLong(p) : [p];
    for (const piece of pieces) {
      if (current && current.length + piece.length + 1 > TARGET) {
        chunks.push(current);
        current = piece;
      } else {
        current = current ? `${current}\n${piece}` : piece;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitLong(p: string): string[] {
  const sentences = p.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [p];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur.length + s.length > MAX) {
      if (cur) out.push(cur.trim());
      cur = s;
    } else cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
