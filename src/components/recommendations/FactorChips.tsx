import type { ExplanationCaveat, ExplanationFactor } from "@/lib/recommendations/types";
import { SourceIcon } from "@/components/sources/SourceIcon";
import { resolveSourcePresentation } from "@/lib/sources/known-sources";

const POSITIVE_CLASS = "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
const NEGATIVE_CLASS = "border-red-500/40 bg-red-500/10 text-red-200";
const CAVEAT_CLASS = "border-amber-500/40 bg-amber-500/10 text-amber-200";

function Chip({ label, className, sourceNames }: { label: string; className: string; sourceNames?: string[] }) {
  return (
    <span className={`flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}>
      {sourceNames?.map((name) => (
        <SourceIcon key={name} iconName={resolveSourcePresentation(name).iconName} />
      ))}
      <span>{label}</span>
    </span>
  );
}

export function factorChip(
  factor: ExplanationFactor,
  options: { showPoints?: boolean } = {},
): React.ReactNode {
  const { showPoints = true } = options;
  const className =
    factor.points >= 0
      ? POSITIVE_CLASS
      : NEGATIVE_CLASS;
  const points =
    showPoints && factor.points !== 0 ? ` ${factor.points > 0 ? "+" : ""}${factor.points}` : "";
  return <Chip key={`${factor.factor}-${factor.label}`} label={`${factor.label}${points}`} className={className} sourceNames={factor.sourceNames} />;
}

export function caveatChip(caveat: ExplanationCaveat): React.ReactNode {
  return <Chip key={`${caveat.factor}-${caveat.label}`} label={caveat.label} className={CAVEAT_CLASS} />;
}
