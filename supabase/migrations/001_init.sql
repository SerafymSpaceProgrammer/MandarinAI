create table profiles (
  id uuid primary key references auth.users on delete cascade,
  hsk_level int default 1 check (hsk_level between 1 and 6),
  native_language text default 'en',
  created_at timestamptz default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  scenario text not null,
  hsk_level int not null,
  duration_seconds int,
  transcript jsonb,
  created_at timestamptz default now()
);

create table vocab (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  hanzi text not null,
  pinyin text not null,
  english text not null,
  source_conversation_id uuid references conversations,
  srs_interval_days int default 1,
  next_review_at timestamptz default now(),
  ease_factor float default 2.5,
  created_at timestamptz default now(),
  unique (user_id, hanzi)
);

alter table profiles enable row level security;
alter table conversations enable row level security;
alter table vocab enable row level security;

create policy "own profile"
  on profiles for all using (auth.uid() = id);
create policy "own conversations"
  on conversations for all using (auth.uid() = user_id);
create policy "own vocab"
  on vocab for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
