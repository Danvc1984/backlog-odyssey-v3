import { describe, expect, it } from "vitest";
import {
  libraryCardMetadataView,
  wishlistCardMetadataView,
} from "./card-metadata-view";

const payload = {
  title: "Portal 2",
  description: "A puzzle game",
  backgroundImageUrls: ["https://example.com/portal-2.jpg"],
  genres: ["Puzzle"],
  developers: ["Valve"],
  releaseDate: "2011-04-18",
  rating: 4.6,
  metacriticScore: 95,
  playtimeHours: 9,
  esrbRating: { name: "Everyone 10+" },
};

describe("card metadata views", () => {
  it("projects the wishlist image and description", () => {
    expect(wishlistCardMetadataView(payload)).toEqual({
      imageUrl: "https://example.com/portal-2.jpg",
      description: "A puzzle game",
    });
  });

  it("projects the library cover and card metadata", () => {
    expect(libraryCardMetadataView(payload)).toEqual({
      imageUrl: "https://example.com/portal-2.jpg",
      genres: ["Puzzle"],
      description: "A puzzle game",
      developers: ["Valve"],
      releaseDate: "2011-04-18",
      rating: 4.6,
      metacriticScore: 95,
      playtimeHours: 9,
      esrbName: "Everyone 10+",
    });
  });

  it("returns null for invalid payloads", () => {
    expect(wishlistCardMetadataView(null)).toBeNull();
    expect(libraryCardMetadataView({ title: "Missing genres" })).toBeNull();
  });
});
