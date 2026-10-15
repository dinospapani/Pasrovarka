alter table public.safety_contacts add column if not exists self_code text;
alter table public.safety_contacts add column if not exists self_chat_id bigint;
alter table public.safety_trips add column if not exists battery int;
alter table public.safety_trips add column if not exists hb_at timestamptz;
alter table public.safety_trips add column if not exists silence_min int not null default 0;
alter table public.safety_trips add column if not exists ping_at timestamptz;
alter table public.safety_trips add column if not exists silence_sent boolean not null default false;
alter table public.safety_trips add column if not exists lowbat_sent boolean not null default false;
