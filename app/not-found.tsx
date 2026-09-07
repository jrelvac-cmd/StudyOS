import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <p className="text-sm text-text-3">Ce cours, cette fiche ou cette page n&apos;existe plus.</p>
      <Link href="/planning" className="btn-primary mt-2">
        Retour au planning
      </Link>
    </main>
  );
}
