import { addDays, format, isValid, parseISO, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Tout est affiché dans le fuseau de Julien, quel que soit celui du serveur
 * (Vercel tourne en UTC) : serveur et navigateur rendent la même chose.
 */
export const TIMEZONE = "Europe/Paris";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsIn(date: Date): Parts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Décalage (minutes) du fuseau de Julien par rapport à UTC à cet instant. */
function offsetMinutes(date: Date) {
  const p = partsIn(date);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime()) / 60_000;
}

/** Instant UTC correspondant à une date + heure saisies dans le fuseau de Julien. */
export function localToUtc(dateStr: string, timeStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  return new Date(guess - offsetMinutes(new Date(guess)) * 60_000);
}

/** Jour (yyyy-MM-dd) et heure décimale d'un instant, dans le fuseau de Julien. */
export function localParts(iso: string | Date) {
  const p = partsIn(typeof iso === "string" ? new Date(iso) : iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dayKey: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    hours: p.hour + p.minute / 60,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}

export function todayKey() {
  return localParts(new Date()).dayKey;
}

export function weekStart(input?: string | null) {
  const parsed = input ? parseISO(input) : parseISO(todayKey());
  const base = isValid(parsed) ? parsed : parseISO(todayKey());
  return startOfWeek(base, { weekStartsOn: 1 });
}

export function isoDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function weekDays(start: Date) {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Formate une date « civile » (yyyy-MM-dd), sans effet de fuseau. */
export function fmtDay(day: string | Date, pattern = "d MMM yyyy") {
  const date = typeof day === "string" ? parseISO(day) : day;
  return format(date, pattern, { locale: fr });
}

/** Formate un instant dans le fuseau de Julien. */
export function fmtInstant(iso: string, pattern = "EEEE d MMMM · HH:mm") {
  const { dayKey, time } = localParts(iso);
  const [hh, mm] = time.split(":").map(Number);
  const d = parseISO(dayKey);
  d.setHours(hh, mm, 0, 0);
  return format(d, pattern, { locale: fr });
}
