# Fix: Clarify Settings and provider work

**Type:** Fix
**Status:** verified
**Branch:** `fix/settings-provider-work-clarity`

## The problem

Settings does not clearly distinguish primary actions from passive information:

- The Environment edit control blends into its surroundings.
- Regional context includes a timezone even though the owner needs only the selected region wording.
- Unresolved Steam DLC and wishlist-import matches sit outside the provider-work area, while inactive, non-actionable Settings sections remain visible.
- The `Personal data` heading does not describe that it contains export and empty-schema restore controls.

## The fix

Make the relevant Settings surfaces clearer without changing provider-job behavior, import matching behavior, stored settings, or export/restore semantics:

- Swap the Environment edit button colors so its action is visually distinct.
- Show regional wording only, with no timezone text.
- Rename the provider section to `Provider workers and services`, move unresolved Steam DLC and wishlist import match controls into it, and hide its subsections when they have no current user action.
- Rename `Personal data` to `Data export and restore`.

## Build steps

1. [x] Update the Settings page composition, labels, and action styling.
   - **Done when:** Environment has a clearly contrasting Edit action; the regional summary omits timezone text; `Data export and restore` labels the export/restore area; and provider controls appear under `Provider workers and services`.

2. [x] Make provider-work subsections conditional on actionable content.
   - **Done when:** unresolved Steam DLC and wishlist import matches appear in the renamed provider area when present, while empty inactive provider subsections do not render; existing resolution flows still work.

## Verify

- Open `/settings` and confirm the renamed sections, contrasting Environment Edit button, and region-only wording.
- With unresolved provider items, confirm their controls are under `Provider workers and services` and resolve one through its existing flow.
- With no actionable provider work, confirm inactive subsections are hidden.
- Run `pnpm test`, `pnpm typecheck`, and `pnpm build`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2220,"specSha256":"b5f3a6730573080dd0028509f4b735e8671fe5076f81b1e0df7ab1b8e74ed738","branch":"refs/heads/fix/settings-provider-work-clarity","head":"f46401ee0fde6a6e199f2a29c44b39ea8f1903c9","baseRef":"refs/heads/main","baseCommit":"f46401ee0fde6a6e199f2a29c44b39ea8f1903c9","sourceTree":"c13e79b46129221a0901e9e1b7e7a7dc10ce6806","absentOptional":[]} -->
