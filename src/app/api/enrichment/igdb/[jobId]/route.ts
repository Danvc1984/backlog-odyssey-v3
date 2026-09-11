import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import {
  getIgdbJobStatus,
  runIgdbEnrichmentJob,
} from "@/lib/igdb-job-runner";

const jobIdSchema = z.string().trim().min(1);

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

function invalidJobIdResponse() {
  return NextResponse.json(
    { success: false, data: null, error: "Invalid IGDB job ID" },
    { status: 400 },
  );
}

function missingJobResponse() {
  return NextResponse.json(
    { success: false, data: null, error: "IGDB job not found" },
    { status: 404 },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  await requireUser();
  const { jobId } = await context.params;
  const parsedJobId = jobIdSchema.safeParse(jobId);
  if (!parsedJobId.success) return invalidJobIdResponse();

  const result = await getIgdbJobStatus(parsedJobId.data);
  return result ? NextResponse.json(result) : missingJobResponse();
}

export async function POST(_request: Request, context: RouteContext) {
  await requireUser();
  const { jobId } = await context.params;
  const parsedJobId = jobIdSchema.safeParse(jobId);
  if (!parsedJobId.success) return invalidJobIdResponse();

  const result = await runIgdbEnrichmentJob(parsedJobId.data);
  return result ? NextResponse.json(result) : missingJobResponse();
}
