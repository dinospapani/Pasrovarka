create table if not exists public.safety_contacts (user_id uuid primary key default auth.uid() references auth.users on delete cascade, email text, tg_code text, tg_chat_id bigint, tg_name text, updated_at timestamptz not null default now());
alter table public.safety_contacts enable row level security;
drop policy if exists "own contact" on public.safety_contacts;
create policy "own contact" on public.safety_contacts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create table if not exists public.safety_trips (id text primary key, user_id uuid not null default auth.uid() references auth.users on delete cascade, user_name text, route text, due_at timestamptz not null, last_lat double precision, last_lon double precision, last_at timestamptz, status text not null default 'active', start_sent boolean not null default false, alerted_at timestamptz, done_sent boolean not null default false, created_at timestamptz not null default now());
alter table public.safety_trips enable row level security;
drop policy if exists "own trips" on public.safety_trips;
create policy "own trips" on public.safety_trips for all using (user_id = auth.uid()) with check (user_id = auth.uid());
