import type { ExplanationCaveat, ExplanationFactor } from "./types";

function lowercaseInitial(value: string): string {
  return value.length > 0 ? `${value[0].toLowerCase()}${value.slice(1)}` : value;
}

function joinValues(values: readonly string[]): string {
  if (values.length === 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${lowercaseInitial(values[1] ?? "")}`;
  return `${values.slice(0, -1).join(", ")}, and ${lowercaseInitial(values.at(-1) ?? "")}`;
}

function mergeLabels(factor: ExplanationFactor, labels: readonly string[]): string {
  const unique = [...new Set(labels)];
  if (unique.length <= 1) return unique[0] ?? factor.label;

  if (factor.factor === "taste_profile") {
    const tasteValues: string[] = [];
    const preferenceValues: string[] = [];
    const otherLabels: string[] = [];
    for (const label of unique) {
      const tasteMatch = label.match(/^Matches your taste for (.+) games$/);
      const preferenceMatch = label.match(/^Matches your preference for (.+)$/);
      if (tasteMatch) tasteValues.push(tasteMatch[1]);
      else if (preferenceMatch) preferenceValues.push(preferenceMatch[1]);
      else otherLabels.push(label);
    }
    const clauses: string[] = [];
    if (tasteValues.length > 0) clauses.push(`Matches your taste for ${joinValues(tasteValues)} games`);
    if (preferenceValues.length > 0) {
      clauses.push(
        clauses.length > 0
          ? `your preference for ${joinValues(preferenceValues)}`
          : `Matches your preference for ${joinValues(preferenceValues)}`,
      );
    }
    clauses.push(...otherLabels);
    if (clauses.length > 0) return joinValues(clauses);
  }

  const templates = [
    { prefix: "Matches your taste for ", suffix: " games" },
    { prefix: "Less aligned with your taste for ", suffix: "" },
    { prefix: "Matches your preference for ", suffix: "" },
    { prefix: "Conflicts with your preference against ", suffix: "" },
    { prefix: "Matches your source tune: ", suffix: "" },
    { prefix: "Tuned for ", suffix: "" },
  ];
  for (const template of templates) {
    if (!unique.every((label) => label.startsWith(template.prefix) && label.endsWith(template.suffix))) continue;
    const values = unique.map((label) => label.slice(template.prefix.length, label.length - template.suffix.length));
    return `${template.prefix}${joinValues(values)}${template.suffix}`;
  }

  return joinValues(unique);
}

function aggregateFactors(factors: readonly ExplanationFactor[]): ExplanationFactor[] {
  const grouped = new Map<ExplanationFactor["factor"], ExplanationFactor[]>();
  for (const factor of factors) {
    const group = grouped.get(factor.factor) ?? [];
    group.push(factor);
    grouped.set(factor.factor, group);
  }

  return [...grouped.values()].map((group) => {
    const sourceNames = [...new Set(group.flatMap((factor) => factor.sourceNames ?? []))];
    return {
      ...group[0],
      label: mergeLabels(group[0], group.map((factor) => factor.label)),
      points: group.reduce((total, factor) => total + factor.points, 0),
      ...(sourceNames.length > 0 ? { sourceNames } : {}),
    };
  });
}

export function prepareRecommendationFactors(
  positive: readonly ExplanationFactor[],
  negative: readonly ExplanationFactor[],
  caveats: readonly ExplanationCaveat[],
): {
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
} {
  return {
    positive: aggregateFactors(positive).sort((left, right) => right.points - left.points),
    negative: aggregateFactors(negative).sort((left, right) => right.points - left.points),
    caveats: [...new Map(caveats.map((caveat) => [`${caveat.factor}:${caveat.label}`, caveat])).values()],
  };
}
