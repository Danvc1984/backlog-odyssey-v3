export function ColdStartNote({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      Cold start: limited history, showing a varied mix.
    </p>
  );
}
