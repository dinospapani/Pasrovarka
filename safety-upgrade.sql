alter table public.safety_contacts add column if not exists self_code text;
alter table public.safety_contacts add column if not exists self_chat_id bigint;
alter table public.safety_trips add column if not exists battery int;
alter table public.safety_trips add column if not exists hb_at timestamptz;
alter table public.safety_trips add column if not exists silence_min int not null default 0;
alter table public.safety_trips add column if not exists ping_at timestamptz;
alter table public.safety_trips add column if not exists silence_sent boolean not null default false;
alter table public.safety_trips add column if not exists lowbat_sent boolean not null default false;
create table if not exists public.push_subs (id text primary key, user_id uuid not null default auth.uid() references auth.users on delete cascade, sub jsonb not null, places jsonb not null default '[]'::jsonb, threshold int not null default 75, state jsonb not null default '{}'::jsonb, checked_at timestamptz, updated_at timestamptz not null default now());
alter table public.push_subs enable row level security;
drop policy if exists "own push" on public.push_subs;
create policy "own push" on public.push_subs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.push_subs add column if not exists pressure boolean not null default true;

alter table public.safety_trips add column if not exists pa_at timestamptz;
