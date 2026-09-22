"use client";

import { useEffect, useState } from "react";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";
import { SourceIcon } from "@/components/sources/SourceIcon";
import { DetailHeroArt } from "@/components/ui/detail-hero-art";
import { advanceIndex, shouldAutoAdvance } from "@/lib/carousel";

interface DemoGame {
  id: string;
  name: string;
  coverUrl: string;
  entryMethod: "Added manually" | "Imported from Steam" | "Added to wishlist";
  tracking: readonly string[];
  genres: readonly string[];
  personalTags: readonly string[];
  compatibility?: string;
  recommendationLabel: "Play next" | "Buy next";
  recommendationReason: string;
  deal?: string;
}

const DEMO_GAMES: readonly DemoGame[] = [
  {
    id: "half-life-2",
    name: "Half-Life 2",
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_720p/ar6kbi.jpg",
    entryMethod: "Imported from Steam",
    tracking: ["Interest 4/5", "High priority"],
    genres: ["Shooter", "Science fiction"],
    personalTags: ["Classics"],
    compatibility: "ProtonDB tier: Platinum",
    recommendationLabel: "Play next",
    recommendationReason:
      "Your high priority and Platinum ProtonDB tier make it a strong choice for Linux.",
  },
  {
    id: "cult-of-the-lamb",
    name: "Cult of the Lamb",
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_720p/ar4qv9.jpg",
    entryMethod: "Added manually",
    tracking: [
      "Interest 5/5",
      "Handheld suitable",
      "Game experience: On the go",
    ],
    genres: ["Roguelite", "Management"],
    personalTags: ["Steam Deck"],
    recommendationLabel: "Play next",
    recommendationReason:
      "You marked it handheld suitable, and its roguelite runs fit an on-the-go session.",
  },
  {
    id: "elden-ring",
    name: "Elden Ring",
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_720p/ar1481.jpg",
    entryMethod: "Imported from Steam",
    tracking: ["Interest 5/5", "High priority", "Play soon"],
    genres: ["Action RPG", "Open world"],
    personalTags: ["Long adventures"],
    recommendationLabel: "Play next",
    recommendationReason:
      "Your Play soon marker and high interest put this open-world adventure near the top.",
  },
  {
    id: "grand-theft-auto-v",
    name: "Grand Theft Auto V",
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_720p/ar6d9j.jpg",
    entryMethod: "Added manually",
    tracking: ["Interest 3/5", "Game experience: Multiplayer & co-op"],
    genres: ["Action-adventure", "Open world"],
    personalTags: ["Friends"],
    recommendationLabel: "Play next",
    recommendationReason:
      "Your multiplayer preference and Friends tag point to a session you can share.",
  },
  {
    id: "nier-automata",
    name: "NieR:Automata",
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_screenshot_big/m5ytymipeljiatfrblhs.jpg",
    entryMethod: "Added to wishlist",
    tracking: [
      "Interest 5/5",
      "Game experience: PC gaming",
      "Target Discount: 60%",
    ],
    genres: ["Action RPG", "Science fiction"],
    personalTags: [],
    recommendationLabel: "Buy next",
    deal: "Wishlist deal: 60% off",
    recommendationReason:
      "Backlog Odyssey can also recommend purchases based on your wishlist and current deals from ITAD.",
  },
];

const AUTO_ADVANCE_MS = 6_000;

function SignInDemoGameCard({ game }: { game: DemoGame }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [game.id]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return (
    <div className="mt-3 rounded-xl border border-primary/35 bg-primary/10 p-3">
      <DetailHeroArt
        id={game.id}
        title={`${game.recommendationLabel}: ${game.name}`}
        imageUrl={hasMounted && !imageFailed ? game.coverUrl : null}
        className="h-24 rounded-lg sm:h-32 lg:h-40"
        labelClassName="text-sm sm:text-base"
        fit="cover"
        artworkClassName="lg:object-contain"
        onImageError={() => setImageFailed(true)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {game.genres.map((genre) => (
          <span
            key={genre}
            className="rounded-full border border-primary/25 bg-card px-2 py-1 text-xs font-medium text-foreground"
          >
            {genre}
          </span>
        ))}
        {game.personalTags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-opportunity/25 bg-opportunity/10 px-2 py-1 text-xs font-medium text-opportunity-text"
          >
            {tag}
          </span>
        ))}
        {game.compatibility ? (
          <span className="rounded-full border border-signal/30 bg-signal/10 px-2 py-1 text-xs font-medium text-signal">
            {game.compatibility}
          </span>
        ) : null}
        {game.deal ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-opportunity/25 bg-opportunity/10 px-2 py-1 text-xs font-medium text-opportunity-text">
            <SourceIcon iconName="TagIcon" brandIcon="itad.svg" />
            {game.deal}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">
        {game.recommendationReason}
      </p>
    </div>
  );
}

export function SignInIntroductionDemo() {
  const { resolvedMotion } = useVisualPreferences();
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const activeGame = DEMO_GAMES[index];

  useEffect(() => {
    if (!shouldAutoAdvance(DEMO_GAMES.length, resolvedMotion, isPaused)) return;
    const timer = window.setInterval(() => {
      setIndex((current) => advanceIndex(current, DEMO_GAMES.length, "next"));
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, resolvedMotion]);

  const move = (direction: "next" | "previous") => {
    setIndex((current) => advanceIndex(current, DEMO_GAMES.length, direction));
  };

  return (
    <aside
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-card lg:h-full"
      aria-label="How Backlog Odyssey turns a game library into a next-play recommendation"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setIsPaused(false);
      }}
    >
      <div className="border-b border-border bg-card-alt px-5 py-4 lg:px-5 lg:py-3">
        <p className="technical-label text-signal">See what awaits</p>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          A quick preview of how Backlog Odyssey helps you choose what to play
          next.
        </p>
      </div>

      <div className="grid gap-3 p-5 lg:gap-2 lg:p-4">
        <ol
          className="grid gap-3 lg:gap-2"
          aria-label={`How Backlog Odyssey handles ${activeGame.name}`}
        >
          <li className="rounded-xl border border-border bg-background/70 p-4 lg:p-3">
            <p className="technical-label text-signal">Build your library</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Add games yourself or bring in your Steam collection.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-signal/30 bg-signal/10 px-2 py-1 text-xs font-medium text-signal lg:mt-2">
              {activeGame.entryMethod === "Imported from Steam" ? (
                <SourceIcon iconName="Gamepad2" brandIcon="steam.svg" />
              ) : null}
              {activeGame.entryMethod}
            </p>
          </li>
          <li className="rounded-xl border border-border bg-background/70 p-4 lg:p-3">
            <p className="technical-label text-opportunity">
              Organize, personalize and track your games
            </p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Track what matters to you, then watch your backlog take shape.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 lg:mt-2">
              {activeGame.tracking.map((signal) => (
                <span
                  key={signal}
                  className="rounded-full border border-border bg-card px-2 py-1 text-xs font-medium text-foreground"
                >
                  {signal}
                </span>
              ))}
            </div>
          </li>
          <li className="rounded-xl border border-border bg-background/70 p-4 lg:p-3">
            <p className="technical-label text-primary">
              Find your next game through our recommendation engine
            </p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Your choices, personal tags, backlog history and IGDB provided
              metadata all factor in to guide your next adventure.
            </p>
            <SignInDemoGameCard game={activeGame} />
          </li>
        </ol>

        <div className="flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30"
            onClick={() => move("previous")}
            aria-label="Previous game journey"
          >
            Previous
          </button>
          <span
            className="technical-label text-muted-foreground"
            aria-live="polite"
          >
            {index + 1} / {DEMO_GAMES.length}
          </span>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30"
            onClick={() => move("next")}
            aria-label="Next game journey"
          >
            Next
          </button>
        </div>
      </div>
    </aside>
  );
}
