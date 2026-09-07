import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, GOOGLE_STATE_COOKIE, syncCalendar } from "@/lib/google";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;

  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/reglages?google=${status}`, request.url));
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  if (!code || !state || !expected || state !== expected) return back("error");

  try {
    await exchangeCode(code);
    await syncCalendar().catch(() => undefined);
    return back("connected");
  } catch (err) {
    console.error("Google callback", err);
    return back("error");
  }
}
