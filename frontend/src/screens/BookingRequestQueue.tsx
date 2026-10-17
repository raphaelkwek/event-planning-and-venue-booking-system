import { useCallback, useEffect, useState } from "react";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import SectionMessage from "@atlaskit/section-message";
import TextArea from "@atlaskit/textarea";
import Textfield from "@atlaskit/textfield";
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import { useSignedIn } from "../auth/SessionContext.js";
import {
  approveBookingRequest,
  listBookingQueue,
  rejectBookingRequest,
  type BookingDifference,
  type BookingRequest,
} from "../api/bookingRequests.js";
import { ApiError } from "../api/client.js";
import { Refusal } from "../components/Refusal.js";
import { useUserNames } from "../shared/useUserNames.js";
import { formatInstant } from "../shared/status.js";
import { formatPeriod, formatTime } from "../shared/singaporeTime.js";

/**
 * L1, M1, M2: the pending booking requests for the venues this Venue Staff
 * member looks after, soonest first, with everything the request records. A
 * request that differs from its event shows each differing value beside the
 * event's. Each can be approved, which confirms the booking (M1), or rejected
 * with a reason and any suggested alternative (M2). A refused decision is shown
 * in its dialog, and the request stays in the queue.
 */

const REASON_REQUIRED = "Enter the reason for rejecting the request.";

function difference(d: BookingDifference): string {
  switch (d.field) {
    case "startsAt":
      return `Start ${formatTime(d.requested)} (event ${formatTime(d.event)})`;
    case "endsAt":
      return `End ${formatTime(d.requested)} (event ${formatTime(d.event)})`;
    case "expectedAttendance":
      return `Attendance ${d.requested} (event ${d.event})`;
  }
}

export function BookingRequestQueue() {
  const session = useSignedIn();
  const [items, setItems] = useState<BookingRequest[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approving, setApproving] = useState<BookingRequest | null>(null);
  const [rejecting, setRejecting] = useState<BookingRequest | null>(null);
  const [reason, setReason] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);
  const [decisionError, setDecisionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const nameOf = useUserNames(session.token, items?.map((item) => item.requestedBy) ?? []);

  const load = useCallback(async () => {
    try {
      setItems((await listBookingQueue(session.token)).items);
    } catch (caught) {
      setError(caught);
    }
  }, [session.token]);

  useEffect(() => {
    void load();
  }, [load]);

  function startApproving(item: BookingRequest) {
    setDecisionError(null);
    setApproving(item);
  }

  function startRejecting(item: BookingRequest) {
    setDecisionError(null);
    setReasonMissing(false);
    setReason("");
    setSuggestion("");
    setRejecting(item);
  }

  async function decide(send: () => Promise<unknown>, done: string) {
    setBusy(true);
    setDecisionError(null);
    try {
      await send();
      setNotice(done);
      setApproving(null);
      setRejecting(null);
      await load();
    } catch (caught) {
      setDecisionError(caught);
    } finally {
      setBusy(false);
    }
  }

  function confirmRejection(item: BookingRequest) {
    if (reason.trim() === "") {
      setReasonMissing(true);
      return;
    }
    setReasonMissing(false);
    void decide(
      () => rejectBookingRequest(session.token, item.id, { reason: reason.trim(), suggestion: suggestion.trim() || null }),
      `${item.reference} rejected.`,
    );
  }

  if (error) return <Refusal error={error} />;
  if (!items) return <p>Loading…</p>;

  const reasonMessage = reasonMissing
    ? REASON_REQUIRED
    : decisionError instanceof ApiError
      ? decisionError.fieldMessage("reason")
      : undefined;

  return (
    <div>
      <h2>Booking requests</h2>
      <p style={{ marginTop: 0, color: "#626F86" }}>Pending requests for the venues you look after. Times are Singapore time.</p>
      {notice && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage appearance="success">
            <p style={{ margin: 0 }}>{notice}</p>
          </SectionMessage>
        </div>
      )}
      {items.length === 0 ? (
        <p>No booking request is waiting.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Reference", "Event", "Venue", "Date and time", "Layout", "Attendance", "Facilities", "Accessibility", "Requested", "", ""].map(
                (heading, i) => (
                  <th key={i} style={cell}>
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} aria-label={item.reference}>
                <td style={cell}>{item.reference}</td>
                <td style={cell}>{item.eventReference ?? "—"}</td>
                <td style={cell}>{item.venueName}</td>
                <td style={cell}>{formatPeriod(item.startsAt, item.endsAt)}</td>
                <td style={cell}>{item.layout}</td>
                <td style={cell}>{item.expectedAttendance} attending</td>
                <td style={cell}>{item.facilities.length > 0 ? item.facilities.join(", ") : "—"}</td>
                <td style={cell}>{item.accessibilityFeatures.length > 0 ? item.accessibilityFeatures.join(", ") : "—"}</td>
                <td style={cell}>
                  {nameOf(item.requestedBy) ?? item.requestedBy}
                  <div style={{ fontSize: 12, color: "#626F86" }}>{formatInstant(item.requestedAt)}</div>
                </td>
                <td style={cell}>
                  {item.differsFromEvent && (
                    <>
                      <Lozenge appearance="inprogress">Differs from the event</Lozenge>
                      <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 12 }}>
                        {item.differences.map((d) => (
                          <li key={d.field}>{difference(d)}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </td>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>
                  <Button appearance="primary" onClick={() => startApproving(item)}>
                    Approve
                  </Button>{" "}
                  <Button appearance="subtle" onClick={() => startRejecting(item)}>
                    Reject
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ModalTransition>
        {approving && (
          <Modal onClose={() => setApproving(null)}>
            <ModalHeader>
              <ModalTitle>Approve {approving.reference}?</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p>
                The booking for {approving.venueName}, {formatPeriod(approving.startsAt, approving.endsAt)}, will be confirmed, and
                the coordinator and the event's organiser will be told. It is refused if the period now overlaps another booking or
                recorded unavailability.
              </p>
              <Refusal error={decisionError} />
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setApproving(null)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                isDisabled={busy}
                onClick={() =>
                  void decide(() => approveBookingRequest(session.token, approving.id), `${approving.reference} approved. The booking is confirmed.`)
                }
              >
                Approve request
              </Button>
            </ModalFooter>
          </Modal>
        )}

        {rejecting && (
          <Modal onClose={() => setRejecting(null)}>
            <ModalHeader>
              <ModalTitle appearance="warning">Reject {rejecting.reference}?</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p>
                The request for {rejecting.venueName}, {formatPeriod(rejecting.startsAt, rejecting.endsAt)}, will be rejected. The
                coordinator and the event's organiser will see the reason and any alternative you suggest. The venue stays free.
              </p>
              <div style={{ marginBottom: 12 }}>
                <Refusal error={decisionError} />
              </div>
              <label htmlFor="rejection-reason" style={label}>
                Reason
              </label>
              <TextArea
                id="rejection-reason"
                value={reason}
                minimumRows={3}
                isInvalid={Boolean(reasonMessage)}
                onChange={(e) => setReason((e.target as HTMLTextAreaElement).value)}
              />
              {reasonMessage && <div style={{ color: "#AE2E24", fontSize: 12, marginTop: 4 }}>{reasonMessage}</div>}
              <label htmlFor="rejection-suggestion" style={{ ...label, marginTop: 12 }}>
                Suggested alternative (optional)
              </label>
              <Textfield
                id="rejection-suggestion"
                value={suggestion}
                placeholder="Other dates, times or venues"
                onChange={(e) => setSuggestion((e.target as HTMLInputElement).value)}
              />
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setRejecting(null)}>
                Cancel
              </Button>
              <Button appearance="warning" isDisabled={busy} onClick={() => confirmRejection(rejecting)}>
                Reject request
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </div>
  );
}

const cell = { textAlign: "left" as const, padding: "6px 12px 6px 0", borderBottom: "1px solid #DFE1E6", verticalAlign: "top" as const };
const label = { display: "block", fontWeight: 600, fontSize: 12, marginBottom: 4 };
