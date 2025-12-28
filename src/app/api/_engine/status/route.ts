import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getEngine } from "../_engine/engine";

export const dynamic = "force-dynamic";

type SessionPayload = { v: number; exp: number; recipient?: string; sig?: string };

function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, sig] = parts;

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (expected !== sig) return null;

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  if (!payload?.exp || Date.now() > payload.exp) return null;

  return payload;
}

export async function GET() {
  const e = getEngine();

  // 1) read cookie
  const token = cookies().get("hades_session")?.value;
  const session = verifySession(token);

  // 2) base engine status
  const s = e.status();

  // 3) force state based on real session validity
  if (session) {
    return NextResponse.json({
      ...s,
      state: "UNLOCKED",
      statusText: "UNLOCKED",
    });
  }

  // If you want "READY" until they attempt the call, change this to READY.
  // For strict paywall vibe, keep PAYMENT_REQUIRED by default:
  return NextResponse.json({
    ...s,
    state: "PAYMENT_REQUIRED",
    statusText: "PAYMENT_REQUIRED",
  });
}
