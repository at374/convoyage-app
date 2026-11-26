-- À exécuter dans Supabase SQL Editor avant de déployer la nouvelle version DriiveMe.
-- Une ligne par utilisateur/plateforme, pour conserver l'état du tour national entre appels Cloud Run.
create table if not exists public.plateforme_sync_cycles (
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  cycle_started_at timestamptz,
  failed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, platform)
);

alter table public.plateforme_sync_cycles enable row level security;
-- Aucun accès client : seules les fonctions serveur avec service_role lisent/écrivent cette table.
revoke all on public.plateforme_sync_cycles from anon, authenticated;
grant all on public.plateforme_sync_cycles to service_role;
