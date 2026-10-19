import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

/**
 * The equipment module's view of the caller (A2, A3), resolved through the identity
 * module's public interface instead of over HTTP (ADR-0004). These pin the
 * refusals the old HTTP client produced, so the move changed no behaviour.
 */

vi.mock("../../../src/modules/identity/index.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/identity/index.js")>(
    "../../../src/modules/identity/index.js"
  );
  return { ...actual, lookUpCaller: vi.fn() };
});

const { lookUpCaller } = await import("../../../src/modules/identity/index.js");
const { resolveCurrentUser, IdentityRefusedError, IdentityUnavailableError } =
  await import("../../../src/modules/equipment/auth/identity.js");

const USER = { id: "f1f1f1f1-0000-0000-0000-0000000000a1", email: "someone@connectsphere.test" };

afterEach(() => {
  vi.mocked(lookUpCaller).mockReset();
});

describe("resolveCurrentUser", () => {
  it("returns the caller when identity finds them", async () => {
    vi.mocked(lookUpCaller).mockResolvedValue({ outcome: "FOUND", user: { ...USER, role: "EVENT_ORGANISER" } });

    await expect(resolveCurrentUser("subject")).resolves.toEqual({ ...USER, role: "EVENT_ORGANISER" });
  });

  it("refuses with 401 UNAUTHENTICATED when there is no active user", async () => {
    vi.mocked(lookUpCaller).mockResolvedValue({ outcome: "NO_ACTIVE_USER" });

    const error = await resolveCurrentUser("subject").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IdentityRefusedError);
    expect(error).toMatchObject({ status: 401, code: "UNAUTHENTICATED", message: "No active session for this token." });
  });

  it("refuses with 403 NO_ROLE_ASSIGNED when the user has no role", async () => {
    vi.mocked(lookUpCaller).mockResolvedValue({ outcome: "NO_ROLE" });

    const error = await resolveCurrentUser("subject").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IdentityRefusedError);
    expect(error).toMatchObject({ name: "IdentityRefusedError", status: 403, code: "NO_ROLE_ASSIGNED", message: "This user has no assigned role." });
  });

  it("reports identity as unavailable when its records cannot be read (CP: refuse, never guess)", async () => {
    vi.mocked(lookUpCaller).mockRejectedValue(new Error("connect ETIMEDOUT"));

    const error = await resolveCurrentUser("subject").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(IdentityUnavailableError);
    expect(error).toMatchObject({ name: "IdentityUnavailableError", message: "Identity records could not be read: connect ETIMEDOUT" });
  });

  it("lets a malformed identity record surface as a defect rather than an outage", async () => {
    const malformed = z.object({ email: z.string().email() }).safeParse({ email: "not-an-email" });
    vi.mocked(lookUpCaller).mockRejectedValue(malformed.success ? new Error("unreachable") : malformed.error);

    await expect(resolveCurrentUser("subject")).rejects.toBeInstanceOf(z.ZodError);
  });
});
