import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import { useSignedIn } from "../auth/SessionContext.js";
import { DAY_LABELS, DAYS, getVenue, type Venue } from "../api/venues.js";
import { Refusal } from "../components/Refusal.js";

/**
 * H2 — everything recorded about a venue, read from the catalogue, so a
 * coordinator can judge it against an event's requirements. Accessibility
 * features are listed one by one (AC2), each layout with its own capacity
 * (AC3), and opening hours day by day (AC4). Attendees never reach this
 * screen (AC5): App.tsx gives it no route for them, and the API refuses them.
 */
export function VenueDetail() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const { id } = useParams();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    getVenue(session.token, id!).then(setVenue).catch(setError);
  }, [session.token, id]);

  if (error) {
    return (
      <div style={{ maxWidth: 760 }}>
        <Refusal error={error} />
        <p>
          <Button appearance="subtle" onClick={() => navigate("/venues")}>
            Back to venues
          </Button>
        </p>
      </div>
    );
  }
  if (!venue) return <p>Loading…</p>;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <h2 style={{ flex: 1 }}>{venue.name}</h2>
        <Button onClick={() => navigate(`/venues/${venue.id}/availability`)}>Availability</Button>
        {session.role === "VENUE_STAFF" && (
          <Button appearance="primary" onClick={() => navigate(`/venues/${venue.id}/edit`)}>
            Edit venue
          </Button>
        )}
      </div>

      <Section id="summary" title="Summary">
        <dl style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "6px 16px", margin: 0 }}>
          <dt>Building / location</dt>
          <dd style={{ margin: 0 }}>{venue.building}</dd>
          <dt>Maximum capacity</dt>
          <dd style={{ margin: 0 }}>{venue.maxCapacity}</dd>
          <dt>Status</dt>
          <dd style={{ margin: 0 }}>
            <Lozenge appearance={venue.isActive ? "success" : "default"}>{venue.isActive ? "Active" : "Inactive"}</Lozenge>
          </dd>
        </dl>
      </Section>

      <Section id="layouts" title="Layouts">
        <table style={{ borderCollapse: "collapse", minWidth: 320 }}>
          <thead>
            <tr>
              <th style={cell}>Layout</th>
              <th style={cell}>Capacity</th>
            </tr>
          </thead>
          <tbody>
            {venue.layouts.map((layout) => (
              <tr key={layout.name}>
                <td style={cell}>{layout.name}</td>
                <td style={cell}>{layout.capacity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="facilities" title="Facilities">
        <List items={venue.facilities} empty="No facilities are recorded." />
      </Section>

      <Section id="accessibility" title="Accessibility features">
        <List items={venue.accessibilityFeatures} empty="No accessibility features are recorded." />
      </Section>

      <Section id="hours" title="Operating hours">
        <table style={{ borderCollapse: "collapse", minWidth: 320 }}>
          <thead>
            <tr>
              <th style={cell}>Day</th>
              <th style={cell}>Hours</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => {
              const hours = venue.operatingHours[day];
              return (
                <tr key={day}>
                  <td style={cell}>{DAY_LABELS[day]}</td>
                  <td style={cell}>{hours ? `${hours.opensAt}–${hours.closesAt}` : "Closed"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <p>
        <Button appearance="subtle" onClick={() => navigate("/venues")}>
          Back to venues
        </Button>
      </p>
    </div>
  );
}

const cell = { textAlign: "left" as const, padding: "4px 16px 4px 0", borderBottom: "1px solid #DFE1E6" };

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`venue-${id}`} style={{ margin: "16px 0" }}>
      <h3 id={`venue-${id}`} style={{ fontSize: 14, marginBottom: 8 }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p style={{ margin: 0 }}>{empty}</p>;
  return (
    <ul style={{ margin: 0 }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
