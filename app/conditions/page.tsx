import type { Metadata } from "next";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function TermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-4 px-6 py-12 text-sm text-text-2">
      <h1 className="text-2xl font-semibold text-text">Conditions d&apos;utilisation</h1>
      <p>
        StudyOS est un outil personnel de gestion de cours et de révision, réservé à un unique utilisateur. Il n&apos;est pas destiné à un
        usage commercial ou public, et l&apos;accès est protégé par un code personnel.
      </p>
      <p>
        L&apos;application est fournie « en l&apos;état », sans garantie. Les fiches de révision et les réponses de l&apos;agent
        conversationnel sont générées par un modèle de langage et peuvent contenir des erreurs : elles doivent être vérifiées avant tout
        usage en examen ou en devoir.
      </p>
      <p>L&apos;utilisateur reste seul responsable du contenu qu&apos;il importe et des décisions prises à partir des réponses générées.</p>
    </main>
  );
}
