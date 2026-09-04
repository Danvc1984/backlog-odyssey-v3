import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { buildExportDocument } from "@/lib/export-data";
import { exportDocumentSchema } from "@/lib/export-schema";

function dateStamp(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export async function GET() {
  await requireUser();

  const envelope = await buildExportDocument();
  const parsed = exportDocumentSchema.safeParse(envelope);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, data: null, error: "Export validation failed" },
      { status: 500 },
    );
  }

  const json = JSON.stringify(parsed.data);
  return new Response(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="backlog-odyssey-export-v1-${dateStamp()}.json"`,
      "Content-Length": String(Buffer.byteLength(json)),
    },
  });
}
