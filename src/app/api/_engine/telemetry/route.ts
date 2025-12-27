import { NextResponse } from "next/server";
import { getEngine } from "../_engine/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const e = getEngine();
  return NextResponse.json(e.telemetry);
}
