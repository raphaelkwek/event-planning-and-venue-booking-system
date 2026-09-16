import SectionMessage from "@atlaskit/section-message";
import { ApiError } from "../api/client.js";

/**
 * implementation.md §7.1: a refusal renders as an inline section message
 * carrying the server's own message, never a generic toast. Field errors are
 * listed so that B2's "names every field that caused the rejection" is visible.
 */
export function Refusal({ error }: { error: unknown }) {
  if (!error) return null;

  if (!(error instanceof ApiError)) {
    return (
      <SectionMessage appearance="error" title="Something went wrong">
        <p>{error instanceof Error ? error.message : String(error)}</p>
      </SectionMessage>
    );
  }

  const { code, message, fields, correlationId } = error.envelope;

  return (
    <SectionMessage appearance="error" title={code}>
      <p>{message}</p>
      {fields && fields.length > 0 && (
        <ul>
          {fields.map((field) => (
            <li key={field.field}>
              <strong>{field.field}</strong>: {field.message}
            </li>
          ))}
        </ul>
      )}
      <p style={{ fontSize: 11, opacity: 0.7 }}>
        HTTP {error.status}
        {correlationId ? ` · correlation ${correlationId}` : ""}
      </p>
    </SectionMessage>
  );
}
