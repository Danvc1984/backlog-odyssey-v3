import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await prisma.game.findUnique({ where: { id } });

  if (!game) {
    redirect("/library");
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">{game.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Game detail coming in a later feature.
      </p>
    </div>
  );
}
