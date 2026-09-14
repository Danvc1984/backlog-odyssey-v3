# Fix: Enriquecer DLC de wishlist con IGDB

**Type:** Fix

**Status:** verified

**Branch:** `fix/wishlist-dlc-igdb-enrichment`

## The problem

Los DLC de wishlist no reciben consistentemente metadatos IGDB. Los DLC creados manualmente solo refrescan compatibilidad para juegos base, y aunque la importación de wishlist llama a `autoEnrichWishlistEntries`, el flujo completo debe garantizar que los DLC importados se enriquezcan después de crear/resolver su entrada y su juego base. Esto deja DLC con Steam App ID confirmado sin snapshot IGDB, aunque los DLC del catálogo principal ya usan coincidencia por Steam ID o por la relación del juego base.

## The fix

Garantizar el enriquecimiento fill-only de IGDB para DLC de wishlist tanto al crearlos manualmente como al importarlos desde Steam. Mantener disponible el control de carga/refresco en el detalle de wishlist y ocultar en el detalle del catálogo las secciones que no aplican a DLC sin entrada de biblioteca: Availability, Tags y Collections. Reutilizar los helpers existentes y mantener los comportamientos actuales: los fallos de proveedor no deben impedir crear o importar el deseo, no se sobrescriben snapshots existentes y la compatibilidad sigue limitada a juegos base.

## Build steps

1. **[x] Garantizar enriquecimiento automático en ambos flujos**
   - Conectar `createWishlistEntry` con la cola de enriquecimiento después de persistir un DLC manual con identidad Steam confirmada.
   - Revisar el importador para que todos los DLC importados elegibles lleguen a `autoEnrichWishlistEntries` después de persistir la entrada y resolver su juego base.
   - Reutilizar `enrichWishlistDlcFromIgdb`, que prioriza el Steam App ID y conserva la relación IGDB del juego base como alternativa cuando no haya ID.
   - **Done when:** tanto un DLC manual como uno importado con Steam App ID intentan guardar su snapshot IGDB sin bloquear la creación o importación si IGDB no encuentra match o no está disponible.

2. **[x] Cubrir ambos caminos**
   - Añadir pruebas Vitest para DLC manual con Steam ID, DLC manual sin ID y aislamiento ante fallos de enriquecimiento.
   - Añadir o ajustar pruebas de importación para demostrar que los DLC importados se incluyen en la lista enriquecida y reciben el contexto de su juego base.
   - **Done when:** las pruebas demuestran enriquecimiento para ambos flujos, preservación ante fallos y que el flujo de juegos base no cambia.

3. **[x] Ocultar organización y availability en detalle de DLC de catálogo**
   - Renderizar Availability, Tags y Collections únicamente para juegos base en `/games/[id]`.
   - Mantener esas secciones para juegos base sin cambiar su edición ni su contenido.
   - **Done when:** un detalle de DLC de catálogo no muestra esas tres secciones, mientras un detalle de juego base continúa mostrándolas.

4. **[x] Homogeneizar el panel de enrichment de wishlist**
   - Presentar el control de wishlist con la misma `SectionCard`, eyebrow, status pill, espaciado y estados visuales del panel IGDB de Library.
   - Conservar la acción específica de wishlist para cargar o refrescar el snapshot directamente, incluida la confirmación de reemplazo.
   - **Done when:** el detalle de un DLC de wishlist muestra un panel visualmente consistente con Library y permite cargar/refrescar metadatos sin cambiar su flujo funcional.

5. **[x] Permitir seleccionar matches ambiguos en wishlist**
   - Buscar candidatos IGDB cuando la carga o el refresco no pueda resolver un match único.
   - Mostrar la lista de candidatos con portada y fecha, permitir elegir uno y persistirlo con la acción existente de wishlist.
   - Mantener la confirmación de reemplazo cuando ya existe un snapshot.
   - **Done when:** un DLC de wishlist con match ambiguo muestra candidatos seleccionables y puede guardar el match elegido sin depender de Edit.

6. **[x] Igualar el flujo de revisión de matches con Library**
   - Usar los mismos textos, acciones y presentación de candidatos que `IgdbEnrichmentPanel`, incluidos Choose another match y None of these match.
   - **Done when:** el estado de match ambiguo en wishlist ofrece el mismo flujo visible de selección o descarte que Library, conservando las acciones propias de wishlist.

## Verify

- Ejecutar `pnpm test` y `pnpm build`.
- En la app, agregar manualmente a la wishlist un DLC asociado a un juego base e indicar su Steam App ID. Confirmar que el deseo se crea, muestra el control de IGDB y, tras recargar, muestra metadatos cuando existe coincidencia.
- Importar una wishlist que contenga DLC con Steam IDs y confirmar que conserva su enriquecimiento automático y que una falta de match no bloquea la importación.
- Abrir un DLC desde el catálogo principal y confirmar que no aparecen Availability, Tags ni Collections; abrir un juego base y confirmar que sí siguen disponibles.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":4870,"specSha256":"e79bab0d82a41f36030a77ef7f6900ea0a3534293bdfc71e8ba3eae80fa459cf","branch":"refs/heads/fix/wishlist-dlc-igdb-enrichment","head":"2354d7a577b98c0435cce1b51972c4ee90822695","baseRef":"refs/heads/main","baseCommit":"2354d7a577b98c0435cce1b51972c4ee90822695","sourceTree":"8311aa0f60570b6dd0cc653f84d8baedf59bdcd1","absentOptional":[]} -->
