import SectionMessage from "@atlaskit/section-message";
import { ApiError } from "../api/client.js";

/**
 * implementation.md §7.1: a refusal renders as an inline section message
 * carrying the server's own message, never a generic toast. Field errors are
 * listed so that B2's "names every field that caused the rejection" is visible.
 */
/** The title of a refusal shown without its machine code: what kind of refusal it was, in words. */
function plainTitle(status: number): string {
  if (status === 400) return "Check the details";
  if (status === 401) return "Please sign in again";
  if (status === 403) return "Not allowed";
  if (status === 404) return "Not found";
  if (status === 409 || status === 422) return "That can't be done right now";
  if (status === 429) return "Too many requests";
  return "Something went wrong";
}

/**
 * `plain` titles the refusal in words and leaves the error code out, for screens whose users are not
 * the team: the server's own message still says what happened.
 */
export function Refusal({ error, plain = false }: { error: unknown; plain?: boolean }) {
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
    <SectionMessage appearance="error" title={plain ? plainTitle(error.status) : code}>
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
