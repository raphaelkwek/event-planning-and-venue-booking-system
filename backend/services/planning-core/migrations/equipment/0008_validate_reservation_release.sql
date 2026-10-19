-- Q2: validates 0007's check in a transaction of its own.
alter table equipment.reservations validate constraint reservations_release_recorded;
