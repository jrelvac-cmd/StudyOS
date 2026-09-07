/**
 * Couleur stable par matière, dérivée de son identifiant (aucune donnée à
 * stocker ni à choisir : la même matière garde toujours la même teinte).
 */
export function subjectColor(subjectId: string | null | undefined) {
  if (!subjectId) {
    return { text: "var(--accent)", border: "rgba(48, 209, 88, 0.3)", bg: "var(--accent-dim)" };
  }
  let hash = 0;
  for (let i = 0; i < subjectId.length; i++) hash = (hash * 31 + subjectId.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return {
    text: `hsl(${hue} 80% 72%)`,
    border: `hsl(${hue} 70% 50% / 0.45)`,
    bg: `hsl(${hue} 70% 50% / 0.16)`,
  };
}
