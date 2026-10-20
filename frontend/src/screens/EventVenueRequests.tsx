import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import SectionMessage from "@atlaskit/section-message";
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import { useSignedIn } from "../auth/SessionContext.js";
import {
  BOOKABLE_STATUSES,
  listEventBookingRequests,
  withdrawBookingRequest,
  type BookingEvent,
  type BookingRequest,
  type EventBooking,
} from "../api/bookingRequests.js";
import { toLocalInput } from "../api/venues.js";
import { Refusal } from "../components/Refusal.js";
import { BOOKING_REQUEST_APPEARANCE, BOOKING_REQUEST_LABELS, UNAVAILABILITY_LABELS } from "../shared/status.js";
import { formatPeriod } from "../shared/singaporeTime.js";

/**
 * L1, L2, L4, M2 — every venue request an event has made, each with its venue,
 * period, layout, attendance and status, and a rejected one with its reason and
 * any suggested alternative. Its assigned coordinator requests another venue
 * from here, and withdraws one that is still Pending. Anyone else who may see
 * the event sees the list only; the server applies the same rule.
 *
 * L5 (CR-02) — the event's bookings too, each with any unavailability that
 * disrupts it (I2) and the replacements asked for. A confirmed booking a block
 * disrupts offers the assigned coordinator "Find a replacement", which opens the
 * venue search for the booking's period.
 */

const SLOT_LABELS: Record<EventBooking["status"], string> = { HELD: "Held", CONFIRMED: "Confirmed", RELEASED: "Released" };

/** "/venues/search?…": J1's search from the event, for the disrupted booking's period, replacing it (L5). */
function replacementSearch(eventId: string, booking: EventBooking): string {
  const params = new URLSearchParams({
    eventId,
    replaces: booking.id,
    booking: booking.reference,
    venue: booking.venueName,
    from: toLocalInput(booking.startsAt),
    to: toLocalInput(booking.endsAt),
  });
  return `/venues/search?${params}`;
}
export function EventVenueRequests() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const notice = (useLocation().state as { notice?: string } | null)?.notice ?? null;
  const [event, setEvent] = useState<BookingEvent | null>(null);
  const [items, setItems] = useState<BookingRequest[]>([]);
  const [bookings, setBookings] = useState<EventBooking[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [withdrawing, setWithdrawing] = useState<BookingRequest | null>(null);
  const [withdrawError, setWithdrawError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const loaded = await listEventBookingRequests(session.token, id!);
      setEvent(loaded.event);
      setItems(loaded.items);
      setBookings(loaded.bookings ?? []);
    } catch (caught) {
      setLoadError(caught);
    }
  }, [session.token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmWithdraw() {
    if (!withdrawing) return;
    setBusy(true);
    setWithdrawError(null);
    try {
      await withdrawBookingRequest(session.token, withdrawing.id);
      // Replace any earlier message, such as "… submitted.", with what just happened.
      navigate(`/events/${id}/venue-requests`, { replace: true, state: { notice: `${withdrawing.reference} withdrawn.` } });
      setWithdrawing(null);
      await load();
    } catch (caught) {
      setWithdrawError(caught);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <Refusal error={loadError} />;
  if (!event) return <p>Loading…</p>;

  const assigned = event.assignedCoordinatorId === session.userId;
  const canRequest = assigned && BOOKABLE_STATUSES.includes(event.status);

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <h2 style={{ flex: 1, marginBottom: 4 }}>Venue requests</h2>
        {canRequest && (
          <Button appearance="primary" onClick={() => navigate(`/events/${event.id}/venue-requests/new`)}>
            Request a venue
          </Button>
        )}
      </div>
      <p style={{ marginTop: 0, color: "#626F86" }}>
        {event.name} · {event.reference}
      </p>

      {notice && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage appearance="success">
            <p style={{ margin: 0 }}>{notice}</p>
          </SectionMessage>
        </div>
      )}

      {items.length === 0 ? (
        <p>No venue has been requested for this event yet.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Reference", "Venue", "Date and time", "Layout", "Attendance", "Status", ""].map((heading, i) => (
                <th key={i} style={cell}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} aria-label={item.reference}>
                <td style={cell}>{item.reference}</td>
                <td style={cell}>{item.venueName}</td>
                <td style={cell}>{formatPeriod(item.startsAt, item.endsAt)}</td>
                <td style={cell}>{item.layout}</td>
                <td style={cell}>{item.expectedAttendance}</td>
                <td style={cell}>
                  <Lozenge appearance={BOOKING_REQUEST_APPEARANCE[item.status]}>{BOOKING_REQUEST_LABELS[item.status]}</Lozenge>
                  {item.differsFromEvent && (
                    <>
                      {" "}
                      <Lozenge appearance="inprogress">Differs from the event</Lozenge>
                    </>
                  )}
                  {item.status === "PENDING" && item.requiresReconfirmation && (
                    <>
                      {" "}
                      <Lozenge appearance="removed">Requires reconfirmation</Lozenge>
                    </>
                  )}
                  {item.status === "REJECTED" && item.rejectionReason && (
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      <div>Reason: {item.rejectionReason}</div>
                      {item.suggestedAlternative && <div>Suggested alternative: {item.suggestedAlternative}</div>}
                    </div>
                  )}
                  {item.replacesBookingId && (
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      Replaces {bookings.find((b) => b.id === item.replacesBookingId)?.reference ?? "a disrupted booking"}
                    </div>
                  )}
                </td>
                <td style={cell}>
                  {assigned && item.status === "PENDING" && (
                    <Button appearance="subtle" onClick={() => setWithdrawing(item)}>
                      Withdraw
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {bookings.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Bookings</h3>
          <table aria-label="Bookings" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {["Reference", "Venue", "Date and time", "Status", ""].map((heading, i) => (
                  <th key={i} style={cell}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const live = b.status !== "RELEASED";
                const replaceable = assigned && canRequest && b.status === "CONFIRMED" && b.requiresReconfirmation && b.disruptions.length > 0;
                return (
                  <tr key={b.id} aria-label={b.reference}>
                    <td style={cell}>{b.reference}</td>
                    <td style={cell}>{b.venueName}</td>
                    <td style={cell}>{formatPeriod(b.startsAt, b.endsAt)}</td>
                    <td style={cell}>
                      <Lozenge appearance={live ? "success" : "default"}>
                        {b.status === "RELEASED" && b.releaseReason ? `Released (${b.releaseReason})` : SLOT_LABELS[b.status]}
                      </Lozenge>
                      {live && b.requiresReconfirmation && (
                        <>
                          {" "}
                          <Lozenge appearance="removed">Requires reconfirmation</Lozenge>
                        </>
                      )}
                      {live &&
                        b.disruptions.map((d) => (
                          <div key={d.blockId} style={{ fontSize: 12, marginTop: 4 }}>
                            Unavailable: {UNAVAILABILITY_LABELS[d.reasonType] ?? d.reasonType}, “{d.description}”, {formatPeriod(d.startsAt, d.endsAt)}
                          </div>
                        ))}
                      {b.replacements.map((r) => (
                        <div key={r.id} style={{ fontSize: 12, marginTop: 4 }}>
                          Replacement {r.reference} at {r.venueName}: {BOOKING_REQUEST_LABELS[r.status]}
                        </div>
                      ))}
                    </td>
                    <td style={cell}>
                      {replaceable && (
                        <Button appearance="primary" onClick={() => navigate(replacementSearch(event.id, b))}>
                          Find a replacement
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <ModalTransition>
        {withdrawing && (
          <Modal onClose={() => setWithdrawing(null)}>
            <ModalHeader>
              <ModalTitle>Withdraw {withdrawing.reference}?</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p>
                The request for {withdrawing.venueName}, {formatPeriod(withdrawing.startsAt, withdrawing.endsAt)}, will be
                withdrawn. Venue Staff will no longer be asked to assess it. The record is kept, and this can't be undone.
              </p>
              {withdrawError ? <Refusal error={withdrawError} /> : null}
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setWithdrawing(null)}>
                Cancel
              </Button>
              <Button appearance="danger" isDisabled={busy} onClick={() => void confirmWithdraw()}>
                Withdraw request
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </div>
  );
}

const cell = { textAlign: "left" as const, padding: "6px 12px 6px 0", borderBottom: "1px solid #DFE1E6", verticalAlign: "top" as const };
