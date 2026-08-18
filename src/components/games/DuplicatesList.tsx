import Link from "next/link";
import { DismissDuplicateButton, ScanDuplicatesButton } from "./DuplicateActions";

interface DuplicateReviewItem {
  id: string;
  gameAId: string;
  gameBId: string;
  confidence: number | null;
  evidence: unknown;
  gameA: { id: string; name: string };
  gameB: { id: string; name: string };
}

function getEvidenceMethod(evidence: unknown): string {
  if (
    typeof evidence === "object" &&
    evidence !== null &&
    "method" in evidence &&
    typeof evidence.method === "string"
  ) {
    return evidence.method;
  }
  return "unknown";
}

export function DuplicatesList({ duplicates }: { duplicates: DuplicateReviewItem[] }) {
  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Open possible duplicates</h2>
          <p className="text-sm text-muted-foreground">
            Review name matches before deciding what to do with them.
          </p>
        </div>
        <ScanDuplicatesButton />
      </div>

      {duplicates.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-lg font-medium">No duplicates found</p>
          <p className="text-sm text-muted-foreground">
            Scan your library to look for matching game names.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">Games</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Evidence</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {duplicates.map((duplicate) => (
                <tr key={duplicate.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="grid gap-1">
                      <Link href={`/games/${duplicate.gameA.id}`} className="font-medium hover:underline">
                        {duplicate.gameA.name}
                      </Link>
                      <Link href={`/games/${duplicate.gameB.id}`} className="font-medium hover:underline">
                        {duplicate.gameB.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {duplicate.confidence === null
                      ? "-"
                      : `${Math.round(duplicate.confidence * 100)}%`}
                  </td>
                  <td className="px-4 py-3">{getEvidenceMethod(duplicate.evidence)}</td>
                  <td className="px-4 py-3 text-right">
                    <DismissDuplicateButton duplicateId={duplicate.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
