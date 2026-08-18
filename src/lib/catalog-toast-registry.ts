export type CatalogToastKind = "action" | "undo";

export function catalogToastId(kind: CatalogToastKind, operationId: string): string {
  return `catalog-${kind}-${operationId}`;
}

export class CatalogToastRegistry {
  private readonly activeToastIds = new Set<string>();

  claim(kind: CatalogToastKind, operationId: string): boolean {
    const toastId = catalogToastId(kind, operationId);
    if (this.activeToastIds.has(toastId)) return false;
    this.activeToastIds.add(toastId);
    return true;
  }

  has(kind: CatalogToastKind, operationId: string): boolean {
    return this.activeToastIds.has(catalogToastId(kind, operationId));
  }

  release(kind: CatalogToastKind, operationId: string) {
    this.activeToastIds.delete(catalogToastId(kind, operationId));
  }
}

export const catalogToastRegistry = new CatalogToastRegistry();
