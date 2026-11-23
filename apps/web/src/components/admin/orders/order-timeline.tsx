import { ORDER_STATUS_LABELS, formatDateTime } from "@fashion/shared";
import { cn } from "@/lib/utils";
import type { OrderStatusEvent } from "@/types/order.types";

/** Historique des statuts : du plus ancien au plus récent, le statut courant est mis en avant. */
export function OrderTimeline({ history }: { history: OrderStatusEvent[] }) {
  return (
    <ol className="space-y-0" aria-label="Historique des statuts">
      {history.map((e, i) => {
        const current = i === history.length - 1;
        return (
          <li key={`${e.status}-${e.at}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
            {i < history.length - 1 && <span className="bg-border absolute top-3 bottom-0 left-[5px] w-px" aria-hidden />}
            <span className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full border-2", current ? "border-primary bg-primary" : "border-border bg-card")} aria-hidden />
            <div className="min-w-0 text-sm">
              <p className={cn(current && "font-semibold")}>
                {ORDER_STATUS_LABELS[e.status]}
                {current && <span className="text-muted-foreground ml-2 text-xs font-normal">(statut actuel)</span>}
              </p>
              <p className="text-muted-foreground text-xs">{formatDateTime(e.at)}</p>
              {e.note && <p className="bg-muted/60 mt-1 rounded px-2 py-1 text-xs">{e.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
