import { NextResponse } from "next/server";
import { accessCode, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

// Frein simple contre la force brute : 5 essais, puis 30 s d'attente.
let failures = 0;
let lockedUntil = 0;

export async function POST(request: Request) {
  if (Date.now() < lockedUntil) {
    return NextResponse.json(
      { error: "Trop d'essais. Réessaie dans quelques secondes." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";

  if (code !== accessCode()) {
    failures += 1;
    if (failures >= 5) {
      failures = 0;
      lockedUntil = Date.now() + 30_000;
    }
    return NextResponse.json({ error: "Code incorrect" }, { status: 401 });
  }

  failures = 0;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
  return response;
}
