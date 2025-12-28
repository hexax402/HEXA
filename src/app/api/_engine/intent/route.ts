import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST() {
  // price, ttl, recipient are server-controlled
  const priceLamports = Number(process.env.PRICE_LAMPORTS ?? "10000000"); // 0.01 SOL default
  const recipient = process.env.PAYMENT_RECIPIENT!; // base58 pubkey
  const intentTtlSec = Number(process.env.INTENT_TTL_SEC ?? "90");

  // reference binds tx to this intent (prevents replay)
  const reference = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + intentTtlSec * 1000;

  return NextResponse.json({
    priceLamports,
    recipient,
    reference,
    expiresAt,
  });
}
