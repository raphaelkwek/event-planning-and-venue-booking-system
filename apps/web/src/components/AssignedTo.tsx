import Lozenge from "@atlaskit/lozenge";

/**
 * A3 — who an event is assigned to, with the signed-in coordinator's own
 * assignments marked so they stand out from the rest.
 */
export function AssignedTo({
  coordinatorId,
  currentUserId,
  nameOf,
}: {
  coordinatorId: string | null;
  currentUserId: string;
  nameOf: (id: string | null | undefined) => string | null;
}) {
  if (!coordinatorId) return <span>Awaiting assignment</span>;
  if (coordinatorId === currentUserId) return <Lozenge appearance="new">You</Lozenge>;
  return <span>{nameOf(coordinatorId)}</span>;
}
