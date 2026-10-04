import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import DynamicTable from "@atlaskit/dynamic-table";
import { useSignedIn } from "../auth/SessionContext.js";
import { listVenues, type VenueListItem } from "../api/venues.js";
import { Refusal } from "../components/Refusal.js";

/**
 * H1, H2 — the venue catalogue, for every internal role. Only Venue Staff are
 * offered "New venue" and "Edit" (A2); the server refuses anyone else anyway.
 * Inactive venues stay listed here: they leave search results (J1, J2), not
 * the catalogue.
 */
export function VenueList() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const [items, setItems] = useState<VenueListItem[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const canMaintain = session.role === "VENUE_STAFF";

  useEffect(() => {
    listVenues(session.token)
      .then((page) => setItems(page.items))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [session.token]);

  const head = {
    cells: [
      { key: "name", content: "Name" },
      { key: "building", content: "Building / location" },
      { key: "capacity", content: "Maximum capacity" },
      { key: "status", content: "Status" },
      { key: "actions", content: "" },
    ],
  };

  const rows = items.map((venue) => ({
    key: venue.id,
    cells: [
      { key: "name", content: venue.name },
      { key: "building", content: venue.building },
      { key: "capacity", content: String(venue.maxCapacity) },
      {
        key: "status",
        content: <Lozenge appearance={venue.isActive ? "success" : "default"}>{venue.isActive ? "Active" : "Inactive"}</Lozenge>,
      },
      {
        key: "actions",
        content: canMaintain ? <Link to={`/venues/${venue.id}/edit`}>Edit</Link> : null,
      },
    ],
  }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <h2 style={{ margin: 0, flex: 1 }}>Venues</h2>
        {canMaintain && (
          <Button appearance="primary" onClick={() => navigate("/venues/new")}>
            New venue
          </Button>
        )}
      </div>
      <Refusal error={error} />
      <DynamicTable
        head={head}
        rows={rows}
        isLoading={loading}
        emptyView={<p>No venues are recorded yet.</p>}
      />
    </div>
  );
}
