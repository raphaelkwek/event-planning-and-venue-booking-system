-- K2 (SPM-39): how well the venue suits a booking request, assessed by K1's
-- rules against the request's own values when it is submitted, and the
-- coordinator's justification when it is not suitable. The coordinator and the
-- time are the request's requested_by and requested_at.
--
-- suitability_reasons is a snapshot: the failing conditions as they were
-- evaluated then, which later changes to the venue don't touch.
--
-- Numbered 0011 because 0007 to 0010 are taken by the M1, N1 and I2 branches.
--
-- Requests made before K2 were never assessed, so all three columns stay null.
-- Both checks are added NOT VALID, so adding them doesn't scan the table: every
-- existing row has the three columns null, which both allow, and every row
-- inserted or updated from now on is checked.

alter table venue.booking_requests
  add column suitability_status       text,
  add column suitability_reasons      jsonb,
  add column unsuitable_justification text;

alter table venue.booking_requests
  add constraint booking_requests_suitability_status_check
    check (suitability_status in ('SUITABLE', 'SUITABLE_WITH_WARNINGS', 'NOT_SUITABLE')) not valid;

-- Assessed requests record their failing conditions, an empty list when none
-- failed. A Not suitable request has at least one, and a justification with a
-- character that isn't a space; any other request has no justification.
-- jsonb_array_length is guarded by CASE because it fails on anything but an
-- array. A check passes when its expression is null, so the whole expression is
-- wrapped in coalesce: a null justification on a Not suitable request fails.
alter table venue.booking_requests
  add constraint booking_requests_justification_recorded check (coalesce(
    (suitability_status is null and suitability_reasons is null and unsuitable_justification is null)
    or (suitability_status in ('SUITABLE', 'SUITABLE_WITH_WARNINGS')
        and case when jsonb_typeof(suitability_reasons) = 'array' then jsonb_array_length(suitability_reasons) = 0 end
        and unsuitable_justification is null)
    or (suitability_status = 'NOT_SUITABLE'
        and case when jsonb_typeof(suitability_reasons) = 'array' then jsonb_array_length(suitability_reasons) > 0 end
        and unsuitable_justification ~ '[^[:space:]]'),
    false
  )) not valid;
