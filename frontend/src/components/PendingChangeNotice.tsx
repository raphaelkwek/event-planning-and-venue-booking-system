import SectionMessage from "@atlaskit/section-message";
import type { ChangeRequest } from "../api/changeRequests.js";
import { SIGNIFICANT_FIELD_LABELS } from "../shared/changeRequests.js";

/** S1 — shown to the organiser and the coordinator while a change request is pending. */
export function PendingChangeNotice({ request }: { request: ChangeRequest }) {
  const fields = request.fields.map((field) => SIGNIFICANT_FIELD_LABELS[field.fieldName]).join(", ");
  return (
    <div style={{ marginBottom: 16 }}>
      <SectionMessage appearance="information" title="A change is pending">
        <p style={{ margin: 0 }}>
          Change requested on {new Date(request.requestedAt).toLocaleDateString()}: {fields} (Pending)
        </p>
        <p style={{ marginBottom: 0, fontSize: 12 }}>Reason: {request.reason}</p>
      </SectionMessage>
    </div>
  );
}
