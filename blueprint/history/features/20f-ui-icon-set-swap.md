# Feature: UI icon set swap with Phosphor Icons

**From build-plan:** feature 20f
**Status:** complete

## Goal

Replace the general-purpose Lucide UI icon set with the owner-selected
Phosphor Icons React package, while preserving the current Odyssey semantic
roles, sizing, animation, accessibility behavior, source-brand SVGs, and
fallback behavior. This is the gated implementation of the 20f icon-provider
choice, not a new visual theme or a replacement for local brand artwork.

The strategy is viable. `@phosphor-icons/react` is compatible with the app's
React 19 stack, is MIT licensed, supports six weights, uses SVG/currentColor
styling, and documents SSR-specific imports for Next.js Server Components.
The implementation must avoid the package's all-icons namespace and keep
server/client import boundaries explicit.

## Design reference

- [Phosphor Icons homepage and family](https://github.com/phosphor-icons/homepage#phosphor-icons)
- [Phosphor React package usage, SSR, weights, and import guidance](https://github.com/phosphor-icons/react#readme)
- Feature 20a approved theme contract: `blueprint/history/features/20a-prototype-lock.md`

No new screenshot is required for the provider decision because the owner
selected the referenced icon family. Representative live screenshots remain
required during implementation to review the selected weight and semantic
pairings before the final 20g cross-app acceptance.

## In scope

- Add `@phosphor-icons/react` as the general UI icon dependency and remove the
  direct `lucide-react` dependency after all consumers are migrated.
- Replace the 49 current source files that import `lucide-react`, including the
  shared Radix wrappers, toast icons, app navigation, route-level icons, and
  feature components.
- Replace the dynamic Lucide registry in `SourceIcon` with a typed Phosphor
  registry that keeps legacy source icon keys resolvable and preserves the
  neutral fallback for unknown/custom sources.
- Replace the system-collection icon map with Phosphor equivalents without
  changing collection IDs, counts, colors, queries, or stored export values.
- Use a documented default weight and preserve the existing semantic distinction
  between ordinary, status, action, destructive, and loading icons. The exact
  weight can be adjusted after representative screenshot review.
- Preserve `aria-hidden`, screen-reader labels, keyboard behavior, `currentColor`
  inheritance, Tailwind sizing classes, `animate-spin`, reduced-motion behavior,
  and the existing button/select/dialog layout.
- Add focused tests for the code-owned icon-name registry and fallback behavior
  where the migration changes pure mapping logic.

## Out of scope

- Replacing `public/*.svg` assets, including the Odyssey dragon favicon/masks,
  Steam, ITAD, and alternative-store brand marks. These remain the local brand
  provider as established by 20d.
- Changing icon meaning, navigation labels, button copy, routes, data behavior,
  source matching, collection queries, or recommendation logic.
- Adding a user-facing icon-weight selector, icon-theme setting, or custom icon
  upload flow.
- Reworking the 20a palette/typography contract or the per-game artwork system.
- Full desktop/mobile, four-palette, system-mode, focus, contrast,
  reduced-motion, and reduced-data acceptance across every route. That remains
  Feature 20g, with this feature supplying representative icon evidence.
- Creating custom Phosphor icon artwork. Existing local brand SVGs continue to
  cover branded providers.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the focused diff and explains the mapping in plain English.
4. The owner reviews and approves that step before the next one.
5. Run the step's done-when checks. Do not commit without separate approval.

## Current icon inventory and replacement map

The inventory is based on the current worktree. It includes direct Lucide
imports and the dynamic Lucide names currently passed through the source and
collection registries.

### Direct general UI consumers

| Current icon or family | Proposed Phosphor component | Current consumers / notes |
| --- | --- | --- |
| `Home` | `HouseIcon` | App navigation |
| `Library` | `BooksIcon` | App navigation |
| `FolderOpen` | `FolderOpenIcon` | App navigation |
| `Heart` | `HeartIcon` | App navigation |
| `Settings` | `GearIcon` | App navigation |
| `LogOut` | `SignOutIcon` | App navigation, Settings session |
| `Copy` | `CopyIcon` | Library duplicate route |
| `Clock` | `ClockIcon` | System collection |
| `RotateCcw` | `ArrowCounterClockwiseIcon` | System collection, unresolved DLC review |
| `Star` | `StarIcon` | System collection and source metadata |
| `EyeOff` | `EyeSlashIcon` | System collection |
| `Flag` | `FlagIcon` | System collection |
| `Folder` | `FolderIcon` | Collections route and fallback |
| `Calculator` | `CalculatorIcon` | Collection detail |
| `ChevronDown`, `ChevronDownIcon` | `CaretDownIcon` | Offer alternatives and Radix Select |
| `ChevronUp`, `ChevronUpIcon` | `CaretUpIcon` | Offer alternatives and Radix Select |
| `TriangleAlert`, `TriangleAlertIcon` | `WarningIcon` | Offer/status warnings and toast warning |
| `Link2` | `LinkSimpleIcon` | Steam identity and wishlist identity |
| `X`, `XIcon` | `XIcon` | Dismiss, close, and remove controls |
| `Search` | `MagnifyingGlassIcon` | Wishlist search dialogs |
| `Plus` | `PlusIcon` | Create/add controls and tags |
| `RefreshCw` | `ArrowClockwiseIcon` | Refresh, retry, and rotate controls |
| `Loader2`, `Loader2Icon` | `CircleNotchIcon` | Loading states, retaining `animate-spin` |
| `Download` | `DownloadSimpleIcon` | Export and wishlist import actions |
| `Sparkles` | `SparkleIcon` | RAWG batch and source presentation |
| `Check`, `CheckIcon` | `CheckIcon` | Checkboxes and review actions |
| `Trash2` | `TrashIcon` | Destructive delete actions |
| `WandSparkles` | `MagicWandIcon` | Unresolved DLC assisted action |
| `Import` | `FileArrowDownIcon` | Steam connection import action |
| `Unplug` | `PlugsConnectedIcon` | Steam disconnect action |
| `FolderPlus` | `FolderPlusIcon` | Collection creation/add actions |
| `SlidersHorizontal` | `SlidersHorizontalIcon` | Library filters |
| `ScanSearch` | `ScanIcon` | Duplicate scan action |
| `Pencil` | `PencilSimpleIcon` | Collection edit action |
| `Shuffle` | `ShuffleIcon` | Wallhaven refresh/shuffle actions |
| `Play` | `PlayIcon` | Start-playing action |
| `ExternalLink` | `ArrowSquareOutIcon` | External metadata links |
| `GitMerge` | `GitMergeIcon` | Merge-games action |
| `CircleSlash` | `ProhibitIcon` | No-color collection control |
| `Upload` | `UploadSimpleIcon` | Data import action |
| `Tag` | `TagIcon` | Wishlist offer section |

### Toast-specific icons

`src/components/ui/sonner.tsx` currently supplies `CircleCheckIcon`,
`InfoIcon`, `TriangleAlertIcon`, `OctagonXIcon`, and `Loader2Icon`. The proposed
Phosphor equivalents are `CheckCircleIcon`, `InfoIcon`, `WarningIcon`,
`WarningOctagonIcon`, and `CircleNotchIcon`, respectively. Toast close-button
behavior remains owned by Sonner and is not changed by this mapping.

### Dynamic source and collection names

`SourceIcon` currently resolves arbitrary strings through Lucide's `icons` map.
Phosphor does not provide an equivalent all-icons runtime map for this use, so
the migration must use an explicit typed registry and a fallback:

| Existing code-owned key | Proposed Phosphor component | Semantics |
| --- | --- | --- |
| `Box` | `CubeIcon` | Neutral custom/other-source fallback |
| `Sparkles` | `SparkleIcon` | Epic fallback metadata when brand SVG is unavailable |
| `Ghost` | `GhostIcon` | GOG fallback metadata |
| `Gamepad2`, `Gamepad` | `GameControllerIcon` | EA/Xbox fallback metadata |
| `Orbit` | `PlanetIcon` | Ubisoft fallback metadata |
| `Swords` | `SwordIcon` | Battle.net fallback metadata |
| `Palette` | `PaletteIcon` | itch.io fallback metadata |
| `Package` | `PackageIcon` | Amazon Games fallback metadata |
| `Gift` | `GiftIcon` | Humble Bundle fallback metadata |
| `Star` | `StarIcon` | Rockstar fallback metadata |
| `MonitorPlay` | `MonitorPlayIcon` | Steam fallback metadata |
| `Disc3` | `DiscIcon` | ROM availability |
| `Clock`, `RotateCcw`, `EyeOff`, `Flag` | matching components above | System collections |

The registry must continue to resolve the existing keys during the migration.
Changing the keys is not necessary and would create avoidable compatibility
risk for exported `Collection.icon` values and any persisted presentation data.
Unknown keys must render the same neutral fallback instead of throwing.

## Build steps

- [x] **Step 1 - Establish the Phosphor provider contract and import strategy** -
  add the official React package, define the typed icon component/name contract,
  record the proposed mappings above in the code-owned registry, and verify the
  Next.js Server Component versus client-component import paths without using a
  wildcard icon namespace. *Done when:* the app typechecks with one isolated
  Phosphor render in both a server-safe and client-safe representative path,
  the registry has a typed neutral fallback, and no application behavior has
  changed.
- [x] **Step 2 - Migrate shared UI primitives and notifications** - replace the
  icons in `src/components/ui/{checkbox,dialog,select,sonner}.tsx`, preserving
  Radix composition, toast identifiers, labels, close controls, sizing, and
  spinner animation. *Done when:* dialogs, selects, checkboxes, and all five
  toast states render with Phosphor icons in a local browser smoke check, with
  no console or hydration errors, and the build passes.
- [x] **Step 3 - Migrate app shell, collections, and source presentation** -
  replace navigation and route-level collection imports, update the system
  collection resolver, and replace `SourceIcon`'s dynamic Lucide lookup with
  the explicit legacy-key registry. Preserve local brand SVG masks and custom
  source fallback styling. *Done when:* Today, Library, Collections,
  collection detail, and source selectors show the expected Phosphor fallback
  icons while Steam/store/ITAD/dragon SVGs are unchanged; focused registry and
  source tests pass.
- [x] **Step 4 - Migrate catalog, library, and game-detail consumers** - replace
  the remaining icon imports under `src/components/games/` plus the Library and
  collection route consumers, including create/edit/delete, duplicate review,
  compatibility, RAWG, metadata, tags, and play-state surfaces. *Done when:*
  those routes preserve button semantics, icon sizes, destructive/status colors,
  and loading animation in a browser smoke check, and the typecheck/build pass.
- [x] **Step 5 - Migrate wishlist, Steam, Settings, and wallpaper consumers** -
  replace the icon imports under `src/components/wishlist/`,
  `src/components/steam/`, `src/components/settings/`, and the wallpaper
  component. *Done when:* import/export, price/compatibility refresh,
  wishlist identity, Steam connect/disconnect, Settings, and wallpaper actions
  retain their existing labels, disabled/loading states, and keyboard behavior
  with Phosphor icons; the typecheck/build pass.
- [x] **Step 6 - Migrate recommendation consumers and remove Lucide** - replace
  recommendation-card, Play Next, tuning, and action icons; remove
  `lucide-react` from `package.json` and the lockfile only after `rg` confirms no
  source import or type remains. *Done when:* Today recommendation surfaces
  retain dismiss, rotate, start-playing, refresh, and source-icon behavior;
  `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `git diff --check`
  pass; and `rg -n "lucide-react|LucideIcon|icons as" src package.json pnpm-lock.yaml`
  returns no migration leftovers.

## Files / areas

- `package.json`, `pnpm-lock.yaml`, and possibly `next.config.ts` if the verified
  import strategy needs package optimization.
- Shared UI: `src/components/ui/checkbox.tsx`, `dialog.tsx`, `select.tsx`,
  `sonner.tsx`, plus the existing SVG selectors in `button.tsx` that must remain
  compatible with Phosphor output.
- App shell and route consumers: `src/app/(app)/_components/AppNav.tsx`,
  `src/app/(app)/library/page.tsx`, `src/app/(app)/collections/**`.
- Source and system registries: `src/components/sources/SourceIcon.tsx`,
  `src/lib/sources/known-sources.ts`, and `src/lib/system-collections.ts`.
- Feature consumers under `src/components/games/`,
  `src/components/wishlist/`, `src/components/steam/`,
  `src/components/settings/`, `src/components/recommendations/`, and
  `src/components/wallpaper/`.
- Relevant mapping tests next to the registry/source helpers. No Prisma schema
  or migration file is expected.
- `public/*.svg` and the brand-mask rules in `src/app/globals.css` are inspected
  for regression but are not replaced.

## Data / contracts

- No database migration.
- No API or server-action contract change.
- Keep `Collection.icon` as a nullable string and keep exported icon values
  backward-compatible. Existing values remain readable through the new
  registry/fallback.
- Keep `SourcePresentation.iconName` and the legacy code-owned source keys
  stable at the boundary. Internally, map those keys to typed Phosphor
  components rather than accepting arbitrary component names from data.
- The icon component contract must accept normal SVG props, including
  `className`, `aria-hidden`, `style`, and `weight`, while defaulting to the
  selected Odyssey weight and `currentColor`.
- Client and Server Component imports must use the package entry point intended
  for that runtime. Do not rely on React Context in server-rendered paths.

## Testing

- Add or update focused Vitest coverage for the explicit source/system icon
  registry: every known legacy key resolves, `Box`/unknown values use the
  neutral fallback, and brand-icon requests still take the local SVG branch.
- UI primitives and route consumers are integration/visual work, not brittle
  component unit tests. Verify them with a real local browser smoke check and
  screenshots at representative desktop and mobile widths.
- Exercise at least: app navigation, Collections, Library filters, game detail,
  wishlist identity/offers, Steam Settings, data import/export, Today
  recommendations, dialog close, select open/selected states, checkbox checked
  state, toast success/warning/error/loading, disabled actions, and spinner
  animation.
- Confirm local brand assets remain unchanged and render in source selectors,
  wishlist ITAD labels, the dragon mark, and the favicon.
- Final automated gate after Step 6: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm build`, and `git diff --check`.
- Feature 20g owns the full four-palette and accessibility acceptance pass. This
  feature must still report any representative contrast, focus, hydration, or
  reduced-motion regression found during its own smoke checks.

## Notes for the AI

- This is a provider swap behind a review gate. Keep each diff mechanical and
  explain any icon pairing that is not a one-to-one name match.
- Use the Phosphor `Icon` suffix names and prefer individual client imports or
  `@phosphor-icons/react/ssr` for Server Components, as documented by the
  provider. Do not recreate Lucide's `icons` namespace with a broad import that
  defeats tree-shaking.
- Start with the regular weight unless screenshot review shows that a different
  default is needed for the approved Odyssey voice. Filled or duotone weights
  may be used only where state meaning is explicit and visually reviewed.
- Preserve `aria-hidden` for decorative icons and the existing screen-reader
  text for icon-only controls. Never use an icon as the only accessible name.
- Do not replace local brand SVGs with generic Phosphor symbols. A Phosphor
  fallback is only for a missing/custom source presentation.
- Preserve unrelated worktree changes, do not commit, merge, push, or complete
  the feature without separate owner approval.
