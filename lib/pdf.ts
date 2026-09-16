import { extractText, getDocumentProxy } from "unpdf";

/** Texte brut d'un PDF, pages séparées par une ligne vide (mêmes coupures de paragraphes que Word). */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.join("\n\n").trim();
}
