# Build Plan

> One of the two planning docs you provide. Write it yourself or with the AI's help.

The features that make up this project, high level and in rough build order, one
line each, no detail (that comes per feature). Rough is fine at first, but before
`/overview` runs this file should be shaped into a checkbox list the build loop
can track.

Keep it as a checklist. Run `/feature` with no number to spec the **next
unchecked** item, or `/feature 3` / `/feature "login"` to pick a specific one.
Completed features get checked off here, so the build plan doubles as your
progress tracker. A big item gets split into sub-items (4a, 4b, etc.) when you
spec it.

## Continuing after the initial build

This is a living roadmap, not a plan that freezes when the first release is
done. Keep completed items checked, then append new unchecked features as the
project grows. Optional milestone headings such as `## MVP` and `## Post-MVP`
keep a longer plan readable without changing how `/feature` finds the next
unchecked item.

Do not renumber completed features because their archived specs refer back to
those numbers. Continue with the next unused number. If a new feature materially
changes the product direction, users, data, stack, monetization, UI/UX, or
deployment, update the relevant part of `project-plan.md` too. Then re-run
`/overview` before spec'ing the feature.

## Format

Use checkboxes. Each item should be a feature-sized outcome, not a loose task or
a whole product area.

- [x] 1. **App shell and auth gate** - Next.js shell with desktop nav / mobile
  bottom nav and single-user Google sign-in restricted to ALLOWED_GOOGLE_EMAIL
- [x] 2. **Manual catalog and library base** - create manual games (base /
  other-platform / ROM) and a filtered library list
- [x] 3. **Game detail** - metadata, availability, record origin, personal fields
  (priority, interest, rating, notes, tags, preferred environment)
- [ ] 4. **Play states and main game** - play-state rules, main-game constraint,
  candidate flags (play soon / replay / hidden), abandoned signal
- [ ] 5. **Collections** - persistent manual Collections and calculated system
  Collections
- [ ] 6. **Steam connection and sync** - Steam OpenID connect, SteamID64, owned /
  recent import, exact App ID idempotency, playtime and last-played
- [ ] 7. **Possible duplicates** - similarity evidence, review, dismiss, delete,
  or manual merge
- [ ] 8. **Wishlist** - local wishlist for base games and DLC, target price,
  notes, already-available warning
- [ ] 9. **DLC model** - DLC as children of base games; DLC deals but never
  play-next
- [ ] 10. **ITAD price enrichment** - Steam App ID to ITAD ID, MX price queries,
  offer cards, freshness and stale labeling, buy recommendations
- [ ] 11. **Compatibility synthesis** - ProtonDB, anti-cheat dataset, Steam Deck
  verified, per-environment practical status, personal override
- [ ] 12. **Recommendation engine** - deterministic rule-based play-next and buy
  scoring with explanations and feedback (not now / hide)
- [ ] 13. **Today dashboard** - main game, in-progress, play-next recs, recent
  Steam activity, wishlist deals, provider freshness
- [ ] 14. **Dynamic visual theme** - theme from featured game, light/dark/system,
  simple fallback, WCAG AA
- [ ] 15. **Wallhaven desktop wallpaper** - SFW search, cached candidates, desktop
  only, never on mobile
- [ ] 16. **Settings** - connected services, sessions, theme, wallpaper /
  reduced-data, refresh controls, JSON export
- [ ] 17. **Backup and export** - on-demand JSON export and daily encrypted
  off-site backup rotation
- [ ] 18. **Deployment and CI** - Vercel config, env review, smoke test, Verify
  command and CI