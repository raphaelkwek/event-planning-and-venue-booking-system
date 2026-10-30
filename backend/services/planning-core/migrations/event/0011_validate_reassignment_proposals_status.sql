-- E4: validates the status check 0010 replaced NOT VALID. No existing row can
-- fail: the new list is the old three plus CLOSED.
alter table event.reassignment_proposals validate constraint reassignment_proposals_status_check;
