-- I2: validates 0009's check in a transaction of its own.
alter table venue.unavailability_blocks validate constraint unavailability_blocks_removal_recorded;
