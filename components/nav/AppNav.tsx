"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, FileText, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/planning", label: "Planning", icon: CalendarDays },
  { href: "/bibliotheque", label: "Bibliothèque", icon: BookOpen, match: ["/bibliotheque", "/cours", "/chapitres"] },
  { href: "/agent", label: "Agent", icon: MessageSquare },
  { href: "/fiches", label: "Fiches", icon: FileText },
  { href: "/reglages", label: "Réglages", icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();
  const isActive = (tab: (typeof TABS)[number]) =>
    (tab.match ?? [tab.href]).some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <>
      {/* Barre latérale (ordinateur) */}
      <aside className="chrome sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border px-3 py-5 md:flex">
        <Link href="/planning" className="mb-6 flex items-center gap-2 px-3">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="text-base font-semibold tracking-tight">StudyOS</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {TABS.map((tab) => {
            const active = isActive(tab);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "pressable flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  active ? "bg-accent-dim text-accent" : "text-text-2 hover:bg-surface-2 hover:text-text",
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Barre basse (téléphone) */}
      <nav className="chrome fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "pressable pressable-strong flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                active ? "text-accent" : "text-text-3",
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
