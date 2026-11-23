import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** État vide professionnel : icône, message clair, action suivante. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-14 text-center", className)}>
      {Icon && (
        <div className="bg-secondary mb-4 flex size-12 items-center justify-center rounded-full">
          <Icon className="text-muted-foreground size-5" aria-hidden />
        </div>
      )}
      <h3 className="text-base font-medium">{title}</h3>
      {description && <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
