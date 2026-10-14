-- One table: every row is a single checklist item, owned by whoever created it.
create table items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Row Level Security starts OFF by default on new tables. Turning it on
-- without any policies means "nobody can read or write this table at all" --
-- a safe default. The policies below then open narrow, specific holes.
alter table items enable row level security;

-- The core of the whole "private checklist" feature. auth.uid() is the
-- logged-in user's id, read from their verified session token by Supabase
-- itself -- it cannot be spoofed by anything the browser sends.
--
-- Four separate policies (select/insert/update/delete) rather than one
-- blanket rule, so each kind of access is reasoned about on its own.
create policy "select own items"
  on items for select
  using (auth.uid() = user_id);

create policy "insert own items"
  on items for insert
  with check (auth.uid() = user_id);

create policy "update own items"
  on items for update
  using (auth.uid() = user_id);

create policy "delete own items"
  on items for delete
  using (auth.uid() = user_id);

-- Lets "ORDER BY created_at" scale as a list grows, instead of a full scan.
create index items_user_id_created_at_idx on items (user_id, created_at);
