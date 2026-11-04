import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import { Checkbox } from "@atlaskit/checkbox";
import SectionMessage from "@atlaskit/section-message";
import TextArea from "@atlaskit/textarea";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import {
  getSafetyReview,
  recordSafetyDecision,
  type SafetyDecisionKind,
  type SafetyDecisionRecord,
  type SafetyReview,
} from "../api/safetyReviews.js";
import { formatPeriod } from "../shared/singaporeTime.js";
import { Refusal } from "../components/Refusal.js";

const DECISIONS: { value: SafetyDecisionKind; label: string; help: string }[] = [
  { value: "APPROVE", label: "Approve", help: "The check is recorded as passed. The event stays in Safety Review until its coordinator marks it Confirmed." },
  { value: "REQUEST_CHANGES", label: "Request changes", help: "The event returns to Planning. Tick the arrangements that need review; they are flagged." },
  { value: "REJECT", label: "Reject the safety arrangement", help: "The event returns to Planning. The arrangement is rejected as a whole; the event is not rejected or cancelled and its arrangements stay." },
];

const cell = { padding: "6px 8px", borderBottom: "1px solid #DFE1E6", textAlign: "left" as const, verticalAlign: "top" as const };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
      <dt style={{ width: 190, color: "#626F86" }}>{label}</dt>
      <dd style={{ margin: 0 }}>{children}</dd>
    </div>
  );
}

/**
 * U1 — the review of one event: the factors the Safety Officer weighs, then the one decision.
 * Emergency access, venue restrictions and crowd movement are assessed outside the system and
 * written into the reason (CQ-10). A refusal stays on the form with the server's own message.
 */
export function SafetyReviewDetail() {
  const session = useSignedIn();
  const { eventId } = useParams();
  const [review, setReview] = useState<SafetyReview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [decision, setDecision] = useState<SafetyDecisionKind>("APPROVE");
  const [reason, setReason] = useState("");
  const [bookingIds, setBookingIds] = useState<string[]>([]);
  const [reservationIds, setReservationIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // D2: a decision that returns the event to Planning takes it out of Safety Review, so its review can
  // no longer be read (409). The outcome comes from the decision's own response instead of a re-read.
  const [leftReview, setLeftReview] = useState<SafetyDecisionRecord["decision"] | null>(null);

  const load = useCallback(() => {
    if (!eventId) return;
    getSafetyReview(session.token, eventId)
      .then((loaded) => {
        setReview(loaded);
        setError(null);
      })
      .catch((caught) => {
        setReview(null);
        setError(caught);
      });
  }, [eventId, session.token]);

  useEffect(load, [load]);

  const toggle = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  async function submit() {
    if (!eventId) return;
    setBusy(true);
    try {
      const recorded = await recordSafetyDecision(session.token, eventId, {
        decision,
        reason,
        ...(decision === "REQUEST_CHANGES" ? { flagBookingIds: bookingIds, flagReservationIds: reservationIds } : {}),
      });
      setReason("");
      setBookingIds([]);
      setReservationIds([]);
      setDecision("APPROVE");
      setError(null);
      if (recorded.event.status === "SAFETY_REVIEW") load();
      else setLeftReview(recorded.decision.decision);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  // A refusal for a review that cannot be read (not in Safety Review, not found) replaces the page.
  if (!review) {
    return (
      <div>
        <p>
          <Link to="/safety">Back to the safety queue</Link>
        </p>
        <Refusal error={error} plain />
      </div>
    );
  }

  const { event, factors, flags } = review;
  const decided = review.decision;
  const reasonError = error instanceof ApiError ? error.fieldMessage("reason") : undefined;

  return (
    <div>
      <p>
        <Link to="/safety">Back to the safety queue</Link>
      </p>
      <h2 style={{ marginBottom: 4 }}>
        {event.reference ?? event.id} · {event.name}
      </h2>
      <p style={{ marginTop: 0 }}>
        {event.proposedStartAt && event.proposedEndAt ? formatPeriod(event.proposedStartAt, event.proposedEndAt) : "No period set"}
      </p>

      <h3>Factors to weigh</h3>
      <dl aria-label="Safety factors">
        <Row label="Expected attendance">{factors.expectedAttendance ?? "Not stated"}</Row>
        <Row label="Accessibility requirements">{factors.accessibilityNeeds ?? "None stated"}</Row>
      </dl>

      <h4>Venues</h4>
      {factors.venues.length === 0 ? (
        <p>No venue is booked.</p>
      ) : (
        <table aria-label="Booked venues" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Booking", "Venue", "Period", "Layout booked", "Layout capacity", "Venue capacity", "Layouts offered"].map((heading) => (
                <th key={heading} style={cell}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factors.venues.map((venue) => (
              <tr key={venue.bookingId}>
                <td style={cell}>
                  {venue.reference} ({venue.status === "HELD" ? "hold" : "confirmed"})
                </td>
                <td style={cell}>{venue.venueName}</td>
                <td style={cell}>{formatPeriod(venue.startsAt, venue.endsAt)}</td>
                <td style={cell}>{venue.layout ?? "Not recorded"}</td>
                <td style={cell}>{venue.layoutCapacity}</td>
                <td style={cell}>{venue.venueMaxCapacity}</td>
                <td style={cell}>{venue.layouts.map((layout) => `${layout.name} (${layout.capacity})`).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h4>Equipment</h4>
      {factors.equipment.length === 0 ? (
        <p>No equipment is requested.</p>
      ) : (
        <table aria-label="Equipment and placement" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Equipment", "Quantity", "Reserved", "Placement notes"].map((heading) => (
                <th key={heading} style={cell}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factors.equipment.map((line) => (
              <tr key={line.lineId}>
                <td style={cell}>{line.equipmentTypeName}</td>
                <td style={cell}>{line.quantity}</td>
                <td style={cell}>{line.reservedQuantity}</td>
                <td style={cell}>{line.placementNotes || "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {flags.length > 0 && (
        <SectionMessage appearance="warning" title="Arrangement flags are outstanding">
          <ul>
            {flags.map((flag) => (
              <li key={`${flag.what}-${flag.name}-${flag.flag}`}>
                {flag.what} {flag.name}: {flag.flag.toLowerCase().replace(/_/g, " ")}
              </li>
            ))}
          </ul>
          <p>You can request changes, but not approve, until they are resolved.</p>
        </SectionMessage>
      )}

      <h3>Your decision</h3>
      {leftReview ? (
        <SectionMessage appearance="success" title={leftReview === "REJECT" ? "Safety arrangement rejected" : "Changes requested"}>
          <p>The decision is recorded. The event is back in Planning, and its coordinator and the organiser are notified.</p>
        </SectionMessage>
      ) : decided ? (
        <SectionMessage appearance="information" title="A decision is recorded for this review">
          <p>
            {decided.decision === "APPROVE" ? "Approved" : decided.decision === "REJECT" ? "Rejected" : "Changes requested"}
            {decided.reason ? `: ${decided.reason}` : "."}
          </p>
          <p>The event stays in Safety Review until its assigned coordinator marks it Confirmed.</p>
        </SectionMessage>
      ) : (
        <form
          aria-label="Safety decision"
          onSubmit={(submitted) => {
            submitted.preventDefault();
            void submit();
          }}
        >
          <fieldset style={{ border: 0, padding: 0 }}>
            <legend>Decision</legend>
            {DECISIONS.map((option) => (
              <label key={option.value} style={{ display: "block", marginBottom: 8 }}>
                <input type="radio" name="decision" value={option.value} checked={decision === option.value} onChange={() => setDecision(option.value)} />{" "}
                <strong>{option.label}</strong>
                <div style={{ marginLeft: 24, color: "#626F86", fontSize: 13 }}>{option.help}</div>
              </label>
            ))}
          </fieldset>

          {decision === "REQUEST_CHANGES" && (
            <fieldset style={{ border: 0, padding: 0, marginTop: 8 }}>
              <legend>Flag for review</legend>
              {factors.venues.map((venue) => (
                <Checkbox
                  key={venue.bookingId}
                  label={`${venue.reference} at ${venue.venueName}`}
                  isChecked={bookingIds.includes(venue.bookingId)}
                  onChange={() => setBookingIds((ids) => toggle(ids, venue.bookingId))}
                />
              ))}
              {factors.equipment
                .filter((line) => line.reservationId !== null)
                .map((line) => (
                  <Checkbox
                    key={line.reservationId!}
                    label={`${line.equipmentTypeName} × ${line.reservedQuantity}`}
                    isChecked={reservationIds.includes(line.reservationId!)}
                    onChange={() => setReservationIds((ids) => toggle(ids, line.reservationId!))}
                  />
                ))}
            </fieldset>
          )}

          <label htmlFor="safety-reason" style={{ display: "block", marginTop: 12 }}>
            Reason{decision === "APPROVE" ? " (optional)" : " (required)"}
          </label>
          <p style={{ margin: "0 0 4px", color: "#626F86", fontSize: 13 }}>
            Write what you assessed outside the system: emergency access, venue restrictions and crowd movement.
          </p>
          <TextArea id="safety-reason" value={reason} onChange={(changed) => setReason(changed.currentTarget.value)} minimumRows={3} isInvalid={reasonError !== undefined} />
          {reasonError && <p role="alert" style={{ color: "#AE2E24", margin: "4px 0 0" }}>{reasonError}</p>}

          <div style={{ marginTop: 12 }}>
            <Refusal error={error} plain />
          </div>
          <div style={{ marginTop: 12 }}>
            <Button appearance="primary" type="submit" isDisabled={busy}>
              Record decision
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
