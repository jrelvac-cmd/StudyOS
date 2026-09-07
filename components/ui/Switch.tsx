"use client";

import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
};

export function Switch({ checked, onChange, label, className }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn("pressable inline-flex items-center gap-2.5 text-sm", checked ? "text-text" : "text-text-2", className)}
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors",
          checked ? "border-accent bg-accent" : "border-border-strong bg-surface-3",
        )}
      >
        <span
          className={cn(
            "switch-knob absolute left-0.5 h-5 w-5 rounded-full",
            checked ? "translate-x-4 bg-black" : "translate-x-0 bg-text-2",
          )}
        />
      </span>
      {label}
    </button>
  );
}
