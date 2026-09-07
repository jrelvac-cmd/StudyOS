export const SESSION_COOKIE = "studyos_session";
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

function secret() {
  // Sans SESSION_SECRET, le secret dérive du code : forger le cookie exigerait
  // le code, qui suffit déjà à se connecter. Pas plus faible que le code lui-même.
  return process.env.SESSION_SECRET || `studyos:${accessCode()}`;
}

export function accessCode() {
  return process.env.STUDYOS_ACCESS_CODE || "1979";
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSessionToken() {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${await sign(issuedAt)}`;
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return false;
  const [issuedAt, sig] = token.split(".");
  if (!issuedAt || !sig) return false;
  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > SESSION_MAX_AGE_S * 1000) return false;
  const expected = await sign(issuedAt);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};
