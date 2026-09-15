# IGDB clean restart

Use this procedure when rebuilding a database after the RAWG to IGDB provider transition.

1. Export personal data from Settings and keep the JSON file safe. The export retains catalog and wishlist records, personal fields, collections, availability, and all external IDs.
2. Stop the application and wipe the PostgreSQL database using the environment's approved database reset procedure.
3. Apply migrations and restore the export through the empty-schema import flow. Import refuses to run if catalog or wishlist records already exist.
4. Re-link the Steam account and run the manual owned-library import. Preserved Steam external IDs update matching records instead of creating duplicates.
5. Run IGDB enrichment for the catalog and wishlist. Rebuild compatibility, prices, playtime evidence, and recent activity through their existing manual refresh flows.

Provider snapshots, credentials, prices, compatibility evidence, provider-operation history, and recent activity are deliberately excluded from the export. They are rebuildable and must not be copied into the empty schema. Existing RAWG snapshots are discarded by the retirement migration and are never interpreted as IGDB evidence.
