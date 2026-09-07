# StudyOS

App personnelle : planning Google Calendar, cours (Word ou saisie), classement IA par matière et chapitre, agent de révision, fiches.

## Mise en route

1. **Supabase** — crée un projet sur supabase.com, ouvre *SQL Editor* et exécute `supabase/migrations/0001_init.sql`. Dans *Project settings › API*, copie l'URL et la clé `service_role` dans `.env.local`.
2. **Claude** — clé API depuis console.anthropic.com → `ANTHROPIC_API_KEY`.
3. **Voyage AI** (optionnel, recherche sémantique) — clé depuis dash.voyageai.com → `VOYAGE_API_KEY`. Sans clé, l'agent utilise la recherche plein texte.
4. **Google Calendar** — sur console.cloud.google.com : crée un projet, active *Google Calendar API*, configure l'écran de consentement (type externe, ajoute ton adresse en utilisateur test), puis *Identifiants › ID client OAuth 2.0 › Application Web* avec l'URI de redirection `http://localhost:3000/api/google/callback` (et celle de Vercel une fois déployé). Copie l'ID et le secret dans `.env.local`.
5. `npm install` puis `npm run dev`, ouvre http://localhost:3000, entre le code.

## Déploiement Vercel

- Importe le dépôt, région Paris (`vercel.json`), ajoute toutes les variables de `.env.example` (avec `APP_URL` = l'URL Vercel et `CRON_SECRET` aléatoire).
- Ajoute `https://<ton-app>.vercel.app/api/google/callback` dans les URI de redirection Google.
- La synchronisation du calendrier tourne chaque matin à 5h UTC (`/api/cron/sync`) ; le bouton *Synchroniser* reste disponible.

## Structure

- `app/(app)/…` pages : planning, bibliothèque, cours, chapitres, agent, fiches, réglages.
- `lib/ai/` : classification (`classify.ts`), indexation (`pipeline.ts`, `chunk.ts`, `embeddings.ts`), retrieval hybride (`retrieval.ts`), fiches (`sheet.ts`).
- `lib/google.ts` : OAuth + synchronisation ; `lib/db/` : accès Supabase ; `lib/actions.ts` : server actions.
- `app/api/agent/chat` : agent en streaming (recherche web Claude quand le toggle est activé).
