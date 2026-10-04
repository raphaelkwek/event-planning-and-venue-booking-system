-- ---------------------------------------------------------------------------
-- Setup and turnaround time (H3, CR-01). Whole minutes, 0 or more; existing
-- venues start at 0, which leaves their occupied periods as they were.
-- ADR-0006's blocked_period on booked slots will be computed from these.
-- ---------------------------------------------------------------------------
alter table venue.venues
  add column setup_minutes      int not null default 0 check (setup_minutes >= 0),
  add column turnaround_minutes int not null default 0 check (turnaround_minutes >= 0);
