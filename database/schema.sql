-- Supabase schema for LeadFlow AI
-- Run this in Supabase SQL editor before starting the app.

create table if not exists public.users (
    id bigint primary key generated always as identity,
    name text not null,
    email text not null unique,
    password text not null,
    profession text not null,
    business_name text not null,
    business_phone text not null,
    location text not null,
    services text not null,
    website text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.leads (
    id bigint primary key generated always as identity,
    user_id bigint not null references public.users(id) on delete cascade,
    name text not null,
    phone text not null,
    service text not null,
    status text not null default 'New',
    note text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists leads_user_id_idx on public.leads (user_id);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
