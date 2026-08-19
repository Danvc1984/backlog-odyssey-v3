import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import {
  getRawgBatchStatus,
  runRawgCatalogBatch,
} from "@/lib/rawg-batch-runner";

const batchIdSchema = z.string().trim().min(1);

type RouteContext = {
  params: Promise<{ batchId: string }>;
};

function invalidBatchIdResponse() {
  return NextResponse.json(
    { success: false, data: null, error: "Invalid RAWG batch ID" },
    { status: 400 },
  );
}

function missingBatchResponse() {
  return NextResponse.json(
    { success: false, data: null, error: "RAWG batch not found" },
    { status: 404 },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  await requireUser();
  const { batchId } = await context.params;
  const parsedBatchId = batchIdSchema.safeParse(batchId);
  if (!parsedBatchId.success) {
    return invalidBatchIdResponse();
  }

  const result = await getRawgBatchStatus(parsedBatchId.data);
  return result ? NextResponse.json(result) : missingBatchResponse();
}

export async function POST(_request: Request, context: RouteContext) {
  await requireUser();
  const { batchId } = await context.params;
  const parsedBatchId = batchIdSchema.safeParse(batchId);
  if (!parsedBatchId.success) {
    return invalidBatchIdResponse();
  }

  const result = await runRawgCatalogBatch(parsedBatchId.data);
  return result ? NextResponse.json(result) : missingBatchResponse();
}
