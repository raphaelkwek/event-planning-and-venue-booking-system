import Button from "@atlaskit/button/new";
import SectionMessage from "@atlaskit/section-message";
import { ApiError } from "../api/client.js";

/**
 * D10 (staging dry run, 4 Nov 2026): a list that could not be loaded says so once, in plain words,
 * with a way to try again, and the screen shows it in place of the list, so an empty list never
 * appears beside the error as if there were nothing to show.
 */
export function LoadFailure({ error, what, onRetry }: { error: unknown; what: string; onRetry: () => void }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <SectionMessage appearance="error" title={`${what} couldn't be loaded`}>
        <p>{messageOf(error)}</p>
        <Button onClick={onRetry}>Try again</Button>
      </SectionMessage>
    </div>
  );
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.envelope.message;
  return error instanceof Error ? error.message : String(error);
}
