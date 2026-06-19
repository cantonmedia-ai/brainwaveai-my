create extension if not exists pgcrypto;

create table if not exists public.partner_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  company_name text,
  email text not null,
  phone text,
  country text,
  website text,
  project_interest text not null,
  partner_type text not null,
  business_type text,
  resources text,
  budget text,
  message text,
  status text not null default 'NEW'
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  message text not null,
  type text not null,
  status text not null default 'UNREAD',
  lead_id uuid references public.partner_leads(id)
);

create index if not exists partner_leads_status_idx on public.partner_leads(status);
create index if not exists admin_notifications_status_idx on public.admin_notifications(status);
