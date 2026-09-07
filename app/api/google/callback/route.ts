import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, GOOGLE_STATE_COOKIE, syncCalendar } from "@/lib/google";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;

  const back = (status: string, reason?: string) => {
    const target = new URL("/reglages", request.url);
    target.searchParams.set("google", status);
    if (reason) target.searchParams.set("reason", reason.slice(0, 200));
    const res = NextResponse.redirect(target);
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  if (url.searchParams.get("error")) return back("error", `Google a refusé : ${url.searchParams.get("error")}`);
  if (!code || !state || !expected || state !== expected) return back("error", "État OAuth invalide (recommence depuis Réglages).");

  try {
    await exchangeCode(code);
  } catch (err) {
    console.error("Google callback", err);
    return back("error", err instanceof Error ? err.message : "Échange du code impossible");
  }

  try {
    await syncCalendar();
    return back("connected");
  } catch (err) {
    console.error("Google first sync", err);
    return back("sync_error", err instanceof Error ? err.message : "Synchronisation impossible");
  }
}
