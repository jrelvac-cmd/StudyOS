import { decrypt, encrypt } from "@/lib/crypto";
import { db } from "@/lib/supabase/admin";
import { subjectForEventTitle } from "@/lib/db/subjects";
import type { GoogleTokens } from "@/lib/db/types";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly", "openid", "email"].join(" ");

export const GOOGLE_STATE_COOKIE = "studyos_google_state";

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!clientId || !clientSecret || !appUrl) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / APP_URL manquants");
  return { clientId, clientSecret, redirectUri: `${appUrl}/api/google/callback` };
}

export function isGoogleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_URL && process.env.TOKEN_ENCRYPTION_KEY);
}

export function authorizationUrl(state: string) {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`Google token: ${res.status} ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

function emailFromIdToken(idToken?: string) {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string) {
  const { clientId, clientSecret, redirectUri } = config();
  const tokens = await tokenRequest({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const { data: existing } = await db().from("google_tokens").select("refresh_token_enc, calendar_id").eq("id", 1).maybeSingle();
  const refresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : (existing?.refresh_token_enc ?? null);
  const { error } = await db()
    .from("google_tokens")
    .upsert({
      id: 1,
      access_token_enc: encrypt(tokens.access_token),
      refresh_token_enc: refresh,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      email: emailFromIdToken(tokens.id_token),
      calendar_id: existing?.calendar_id ?? "primary",
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export async function getGoogleStatus(): Promise<GoogleTokens | null> {
  const { data } = await db().from("google_tokens").select("*").eq("id", 1).maybeSingle();
  return (data as GoogleTokens | null) ?? null;
}

export async function disconnectGoogle() {
  const row = await getGoogleStatus();
  if (row?.refresh_token_enc) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(row.refresh_token_enc))}`, {
      method: "POST",
    }).catch(() => undefined);
  }
  await db().from("google_tokens").delete().eq("id", 1);
}

export async function setCalendarId(calendarId: string) {
  const { error } = await db().from("google_tokens").update({ calendar_id: calendarId }).eq("id", 1);
  if (error) throw error;
}

async function accessToken(): Promise<{ token: string; calendarId: string }> {
  const row = await getGoogleStatus();
  if (!row) throw new Error("GOOGLE_NOT_CONNECTED");
  if (new Date(row.expires_at).getTime() - Date.now() > 60_000) {
    return { token: decrypt(row.access_token_enc), calendarId: row.calendar_id };
  }
  if (!row.refresh_token_enc) throw new Error("GOOGLE_NOT_CONNECTED");
  const { clientId, clientSecret } = config();
  const tokens = await tokenRequest({
    refresh_token: decrypt(row.refresh_token_enc),
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  await db()
    .from("google_tokens")
    .update({
      access_token_enc: encrypt(tokens.access_token),
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  return { token: tokens.access_token, calendarId: row.calendar_id };
}

async function googleGet<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google API: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function listCalendars() {
  const { token } = await accessToken();
  const data = await googleGet<{ items?: { id: string; summary: string; primary?: boolean }[] }>(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
    token,
  );
  return (data.items ?? []).map((c) => ({ id: c.id, name: c.summary, primary: !!c.primary }));
}

type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

/** Fenêtre synchronisée : 60 jours en arrière, 120 jours en avant. */
export async function syncCalendar() {
  const { token, calendarId } = await accessToken();
  const timeMin = new Date(Date.now() - 60 * 86400_000);
  const timeMax = new Date(Date.now() + 120 * 86400_000);

  const items: GoogleEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: "2500",
      showDeleted: "false",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await googleGet<{ items?: GoogleEvent[]; nextPageToken?: string }>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      token,
    );
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  const cache = new Map<string, string>();
  const rows: {
    google_id: string;
    source: "google";
    title: string;
    subject_id: string;
    starts_at: string;
    ends_at: string;
    room: string | null;
    updated_at: string;
  }[] = [];
  const now = new Date().toISOString();
  for (const ev of items) {
    // Les événements « journée entière » (vacances, rappels) ne sont pas des cours.
    if (ev.status === "cancelled" || !ev.start?.dateTime || !ev.end?.dateTime) continue;
    const title = (ev.summary ?? "").trim() || "Sans titre";
    rows.push({
      google_id: ev.id,
      source: "google",
      title,
      subject_id: await subjectForEventTitle(title, cache),
      starts_at: ev.start.dateTime,
      ends_at: ev.end.dateTime,
      room: ev.location?.trim() || null,
      updated_at: now,
    });
  }

  const client = db();
  if (rows.length) {
    const { error } = await client.from("calendar_events").upsert(rows, { onConflict: "google_id" });
    if (error) throw error;
  }

  // Ce qui a disparu du calendrier dans la fenêtre disparaît du planning.
  const keep = new Set(rows.map((r) => r.google_id));
  const { data: existing } = await client
    .from("calendar_events")
    .select("id, google_id")
    .eq("source", "google")
    .gte("starts_at", timeMin.toISOString())
    .lt("starts_at", timeMax.toISOString());
  const stale = (existing ?? []).filter((e) => e.google_id && !keep.has(e.google_id)).map((e) => e.id);
  if (stale.length) await client.from("calendar_events").delete().in("id", stale);

  await client.from("google_tokens").update({ last_synced_at: now }).eq("id", 1);
  return { synced: rows.length, removed: stale.length };
}
