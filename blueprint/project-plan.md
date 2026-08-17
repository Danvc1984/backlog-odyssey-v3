# Project Plan

> One of the two planning docs you provide. Answer each section in a line or two
> (a worksheet, not an essay). Draft it yourself or let the AI help you expand and
> sharpen it; either way, the content is yours to direct. When it's filled in, run
> `/overview` to generate the project overview from this plus `build-plan.md`.

## 1. Problem - What problem are we solving?

Gaming is fragmented across Steam, price comparison, compatibility communities,
metadata catalogs, and personal notes. The owner cannot easily answer: what to
play next from already-owned games, which wishlist base game or DLC is worth
buying now for Mexico, and whether to use Bazzite, Steam Deck, or Windows for a
given game. Backlog Odyssey consolidates these into one private assistant
without becoming a launcher or storefront.

## 2. Users - Who is this for?

A single private owner. One fixed environment: Bazzite on desktop, Steam Deck
portable, Windows fallback, Mexico prices (MX), and UTC-6. No multi-user, no
roles, no registration.

## 3. Features - What does the MVP need?

- Today dashboard: main game, other in-progress, 3 play-next recs, recent Steam
  activity, wishlist deals, provider freshness
- Library: searchable grid and compact table, filters, sorting, bulk actions,
  manual creation, duplicate review, hard delete
- Wishlist and deals: local wishlist authority, ITAD MX offers, buy recs, ITAD links
- Game detail: metadata, availability, play state, personal fields, compatibility
  evidence, DLC state, duplicate warning, recommendation explanation
- Settings: connected services, sessions, theme, wallpaper, refresh controls, JSON export
- Steam synchronization import; manual / ROM / other-platform entries; duplicate detection
- Rule-based, explainable play-next and buy recommendations
- Dynamic visual theme from the main game with a simple fallback
- Manual and calculated system Collections

## 4. Data - What are we storing?

Auth.js User / Account / Session; AppSettings singleton; SteamConnection;
Game (base or DLC) plus DLC-to-base parent; ExternalGameId; GameMetadataSnapshot;
LibraryEntry (play state, flags, personal fields); GameAvailability (Steam /
other / ROM, playtime, last played); WishlistEntry; PriceRefresh / DealOffer;
Collection / CollectionMembership; PersonalTag / GameTag;
CompatibilitySnapshot / EnvironmentCompatibility; PossibleDuplicate;
RecommendationRun / RecommendationItem / RecommendationFeedback; WallpaperState;
SyncRun. Provider data is rebuildable; personal intent is authoritative.

## 5. Tech - What stack are we using?

Next.js App Router, React, TypeScript, Turbopack, pnpm, Tailwind CSS v4 with
shadcn/ui on Radix UI, Prisma ORM on Supabase PostgreSQL, Auth.js with Google
(single allowed email), Zod, Vitest, Vercel, separate encrypted
off-site backups.

## 6. Monetize - How will this make money?

It does not. Private single-user app. Source-available under the PolyForm
Noncommercial License 1.0.0; no ads, subscriptions, or analytics.

## 7. UI/UX - How should this look and feel?

Private responsive browser app. Desktop (up to 2560x1440): constrained width,
dense library table, multi-column cards, side-by-side compatibility, optional
Wallhaven wallpaper. Mobile: bottom navigation, single-column cards, slide-up
filter sheet, 44px touch targets, simple fallback background, no wallpaper.
Dynamic theme from the featured main game with accessible light/dark/system modes
(WCAG AA); look and feel uses the game artwork and wallpaper.

## 8. Deployment - Where and how will this ship?

Vercel for Next.js. Supabase PostgreSQL: pooled URL at runtime, direct URL for
migrations. Env vars per .env.example (DIRECT_URL, DATABASE_URL, AUTH_SECRET,
AUTH_URL, AUTH_TRUST_HOST, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET,
ALLOWED_GOOGLE_EMAIL) plus future server-only provider keys (Steam Web API, ITAD,
Wallhaven). Scheduled daily sync and price refresh jobs. Daily encrypted off-site
backup of irreplaceable tables, retaining the 7 most recent. Migration deploy
before start; health check at the app root.