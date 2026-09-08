import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FALLBACK_SOURCE_ICON } from "@/lib/sources/known-sources";
import { SourceIcon } from "./SourceIcon";

describe("SourceIcon", () => {
  it("keeps the local brand SVG branch for branded sources", () => {
    const markup = renderToStaticMarkup(
      createElement(SourceIcon, { iconName: "Sparkles", brandIcon: "steam.svg" }),
    );
    expect(markup).toContain("data-brand-icon");
    expect(markup).toContain("steam.svg");
    expect(markup).toContain("source-brand-icon");
    expect(markup).not.toContain("<svg");
  });

  it("resolves a known legacy key to a Phosphor render", () => {
    const markup = renderToStaticMarkup(createElement(SourceIcon, { iconName: "Sparkles" }));
    expect(markup).toContain("<svg");
    expect(markup).toContain("text-muted-foreground");
  });

  it("falls back to the neutral icon for unknown keys without throwing", () => {
    const markup = renderToStaticMarkup(createElement(SourceIcon, { iconName: "Swords-Undefined-Key" }));
    expect(markup).toContain("<svg");
  });

  it("renders the fallback and Disc3 with the signal color", () => {
    const fallback = renderToStaticMarkup(createElement(SourceIcon, { iconName: FALLBACK_SOURCE_ICON }));
    const disc = renderToStaticMarkup(createElement(SourceIcon, { iconName: "Disc3" }));
    expect(fallback).toContain("text-signal-strong");
    expect(disc).toContain("text-signal-strong");
  });
});