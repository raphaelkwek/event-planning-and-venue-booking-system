import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "@atlaskit/button/new";
import DynamicTable from "@atlaskit/dynamic-table";
import Lozenge from "@atlaskit/lozenge";
import { listEquipmentTypes, type EquipmentTypeListItem } from "../api/equipment.js";
import { useSignedIn } from "../auth/SessionContext.js";
import { Refusal } from "../components/Refusal.js";

/** P2 — the inventory is a Technical Support Staff workspace, not a public catalogue. */
export function EquipmentList() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const [items, setItems] = useState<EquipmentTypeListItem[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listEquipmentTypes(session.token)
      .then((page) => setItems(page.items))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [session.token]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <h2 style={{ margin: 0, flex: 1 }}>Equipment inventory</h2>
        <Button appearance="primary" onClick={() => navigate("/equipment/new")}>New equipment type</Button>
      </div>
      <Refusal error={error} />
      <DynamicTable
        isLoading={loading}
        emptyView={<p>No equipment types are recorded yet.</p>}
        head={{ cells: [
          { key: "name", content: "Name" },
          { key: "description", content: "Description" },
          { key: "kind", content: "Tracking" },
          { key: "quantity", content: "Total held" },
          { key: "actions", content: "" },
        ] }}
        rows={items.map((item) => ({
          key: item.id,
          cells: [
            { key: "name", content: item.name },
            { key: "description", content: item.description || "—" },
            { key: "kind", content: <Lozenge>{item.kind === "BULK" ? "Bulk quantity" : "Individual units"}</Lozenge> },
            { key: "quantity", content: String(item.totalQuantity) },
            { key: "actions", content: <Link to={`/equipment/${item.id}/edit`}>Maintain</Link> },
          ],
        }))}
      />
    </div>
  );
}
