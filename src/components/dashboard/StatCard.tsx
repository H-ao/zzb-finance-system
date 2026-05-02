import { ArrowDown, ArrowUp, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  delta?: number; // percent
  icon: LucideIcon;
  tone?: "primary" | "income" | "expense" | "neutral";
  /** 副标小字，例如 "含 ฿12,000.00 (折 ¥2,520.00)" */
  subValue?: string;
}

const toneStyles: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "bg-primary-soft text-primary",
  income: "bg-income-soft text-income",
  expense: "bg-expense-soft text-expense",
  neutral: "bg-muted text-muted-foreground",
};

export function StatCard({ label, value, delta, icon: Icon, tone = "primary", subValue }: StatCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
          <div className="mt-1 text-sm text-muted-foreground">{label}</div>
          {subValue && (
            <div className="mt-1 truncate text-[11px] text-muted-foreground/80 tabular-nums" title={subValue}>{subValue}</div>
          )}
          {delta !== undefined && (
            <div className={cn("mt-2 flex items-center gap-1 text-xs font-medium tabular-nums",
              positive ? "text-income" : "text-expense")}
            >
              {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(delta).toFixed(2)}%
            </div>
          )}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-full shrink-0", toneStyles[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
