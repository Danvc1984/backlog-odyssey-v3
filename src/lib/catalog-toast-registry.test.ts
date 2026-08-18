import { describe, expect, it } from "vitest";
import {
  CatalogToastRegistry,
  catalogToastId,
} from "./catalog-toast-registry";

describe("catalog toast registry", () => {
  it("creates stable IDs for each notification kind and operation", () => {
    expect(catalogToastId("action", "merge-1")).toBe("catalog-action-merge-1");
    expect(catalogToastId("undo", "merge-1")).toBe("catalog-undo-merge-1");
  });

  it("suppresses duplicate action notifications for one operation", () => {
    const registry = new CatalogToastRegistry();

    expect(registry.claim("action", "merge-1")).toBe(true);
    expect(registry.claim("action", "merge-1")).toBe(false);
  });

  it("suppresses duplicate Undo notifications during watcher hydration", () => {
    const registry = new CatalogToastRegistry();

    expect(registry.claim("undo", "delete-1")).toBe(true);
    expect(registry.claim("undo", "delete-1")).toBe(false);
  });

  it("keeps merge and delete operation notifications independent", () => {
    const registry = new CatalogToastRegistry();

    expect(registry.claim("action", "merge-1")).toBe(true);
    expect(registry.claim("action", "delete-1")).toBe(true);
    expect(registry.claim("undo", "merge-1")).toBe(true);
    expect(registry.claim("undo", "delete-1")).toBe(true);
  });

  it("releases an expired Undo notification without affecting its action result", () => {
    const registry = new CatalogToastRegistry();
    registry.claim("action", "delete-1");
    registry.claim("undo", "delete-1");

    registry.release("undo", "delete-1");

    expect(registry.has("action", "delete-1")).toBe(true);
    expect(registry.has("undo", "delete-1")).toBe(false);
    expect(registry.claim("undo", "delete-1")).toBe(true);
  });

  it("releases the Undo notification before the final Undo result reuses the action slot", () => {
    const registry = new CatalogToastRegistry();
    registry.claim("action", "merge-1");
    registry.claim("undo", "merge-1");

    registry.release("undo", "merge-1");

    expect(registry.has("action", "merge-1")).toBe(true);
    expect(registry.has("undo", "merge-1")).toBe(false);
  });
});
