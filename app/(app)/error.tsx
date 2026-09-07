"use client";

import Link from "next/link";

/** Erreur dans une page de l'app : la navigation reste visible. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const config = /SUPABASE|ANTHROPIC|GOOGLE|TOKEN_ENCRYPTION|manquant/i.test(error.message);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">{config ? "Configuration incomplète" : "Quelque chose a cassé"}</h1>
      <p className="max-w-md text-sm text-text-3">{error.message || "Erreur inattendue."}</p>
      {config ? (
        <p className="max-w-md text-sm text-text-2">
          Renseigne les variables dans <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs">.env.local</code> (modèle dans{" "}
          <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs">.env.example</code>), puis relance le serveur.
        </p>
      ) : null}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={reset} className="btn-primary">
          Réessayer
        </button>
        <Link href="/reglages" className="btn-secondary">
          Réglages
        </Link>
      </div>
    </div>
  );
}
