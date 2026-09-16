-- Les chapitres deviennent manuels : l'IA propose (texte / chapitre existant),
-- mais ne crée ni ne rattache plus rien toute seule. Ces colonnes portent sa proposition.
alter table courses add column if not exists ai_suggested_chapter_id uuid references chapters(id) on delete set null;
alter table courses add column if not exists ai_suggested_chapter_title text;
