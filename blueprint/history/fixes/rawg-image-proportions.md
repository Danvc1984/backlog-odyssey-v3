# Fix: Proporciones de imágenes RAWG en catálogo y detalle

**Type:** Fix

## El problema

Algunas imágenes panorámicas almacenadas por RAWG se veían demasiado comprimidas
o recortadas. Todos los consumidores pasaban por `WishlistCover` o
`DetailHeroArt`, pero sus marcos rígidos producían encuadres desproporcionados.

## La corrección

Se normalizaron los marcos a relaciones 16:10 y 4:3 según la superficie y se
añadió `ArtworkBackdrop`, que reutiliza el mismo arte como fondo ampliado,
desenfocado y oscurecido, bajo una imagen frontal `object-contain`. El patrón se
reutiliza en catálogo, wishlist, detalles, recomendaciones, Today y actividad
reciente. No hubo cambios de datos, consultas, rutas ni acciones.

## Verificación

- Revisión visual en `/library` y `/wishlist`, incluyendo arte panorámico y
  fallbacks sin imagen.
- Comprobación de ajuste `contain` en `/library`, `/wishlist` y `/today`.
- `pnpm test` - 98 archivos y 1007 tests pasan.
- `pnpm build` pasa.
- `git diff --check` pasa.
