import { NextResponse } from "next/server";
import { listCoursesForEvent } from "@/lib/db/courses";

export async function GET(_request: Request, { params }: RouteContext<"/api/events/[id]/courses">) {
  const { id } = await params;
  const courses = await listCoursesForEvent(id);
  return NextResponse.json(
    courses.map((c) => ({ id: c.id, title: c.title, status: c.status, classification_status: c.classification_status })),
  );
}
