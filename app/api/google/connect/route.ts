import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizationUrl, GOOGLE_STATE_COOKIE, isGoogleConfigured } from "@/lib/google";

export async function GET(request: Request) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/reglages?google=not_configured", request.url));
  }
  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(authorizationUrl(state));
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
