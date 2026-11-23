import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
};

const toneClasses = {
  default: "bg-secondary text-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
} as const;

/** Carte KPI du dashboard. */
export function StatCard({ label, value, hint, icon: Icon, tone = "default", className }: StatCardProps) {
  return (
    <Card className={cn("gap-0 p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm">{label}</p>
        {Icon && (
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", toneClasses[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </Card>
  );
}
