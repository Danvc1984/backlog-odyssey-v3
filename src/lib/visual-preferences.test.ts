import { describe, expect, it, vi } from "vitest";
import {
  DATA_STORAGE_KEY,
  FAMILY_ATTRIBUTE,
  FAMILY_STORAGE_KEY,
  MOTION_ATTRIBUTE,
  MOTION_STORAGE_KEY,
  REDUCED_DATA_ATTRIBUTE,
  applyVisualAttributes,
  normalizeData,
  normalizeFamily,
  normalizeMotion,
  resolveVisualPreferences,
} from "./visual-preferences";

describe("normalizeMotion", () => {
  it("passes accepted values through", () => {
    expect(normalizeMotion("reduced")).toBe("reduced");
    expect(normalizeMotion("full")).toBe("full");
  });

  it("falls back to system for invalid or missing values", () => {
    for (const raw of [null, undefined, "", "garbage", "on", " true ", 42, {}]) {
      expect(normalizeMotion(raw)).toBe("system");
    }
  });
});

describe("normalizeData", () => {
  it("passes accepted values through", () => {
    expect(normalizeData("on")).toBe("on");
    expect(normalizeData("off")).toBe("off");
  });

  it("falls back to system for invalid or missing values", () => {
    for (const raw of [null, undefined, "", "true", "reduced", 0, []]) {
      expect(normalizeData(raw)).toBe("system");
    }
  });
});

describe("normalizeFamily", () => {
  it("passes sunset through", () => {
    expect(normalizeFamily("sunset")).toBe("sunset");
  });

  it("falls back to dawn for invalid or missing values", () => {
    for (const raw of [null, undefined, "", "dawn", "system", "garbage", 42, {}]) {
      expect(normalizeFamily(raw)).toBe("dawn");
    }
  });
});

describe("resolveVisualPreferences", () => {
  it("manual overrides win over system flags", () => {
    expect(
      resolveVisualPreferences("full", "off", { reducedMotion: true, reducedData: true }),
    ).toEqual({ motion: "full", data: "off" });
  });

  it("system settings follow the media query flags", () => {
    expect(
      resolveVisualPreferences("system", "system", { reducedMotion: true, reducedData: false }),
    ).toEqual({ motion: "reduced", data: "off" });
    expect(
      resolveVisualPreferences("system", "system", { reducedMotion: false, reducedData: true }),
    ).toEqual({ motion: "full", data: "on" });
  });

  it("resolves each field independently of the others", () => {
    expect(
      resolveVisualPreferences("reduced", "system", { reducedMotion: false, reducedData: false }),
    ).toEqual({ motion: "reduced", data: "off" });
    expect(
      resolveVisualPreferences("system", "on", { reducedMotion: false, reducedData: true }),
    ).toEqual({ motion: "full", data: "on" });
  });
});

describe("applyVisualAttributes", () => {
  it("sets the motion attribute for manual overrides", () => {
    const el = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
    applyVisualAttributes(el, "reduced", "system", "dawn");
    expect(el.setAttribute).toHaveBeenCalledWith(MOTION_ATTRIBUTE, "reduced");
    expect(el.removeAttribute).toHaveBeenCalledWith(REDUCED_DATA_ATTRIBUTE);
  });

  it("sets the data attribute for manual overrides", () => {
    const el = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
    applyVisualAttributes(el, "system", "on", "dawn");
    expect(el.removeAttribute).toHaveBeenCalledWith(MOTION_ATTRIBUTE);
    expect(el.setAttribute).toHaveBeenCalledWith(REDUCED_DATA_ATTRIBUTE, "on");
  });

  it("removes both attributes when both settings are system", () => {
    const el = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
    applyVisualAttributes(el, "system", "system", "dawn");
    expect(el.removeAttribute).toHaveBeenCalledWith(MOTION_ATTRIBUTE);
    expect(el.removeAttribute).toHaveBeenCalledWith(REDUCED_DATA_ATTRIBUTE);
    expect(el.setAttribute).not.toHaveBeenCalled();
  });

  it("applies both overrides at once", () => {
    const el = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
    applyVisualAttributes(el, "full", "off", "dawn");
    expect(el.setAttribute).toHaveBeenCalledWith(MOTION_ATTRIBUTE, "full");
    expect(el.setAttribute).toHaveBeenCalledWith(REDUCED_DATA_ATTRIBUTE, "off");
  });

  it("sets the family attribute for sunset", () => {
    const el = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
    applyVisualAttributes(el, "system", "system", "sunset");
    expect(el.setAttribute).toHaveBeenCalledWith(FAMILY_ATTRIBUTE, "sunset");
  });

  it("removes the family attribute for dawn", () => {
    const el = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
    applyVisualAttributes(el, "system", "system", "dawn");
    expect(el.removeAttribute).toHaveBeenCalledWith(FAMILY_ATTRIBUTE);
  });

  it("applies motion, data, and family at once", () => {
    const el = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
    applyVisualAttributes(el, "reduced", "off", "sunset");
    expect(el.setAttribute).toHaveBeenCalledWith(MOTION_ATTRIBUTE, "reduced");
    expect(el.setAttribute).toHaveBeenCalledWith(REDUCED_DATA_ATTRIBUTE, "off");
    expect(el.setAttribute).toHaveBeenCalledWith(FAMILY_ATTRIBUTE, "sunset");
  });
});

describe("storage key contract", () => {
  it("uses the documented localStorage keys", () => {
    expect(MOTION_STORAGE_KEY).toBe("backlog-odyssey:motion");
    expect(DATA_STORAGE_KEY).toBe("backlog-odyssey:data");
    expect(FAMILY_STORAGE_KEY).toBe("backlog-odyssey:family");
  });
});