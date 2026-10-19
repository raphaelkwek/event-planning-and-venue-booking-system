-- ---------------------------------------------------------------------------
-- Venue search by name or building (J2). Numbered 0004: 0002 is reserved for
-- H3's setup and turnaround columns and 0003 is EN-02.1's slots and blocks.
--
-- J2 matches a partial, case-insensitive term anywhere in a venue's name or
-- building with ILIKE '%term%'. A btree index cannot serve a pattern that
-- starts with a wildcard; a trigram GIN index can, so the search stays fast
-- as the catalogue grows. Nothing here changes a column or a row.
-- ---------------------------------------------------------------------------
create extension if not exists pg_trgm;

create index venues_name_trgm_idx on venue.venues using gin (name gin_trgm_ops);
create index venues_building_trgm_idx on venue.venues using gin (building gin_trgm_ops);
