-- Q1: validates 0005's foreign keys in a transaction of its own, so the scan
-- does not run while 0005's locks are held. Every existing row has a null
-- reservation_id, so validation finds nothing to refuse.
alter table equipment.unit_reservations validate constraint unit_reservations_reservation_fkey;
alter table equipment.bulk_reservations validate constraint bulk_reservations_reservation_fkey;
