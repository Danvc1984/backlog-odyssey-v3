import Link from "next/link";
import { CreateDlcDialog } from "./CreateDlcDialog";

interface DlcItem {
  id: string;
  name: string;
}

export function DlcSection({ baseGameId, dlcs }: { baseGameId: string; dlcs: DlcItem[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          DLC
        </h2>
        <CreateDlcDialog baseGameId={baseGameId} />
      </div>
      {dlcs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No DLC attached.</p>
      ) : (
        <ul className="grid gap-1 text-sm">
          {dlcs.map((dlc) => (
            <li key={dlc.id}>
              <Link href={`/games/${dlc.id}`} className="hover:underline">
                {dlc.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
