import Anthropic from "@anthropic-ai/sdk";

/** Haiku 4.5 par défaut : le moins cher. Passer à claude-sonnet-5 ou claude-opus-5 via CLAUDE_MODEL si la qualité manque. */
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5";

// Les modèles 4.5 n'acceptent ni `effort` ni les outils web de 2026.
const LEGACY_MODEL = /-4-5\b/.test(CLAUDE_MODEL);

type Effort = "low" | "medium" | "high";

/** À étaler dans les paramètres d'appel : `effort` seulement quand le modèle le supporte. */
export function effort(level: Effort): { output_config?: { effort: Effort } };
export function effort<F>(level: Effort, format: F): { output_config: { effort?: Effort; format: F } };
export function effort<F>(level: Effort, format?: F) {
  if (format === undefined) return LEGACY_MODEL ? {} : { output_config: { effort: level } };
  return { output_config: LEGACY_MODEL ? { format } : { effort: level, format } };
}

export function webSearchTool(maxUses = 3) {
  return LEGACY_MODEL
    ? { type: "web_search_20250305" as const, name: "web_search" as const, max_uses: maxUses }
    : { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: maxUses };
}

let client: Anthropic | null = null;

export function anthropic() {
  if (!client) client = new Anthropic();
  return client;
}
