import { useEffect, useState } from "react";
import Lozenge from "@atlaskit/lozenge";
import { useSignedIn } from "../auth/SessionContext.js";
import { listBookingQueue, type BookingDifference, type BookingRequest } from "../api/bookingRequests.js";
import { Refusal } from "../components/Refusal.js";
import { useUserNames } from "../shared/useUserNames.js";
import { formatInstant } from "../shared/status.js";
import { formatPeriod, formatTime } from "../shared/singaporeTime.js";

/**
 * L1 (and M1, which adds the decision): the pending booking requests for the
 * venues this Venue Staff member looks after, soonest first, with everything the
 * request records. A request that differs from its event shows each differing
 * value beside the event's.
 */

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
  const nameOf = useUserNames(session.token, items?.map((item) => item.requestedBy) ?? []);

  useEffect(() => {
    listBookingQueue(session.token)
      .then((result) => setItems(result.items))
      .catch(setError);
  }, [session.token]);

  if (error) return <Refusal error={error} />;
  if (!items) return <p>Loading…</p>;

  return (
    <div>
      <h2>Booking requests</h2>
      <p style={{ marginTop: 0, color: "#626F86" }}>Pending requests for the venues you look after. Times are Singapore time.</p>
      {items.length === 0 ? (
        <p>No booking request is waiting.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Reference", "Event", "Venue", "Date and time", "Layout", "Attendance", "Facilities", "Accessibility", "Requested", ""].map(
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const cell = { textAlign: "left" as const, padding: "6px 12px 6px 0", borderBottom: "1px solid #DFE1E6", verticalAlign: "top" as const };
