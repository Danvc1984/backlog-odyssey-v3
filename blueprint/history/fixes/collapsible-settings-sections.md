# Fix: Collapsible settings sections with distinct heading typography

**Type:** Fix
**Status:** verified
**Branch:** `fix/collapsible-settings-sections`

## The problem

On `/settings` (`src/app/(app)/settings/page.tsx`) the page is divided into
`<section className="space-y-6">` blocks — Account, Appearance, Steam and
catalog sources, Recommendations, Provider queues, Personal data. Two issues:

1. The sections are always fully expanded, so the page is a very long scroll of
   six stacked card groups with no way to collapse what you don't need.
2. The section headings (`<h2>`) render with the same `--font-heading`
   treatment and near size as the card headings inside them, so the section
   level doesn't read as a distinct hierarchy tier from the headings it wraps.

## The fix

- Add a small `SectionHeading`-style collapsible wrapper for the settings
  sections. Prefer a native `<details>`/`<summary>` implementation styled with
  Tailwind: it stays a server component, needs zero client JS, and is
  accessible by default. A chevron indicator on the summary row shows the
  open/closed state.
- Sections start collapsed; clicking a heading expands it and only the
  heading row stays visible when collapsed.
- Introduce a distinct typography for the section headings, following the
  existing `.technical-label` pattern in `src/app/globals.css`: a new
  component class (e.g. `.section-label`) that uses `--font-technical`,
  uppercase, small size, wider letter-spacing — clearly different from the
  `--font-heading` headings used inside the sections.
- Keep the `<h2>` semantics (heading inside the `<summary>`) so document
  outline and screen-reader navigation are unchanged.

### Must not break

- The heading hierarchy (one `h1`, then `h2` per section) stays intact.
- Interactive children (Server Action forms inside AccountCard, PersonalDataCard,
  etc.) keep working — content is server-rendered regardless of open state.
- No changes to the other `space-y-6` page containers (wishlist/collections
  detail pages) — those are page wrappers, not sections.

## Build steps

1. **[x] Add `.section-label` typography + collapsible section markup.**
   Add the component class in `globals.css` and wrap each settings section in
   the native collapsible pattern, moving the `h2` into the summary row with a
   chevron.
   Done when: every settings section renders as a collapsible with the new
   technical-font heading, collapsed by default; expanding/collapsing works
   with keyboard and shows correct open state.

## Verify

- `pnpm dev`, open http://localhost:3500/settings.
- Each of the six sections shows a technical-font, uppercase heading with a
  chevron; clicking (or Enter/Space with keyboard focus) toggles the section.
- Collapsed sections hide their cards; expanded shows everything as before.
- Server-action surfaces inside collapsed-then-expanded sections (e.g. sign out
  button, export buttons) still work.
- `pnpm build` passes.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2979,"specSha256":"1cf094b561adb664f7c4425ed325a39c92e43ab79e9e6ecc4040ea3f731b94a8","branch":"refs/heads/fix/collapsible-settings-sections","head":"ecc690fab741a20cbdc1aa9730cba3216e0bbb9f","baseRef":"refs/heads/main","baseCommit":"ecc690fab741a20cbdc1aa9730cba3216e0bbb9f","sourceTree":"6061c27121d7aebcb0619e3bc0dd2b934fb1a6b7","absentOptional":[]} -->
