import { NextResponse } from "next/server";
import { getEngine } from "../_engine/engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const e = getEngine();
  const { cmd } = await req.json().catch(() => ({ cmd: "" }));
  const raw = String(cmd || "").trim();
  const s = raw.toLowerCase();

  try {
    if (s === "tick") e.tick();
    else if (s === "risk") e.risk();
    else if (s === "flatten") e.flatten();
    else if (s === "probe") e.probe();
    else if (s === "clear logs") e.clearLogs();
    else if (s === "clear alerts") e.clearAlerts();
    else if (s === "trigger alert") e.triggerAlert();
    else if (s.startsWith("call")) {
      // Example inputs:
      // "call" or "call /api/premium-data"
      const parts = raw.split(" ").filter(Boolean);
      const route = (parts[1] || "/api/premium-data").trim();

      // cosmetic + telemetry
      e.synthCall(route);

      // REAL request: forward user's cookies so the server sees hades_session
      const cookie = req.headers.get("cookie") || "";

      const r = await fetch(new URL(route, req.url), {
        method: "GET",
        headers: { cookie },
        cache: "no-store",
      });

      let note = "";
      try {
        const j = await r.json();
        if (j?.error) note = `body: ${j.error}`;
      } catch {
        // ignore
      }

      e.observeRouteResult({ route, httpStatus: r.status, note });
    } else {
      e["logs"].push(`cmd: unknown "${cmd}"`);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    e["logs"].push(`cmd: error "${raw}" → ${err?.message || "unknown"}`);
    return NextResponse.json({ ok: false, error: err?.message || "command error" }, { status: 500 });
  }
}
