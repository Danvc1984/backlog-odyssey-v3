import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { exportDocumentSchema } from "@/lib/export-schema";
import { assertEmptySchema, restoreExportDocument, type TxDb } from "@/lib/import-restore";

export async function POST(request: Request) {
  await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: "Expected a JSON file body" },
      { status: 400 },
    );
  }

  const parsed = exportDocumentSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue ? issue.path.join(".") : "document";
    return NextResponse.json(
      { success: false, data: null, error: `Invalid export document at ${path || "root"}` },
      { status: 400 },
    );
  }

  const document = parsed.data;

  try {
    const counts = await prisma.$transaction(async (tx) => {
      const guard = await assertEmptySchema(tx);
      if (!guard.empty) {
        return { refused: true as const, domains: guard.nonEmpty };
      }
      const restored = await restoreExportDocument(tx as unknown as TxDb, document);
      return { refused: false as const, restored };
    });

    if (counts.refused) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: `Database is not empty. Refusing import because data exists in: ${counts.domains.join(", ")}`,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, data: counts.restored, error: null }, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: "Import failed" },
      { status: 500 },
    );
  }
}
