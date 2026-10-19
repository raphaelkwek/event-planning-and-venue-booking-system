-- G1: an event's contact details, and the version that edits are checked
-- against (If-Match, ADR-0015).
--
-- Contact details are free text, such as a name, email and phone number. The
-- request form (B1) doesn't ask for them, so existing events start without any.
alter table event.events add column contact_details text;

-- Every change to an event row raises its version, whoever makes it: G1's
-- edit, a status change (F1), a review claim (D1). An editor sends back the
-- version they loaded, so a save based on a stale copy is refused (412) instead
-- of silently replacing someone else's change. The trigger does it, so no
-- write path can forget.
alter table event.events add column version integer not null default 1;

create function event.raise_event_version() returns trigger
language plpgsql as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger events_raise_version
  before update on event.events
  for each row execute function event.raise_event_version();
