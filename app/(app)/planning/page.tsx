import type { Metadata } from "next";
import { addDays } from "date-fns";
import { WeekView } from "@/components/planning/WeekView";
import { listEventsBetween } from "@/lib/db/events";
import { listSubjects } from "@/lib/db/subjects";
import { isoDate, localToUtc, weekStart } from "@/lib/dates";
import { getGoogleStatus } from "@/lib/google";

export const metadata: Metadata = { title: "Planning" };
export const dynamic = "force-dynamic";

export default async function PlanningPage({ searchParams }: PageProps<"/planning">) {
  const params = await searchParams;
  const week = typeof params.week === "string" ? params.week : null;
  const start = weekStart(week);
  const from = localToUtc(isoDate(start), "00:00");
  const to = localToUtc(isoDate(addDays(start, 7)), "00:00");

  const [events, subjects, google] = await Promise.all([
    listEventsBetween(from, to),
    listSubjects(),
    getGoogleStatus().catch(() => null),
  ]);

  return (
    <WeekView
      weekStart={isoDate(start)}
      events={events}
      subjects={subjects}
      googleConnected={!!google}
      lastSyncedAt={google?.last_synced_at ?? null}
    />
  );
}
