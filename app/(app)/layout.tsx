import { AppNav } from "@/components/nav/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AppNav />
      <main className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">{children}</main>
    </div>
  );
}
