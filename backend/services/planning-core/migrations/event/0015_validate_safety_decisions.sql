-- U1: validates the foreign key 0014 added NOT VALID, in a transaction of its own. The table
-- was created in 0014, so no existing row can fail.
alter table event.safety_decisions validate constraint safety_decisions_event_id_fkey;
