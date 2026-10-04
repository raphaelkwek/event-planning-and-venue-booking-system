import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

/**
 * H1 — the venue editor as Venue Staff use it: typing into every kind of
 * field, and a refusal shown under the field that caused it.
 */

vi.mock("../src/api/venues.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/venues.js")>("../src/api/venues.js");
  return {
    ...actual,
    createVenue: vi.fn(async () => {
      throw new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "The venue could not be saved. Check the highlighted fields.",
        fields: [{ field: "maxCapacity", message: "Maximum capacity must be a whole number greater than zero." }],
        correlationId: null,
      });
    }),
  };
});

const { App } = await import("../src/App.js");
const { createVenue } = await import("../src/api/venues.js");

beforeEach(() => {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({
      userId: "venue-staff-id",
      email: "venuestaff@connectsphere.test",
      role: "VENUE_STAFF",
      token: "token",
      lastLoginAt: "2026-10-04T01:00:00.000Z",
    }),
  );
  window.location.hash = "#/venues/new";
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });

describe("the venue editor", () => {
  it("keeps what is typed into text, number, list and time fields", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "New venue" });

    type("Name", "Lee Kong Chian Auditorium");
    type("Maximum capacity", "300");
    type("Layout 1", "Theatre");
    type("Facilities (one per line)", "Projector\nStage lighting");
    type("Monday opens", "09:00");

    expect((screen.getByLabelText("Name", { exact: true }) as HTMLInputElement).value).toBe("Lee Kong Chian Auditorium");
    expect((screen.getByLabelText("Maximum capacity") as HTMLInputElement).value).toBe("300");
    expect((screen.getByLabelText("Layout 1", { exact: true }) as HTMLInputElement).value).toBe("Theatre");
    expect((screen.getByLabelText("Facilities (one per line)") as HTMLTextAreaElement).value).toBe("Projector\nStage lighting");
    expect((screen.getByLabelText("Monday opens") as HTMLInputElement).value).toBe("09:00");
  });

  it("adds and removes layout rows", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "New venue" });
    fireEvent.click(screen.getByRole("button", { name: "Add layout" }));
    expect(screen.getByLabelText("Layout 2", { exact: true })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    expect(screen.queryByLabelText("Layout 1", { exact: true })).toBeNull();
  });

  it("shows a refusal's message under the field that caused it", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "New venue" });
    type("Maximum capacity", "0");
    fireEvent.click(screen.getByRole("button", { name: "Save venue" }));

    await waitFor(() => expect(createVenue).toHaveBeenCalled());
    const message = await screen.findByText("Maximum capacity must be a whole number greater than zero.");
    // Under the field: in the same block as the field's own label.
    expect(message.parentElement!.querySelector("label")!.textContent).toBe("Maximum capacity");
  });
});
