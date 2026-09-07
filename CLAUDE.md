# StudyOS

App personnelle mono-utilisateur (Julien) : planning Google Calendar, cours importés (Word ou saisie), classification IA par matière/chapitre, agent de révision, fiches.

- Next.js 16 (App Router, `proxy.ts` pour l'auth par cookie), Tailwind v4, Supabase (service role côté serveur uniquement, pas de RLS), Claude via `@anthropic-ai/sdk`, embeddings Voyage (optionnels, repli plein texte).
- Tout le texte visible est en français. Direction artistique : noir + un seul vert d'accent, pas de dégradés.
- Motion : ressorts `--ease-spring*`, classe `pressable`, `lib/motion.ts` ; jamais de transition CSS sur un geste.
- Schéma SQL : `supabase/migrations/0001_init.sql` (à exécuter dans l'éditeur SQL Supabase). Variables : `.env.example`.
- Avant un aperçu : `rm -rf .next` (OneDrive corrompt les liens). Ne jamais lancer `next build` pendant que le serveur de dev tourne.
