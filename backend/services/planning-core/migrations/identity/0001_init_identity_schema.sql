create schema if not exists identity;

create table identity.users (
  id               uuid primary key default gen_random_uuid(),
  supabase_user_id uuid not null unique,
  email            text not null unique,
  is_active        boolean not null default true,
  last_login_at    timestamptz,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);

create table identity.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references identity.users (id),
  role       text not null check (role in (
               'EVENT_ORGANISER', 'EVENT_COORDINATOR', 'VENUE_STAFF',
               'TECH_SUPPORT_STAFF', 'ATTENDEE'
             )),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (user_id, role)
);

create table identity.login_audit (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references identity.users (id),
  email_tried text not null,
  outcome     text not null check (outcome in (
                'SUCCESS', 'INVALID_CREDENTIALS', 'DEACTIVATED_ACCOUNT'
              )),
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table identity.role_policy (
  id          uuid primary key default gen_random_uuid(),
  role        text not null unique check (role in (
                'EVENT_ORGANISER', 'EVENT_COORDINATOR', 'VENUE_STAFF',
                'TECH_SUPPORT_STAFF', 'ATTENDEE'
              )),
  description text not null,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create index on identity.user_roles (user_id);
create index on identity.login_audit (user_id);
create index on identity.login_audit (occurred_at);
