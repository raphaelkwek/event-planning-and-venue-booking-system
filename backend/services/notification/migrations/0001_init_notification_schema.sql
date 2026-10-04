-- ---------------------------------------------------------------------------
-- The notification service's schema (EN-04.3, ADR-0008, implementation.md §3.5).
--
-- notification.consumed_messages is the inbox: a message's id is inserted in
-- the same transaction as the notifications it raises, so a duplicate delivery
-- hits the primary key and is skipped.
--
-- notification.notifications holds one row per recipient (T2 AC1): who, what
-- type of notification, the event and its reference, and a message saying
-- what happened. Read state is per row, so per user (T2 AC6); T2 sets it.
-- ---------------------------------------------------------------------------
create schema if not exists notification;

create table notification.consumed_messages (
  message_id   uuid primary key,          -- the CloudEvent's id
  consumer     text        not null,
  consumed_at  timestamptz not null default now()
);

create table notification.notifications (
  id                 uuid primary key default gen_random_uuid(),
  -- identity.users.id of the person notified, named by the message itself.
  recipient_user_id  uuid        not null,
  -- The CloudEvent type that raised it, e.g. event.approved.
  notification_type  text        not null,
  event_id           uuid        not null,
  event_reference    text        not null,
  -- A booking, reservation or registration reference, where one applies (T2 AC1).
  related_reference  text,
  message            text        not null,
  source_message_id  uuid        not null references notification.consumed_messages (message_id),
  -- When the triggering change committed (the CloudEvent's time).
  occurred_at        timestamptz not null,
  read_at            timestamptz,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  unique (source_message_id, recipient_user_id)
);

-- T2's list: a user's own notifications, newest first.
create index notifications_recipient_newest_idx
  on notification.notifications (recipient_user_id, created_at desc);
-- T2's unread count.
create index notifications_recipient_unread_idx
  on notification.notifications (recipient_user_id) where read_at is null;
