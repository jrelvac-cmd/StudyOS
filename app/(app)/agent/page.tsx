import type { Metadata } from "next";
import { Chat } from "@/components/agent/Chat";
import { embeddingsAvailable } from "@/lib/ai/embeddings";
import { countCourses } from "@/lib/db/courses";

export const metadata: Metadata = { title: "Agent" };
export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const courseCount = await countCourses().catch(() => 0);
  return <Chat courseCount={courseCount} semantic={embeddingsAvailable()} />;
}
