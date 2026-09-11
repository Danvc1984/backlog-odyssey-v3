import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import { getIgdbBatchStatus, runIgdbCatalogBatch } from "@/lib/igdb-batch-runner";

const idSchema = z.string().trim().min(1);
type Context = { params: Promise<{ batchId: string }> };

export async function GET(_request: Request, context: Context) {
  await requireUser();
  const id = idSchema.safeParse((await context.params).batchId);
  if (!id.success) return NextResponse.json({ success: false, data: null, error: "Invalid IGDB batch ID" }, { status: 400 });
  const result = await getIgdbBatchStatus(id.data);
  return result ? NextResponse.json(result) : NextResponse.json({ success: false, data: null, error: "IGDB batch not found" }, { status: 404 });
}

export async function POST(_request: Request, context: Context) {
  await requireUser();
  const id = idSchema.safeParse((await context.params).batchId);
  if (!id.success) return NextResponse.json({ success: false, data: null, error: "Invalid IGDB batch ID" }, { status: 400 });
  const result = await runIgdbCatalogBatch(id.data);
  return result ? NextResponse.json(result) : NextResponse.json({ success: false, data: null, error: "IGDB batch not found" }, { status: 404 });
}
