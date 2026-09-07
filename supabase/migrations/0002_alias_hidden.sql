-- Un titre d'événement peut être masqué (TD d'un autre groupe, par exemple) :
-- ses créneaux ne sont plus importés du calendrier.
alter table subject_aliases add column if not exists hidden boolean not null default false;
