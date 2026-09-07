"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">Quelque chose a cassé</h1>
      <p className="max-w-md text-sm text-text-3">{error.message || "Erreur inattendue."}</p>
      <button type="button" onClick={reset} className="btn-primary mt-2">
        Réessayer
      </button>
    </main>
  );
}
