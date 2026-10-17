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
} from "../api/bookingRequests.js";
import { Refusal } from "../components/Refusal.js";
import { BOOKING_REQUEST_APPEARANCE, BOOKING_REQUEST_LABELS } from "../shared/status.js";
import { formatPeriod } from "../shared/singaporeTime.js";

/**
 * L1, L2, L4 — every venue request an event has made, each with its venue,
 * period, layout, attendance and status. Its assigned coordinator requests
 * another venue from here, and withdraws one that is still Pending. Anyone else
 * who may see the event sees the list only; the server applies the same rule.
 */
export function EventVenueRequests() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const notice = (useLocation().state as { notice?: string } | null)?.notice ?? null;
  const [event, setEvent] = useState<BookingEvent | null>(null);
  const [items, setItems] = useState<BookingRequest[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [withdrawing, setWithdrawing] = useState<BookingRequest | null>(null);
  const [withdrawError, setWithdrawError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const loaded = await listEventBookingRequests(session.token, id!);
      setEvent(loaded.event);
      setItems(loaded.items);
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
