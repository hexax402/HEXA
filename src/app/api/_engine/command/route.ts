import { NextResponse } from "next/server";
import { getEngine } from "../_engine/engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const e = getEngine();
  const { cmd } = await req.json().catch(() => ({ cmd: "" }));
  const s = String(cmd || "").trim().toLowerCase();

  // normalize
  if (s === "tick") e.tick();
  else if (s.startsWith("call")) e.call();
  else if (s === "risk") e.risk();
  else if (s === "flatten") e.flatten();
  else if (s === "probe") e.probe();
  else if (s === "clear logs") e.clearLogs();
  else if (s === "clear alerts") e.clearAlerts();
  else if (s === "trigger alert") e.triggerAlert();
  else {
    e["logs"].push(`cmd: unknown "${cmd}"`);
  }

  return NextResponse.json({ ok: true });
}
