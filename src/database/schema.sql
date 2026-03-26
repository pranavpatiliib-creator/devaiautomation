-- =====================================================
-- LeadFlow AI Production Schema
-- Multi-Tenant AI Receptionist SaaS
-- =====================================================

create extension if not exists "uuid-ossp";

-------------------------------------------------------
-- USERS (Platform Users)
-------------------------------------------------------

create table if not exists users (
 id uuid primary key default uuid_generate_v4(),
 name text not null,
 email text not null unique,
 password text not null,
 profession text,
 business_name text,
 business_phone text,
 services text,
 website text,
 location text,
 created_at timestamptz default now()
);

-------------------------------------------------------
-- TENANTS
-------------------------------------------------------

create table if not exists tenants (
 id uuid primary key default uuid_generate_v4(),
 user_id uuid references users(id) on delete cascade,
 business_name text not null,
 industry text,
 whatsapp_number text,
 fb_page_id text,
 instagram_id text,
 created_at timestamptz default now()
);

create index tenants_user_idx on tenants(user_id);

-------------------------------------------------------
-- CHANNEL CONNECTIONS
-------------------------------------------------------

create table if not exists channel_connections (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id) on delete cascade,
 channel text not null,
 access_token text,
 page_id text,
 phone_number text,
 metadata jsonb,
 is_active boolean default true,
 created_at timestamptz default now()
);

-------------------------------------------------------
-- CUSTOMERS
-------------------------------------------------------

create table if not exists customers (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id) on delete cascade,
 channel text not null,
 sender_id text not null,
 name text,
 phone text,
 created_at timestamptz default now(),
 unique(tenant_id,channel,sender_id)
);

create index customers_tenant_idx on customers(tenant_id);

-------------------------------------------------------
-- CONVERS`ATIONS

create table if not exists conversations (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id) on delete cascade,
 customer_id uuid references customers(id) on delete cascade,
 channel text,
 sender_id text,
 message text,
 direction text,
 intent text,
 state text default 'menu',
 message_id text,
 created_at timestamptz default now()
);

create index conversations_customer_idx on conversations(customer_id);

-------------------------------------------------------
-- SERVICES
-------------------------------------------------------

create table if not exists services (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id) on delete cascade,
 service_name text not null,
 description text,
 price numeric,
 discount numeric default 0,
 created_at timestamptz default now()
);

create index services_tenant_idx on services(tenant_id);

-------------------------------------------------------
-- OFFERS
-------------------------------------------------------

create table if not exists offers (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id) on delete cascade,
 title text,
 description text,
 discount numeric,
 valid_until date,
 is_active boolean default true,
 created_at timestamptz default now()
);

create index offers_tenant_idx on offers(tenant_id);

-------------------------------------------------------
-- MENU OPTIONS (Dashboard Configurable)
-------------------------------------------------------

create table if not exists menu_options (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id) on delete cascade,
 title text not null,
 action_type text not null,
 action_value text,
 position int default 1,
 created_at timestamptz default now()
);

create index menu_tenant_idx on menu_options(tenant_id);

-------------------------------------------------------
-- LEADS
-------------------------------------------------------

create table if not exists leads (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id) on delete cascade,
 customer_id uuid references customers(id),
 name text,
 phone text,
 service text,
 status text default 'new',
 note text,
 created_at timestamptz default now()
);

create index if not exists leads_tenant_idx on leads(tenant_id);

-------------------------------------------------------
-- APPOINTMENTS
-------------------------------------------------------

create table if not exists appointments (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id) on delete cascade,
 customer_id uuid references customers(id),
 service_id uuid references services(id),
 appointment_date date,
 appointment_time text,
 status text default 'scheduled',
 booking_source text default 'chatbot',
 notes text,
 created_at timestamptz default now()
);

create index appointments_tenant_idx on appointments(tenant_id);

-------------------------------------------------------
-- AUTOMATION RULES
-------------------------------------------------------

create table if not exists automation_rules (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id),
 trigger_type text,
 trigger_value text,
 reply text,
 priority int default 1,
 created_at timestamptz default now()
);

create index if not exists automation_rules_tenant_idx on automation_rules(tenant_id);

-------------------------------------------------------
-- KNOWLEDGE BASE
-------------------------------------------------------

create table if not exists knowledge_base (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id),
 question text,
 answer text,
 created_at timestamptz default now()
);

create index if not exists knowledge_base_tenant_idx on knowledge_base(tenant_id);

create index if not exists channel_connections_tenant_idx on channel_connections(tenant_id);
create index if not exists conversations_tenant_idx on conversations(tenant_id);

alter table users add column if not exists services text;
alter table users add column if not exists website text;
alter table offers add column if not exists is_active boolean default true;
alter table channel_connections add column if not exists is_active boolean default true;
alter table channel_connections add column if not exists metadata jsonb;

-------------------------------------------------------
-- AI RESPONSES
-------------------------------------------------------

create table if not exists ai_responses (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id),
 customer_id uuid references customers(id),
 prompt text,
 response text,
 created_at timestamptz default now()
);

-------------------------------------------------------
-- AI USAGE
-------------------------------------------------------

create table if not exists ai_usage (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id),
 model text,
 tokens_used int,
 cost numeric,
 created_at timestamptz default now()
);

-------------------------------------------------------
-- AUTOMATION LOGS
-------------------------------------------------------

create table if not exists automation_logs (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id),
 workflow_name text,
 status text,
 payload jsonb,
 created_at timestamptz default now()
);

-------------------------------------------------------
-- SOCIAL POSTS (Automatic Posting System)
-------------------------------------------------------

create table if not exists social_posts (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id) on delete cascade,
 platform text not null,
 content text not null,
 media_urls jsonb,
 status text default 'draft',
 scheduled_at timestamptz,
 posted_at timestamptz,
 attempts int default 0,
 max_attempts int default 5,
 next_retry_at timestamptz,
 last_error text,
 created_at timestamptz default now(),
 updated_at timestamptz default now()
);

create index if not exists social_posts_tenant_idx on social_posts(tenant_id);
create index if not exists social_posts_status_idx on social_posts(status);
create index if not exists social_posts_scheduled_idx on social_posts(scheduled_at);

create table if not exists social_post_attempts (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id) on delete cascade,
 post_id uuid references social_posts(id) on delete cascade,
 status text not null,
 error text,
 payload jsonb,
 created_at timestamptz default now()
);

create index if not exists social_post_attempts_post_idx on social_post_attempts(post_id);

-------------------------------------------------------
-- AUTO REPLY SETTINGS + JOBS
-------------------------------------------------------

create table if not exists auto_reply_settings (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id) on delete cascade unique,
 enabled boolean default true,
 delay_seconds int default 0,
 ai_enabled boolean default false,
 created_at timestamptz default now(),
 updated_at timestamptz default now()
);

create table if not exists auto_reply_jobs (
 id uuid primary key default uuid_generate_v4(),
 tenant_id uuid references tenants(id) on delete cascade,
 customer_id uuid references customers(id) on delete set null,
 incoming_conversation_id uuid references conversations(id) on delete set null,
 channel text,
 sender_id text,
 incoming_message_id text,
 incoming_message text,
 reply_text text,
 run_at timestamptz not null,
 status text default 'pending',
 attempts int default 0,
 max_attempts int default 5,
 next_retry_at timestamptz,
 last_error text,
 created_at timestamptz default now(),
 updated_at timestamptz default now(),
 unique(tenant_id, channel, sender_id, incoming_message_id)
);

create index if not exists auto_reply_jobs_tenant_idx on auto_reply_jobs(tenant_id);
create index if not exists auto_reply_jobs_run_idx on auto_reply_jobs(run_at);
create index if not exists auto_reply_jobs_status_idx on auto_reply_jobs(status);
