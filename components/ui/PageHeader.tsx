import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, children, className }: Props) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-3 px-5 pt-6 pb-4 md:px-8 md:pt-8", className)}>
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-3">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
