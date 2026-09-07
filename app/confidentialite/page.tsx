import type { Metadata } from "next";

export const metadata: Metadata = { title: "Confidentialité" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-4 px-6 py-12 text-sm text-text-2">
      <h1 className="text-2xl font-semibold text-text">Confidentialité</h1>
      <p>
        StudyOS est une application personnelle, développée par et pour un unique utilisateur (l&apos;étudiant qui l&apos;a créée). Elle
        n&apos;est pas distribuée à d&apos;autres personnes et ne collecte aucune donnée à des fins commerciales, publicitaires ou
        d&apos;analyse.
      </p>
      <h2 className="mt-2 text-lg font-medium text-text">Données lues sur Google Calendar</h2>
      <p>
        L&apos;application se connecte au Google Calendar de son unique utilisateur en lecture seule (scope <code>calendar.readonly</code>)
        pour afficher son emploi du temps dans un planning. Elle ne modifie, ne supprime et ne partage jamais ces données. Aucune donnée de
        calendrier n&apos;est transmise à un tiers.
      </p>
      <h2 className="mt-2 text-lg font-medium text-text">Autres données</h2>
      <p>
        Le contenu des cours importés ou saisis est stocké dans une base de données privée et n&apos;est envoyé qu&apos;à l&apos;API
        d&apos;Anthropic (Claude) pour être analysé et pour alimenter l&apos;agent conversationnel de révision. Aucune donnée n&apos;est
        vendue, partagée ou utilisée pour entraîner un modèle tiers.
      </p>
      <h2 className="mt-2 text-lg font-medium text-text">Contact</h2>
      <p>Pour toute question, contacter le développeur via l&apos;adresse associée au compte Google connecté.</p>
    </main>
  );
}
