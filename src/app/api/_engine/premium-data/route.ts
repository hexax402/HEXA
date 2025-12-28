import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function verifySession(token: string | undefined) {
  if (!token) return null;

  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, sig] = parts;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (expected !== sig) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function GET() {
  const token = cookies().get("hades_session")?.value;
  const session = verifySession(token);

  if (!session) {
    // ✅ real paywall
    return NextResponse.json(
      {
        ok: false,
        error: "PAYMENT_REQUIRED",
        priceLamports: Number(process.env.HADES_PRICE_LAMPORTS || "10000000"),
        merchant: process.env.HADES_MERCHANT_PUBKEY,
      },
      { status: 402 }
    );
  }

  // ✅ unlocked payload (replace with your real premium data)
  return NextResponse.json({
    ok: true,
    premium: true,
    session,
    data: {
      alpha: "live-feed-placeholder",
      ts: new Date().toISOString(),
    },
  });
}
