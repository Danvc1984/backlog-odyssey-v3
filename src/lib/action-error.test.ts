import { describe, expect, it, vi } from "vitest";

import { ActionError, friendlyActionError } from "./action-error";

describe("friendlyActionError", () => {
  it("passes through an ActionError message", () => {
    const error = new ActionError("The game is not eligible");

    expect(friendlyActionError(error, "Something went wrong")).toBe(
      "The game is not eligible",
    );
  });

  it("returns the fallback and logs unexpected errors", () => {
    const error = new Error("database details");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(friendlyActionError(error, "Could not update the game")).toBe(
      "Could not update the game",
    );
    expect(consoleError).toHaveBeenCalledWith("Could not update the game", error);

    consoleError.mockRestore();
  });

  it("handles non-Error thrown values through the fallback", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(friendlyActionError("unexpected", "Could not complete the action")).toBe(
      "Could not complete the action",
    );
    expect(consoleError).toHaveBeenCalledWith("Could not complete the action", "unexpected");

    consoleError.mockRestore();
  });
});
