import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import {
  getCompatBatchStatus,
  runCompatBatch,
} from "@/lib/compat-batch-runner";

const batchIdSchema = z.string().trim().min(1);

type RouteContext = {
  params: Promise<{ batchId: string }>;
};

function invalidBatchIdResponse() {
  return NextResponse.json(
    { success: false, data: null, error: "Invalid compatibility batch ID" },
    { status: 400 },
  );
}

function missingBatchResponse() {
  return NextResponse.json(
    { success: false, data: null, error: "Compatibility batch not found" },
    { status: 404 },
  );
}

async function parseBatchId(context: RouteContext): Promise<string | null> {
  const { batchId } = await context.params;
  const parsed = batchIdSchema.safeParse(batchId);
  return parsed.success ? parsed.data : null;
}

export async function GET(_request: Request, context: RouteContext) {
  await requireUser();
  const batchId = await parseBatchId(context);
  if (!batchId) return invalidBatchIdResponse();

  const result = await getCompatBatchStatus(batchId);
  return result ? NextResponse.json(result) : missingBatchResponse();
}

export async function POST(_request: Request, context: RouteContext) {
  await requireUser();
  const batchId = await parseBatchId(context);
  if (!batchId) return invalidBatchIdResponse();

  const result = await runCompatBatch(batchId);
  return result ? NextResponse.json(result) : missingBatchResponse();
}
