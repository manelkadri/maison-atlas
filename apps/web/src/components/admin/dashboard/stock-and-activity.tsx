import Link from "next/link";
import { formatDateTime } from "@fashion/shared";
import { ArrowRight, CheckCircle2, Package, PackageX, Shirt, ShoppingBag, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ColorSwatch } from "@/components/ui/color-swatch";
import { EmptyState } from "@/components/ui/empty-state";
import { ADMIN_ROOT } from "@/config/admin-nav";
import { ProductThumb } from "@/components/admin/products/product-thumb";
import type { ActivityEvent } from "@/types/analytics.types";
import type { InventoryItem } from "@/types/inventory.types";

const OUT_OF_STOCK_HREF = `${ADMIN_ROOT}/inventory?status=out_of_stock`;

/** Variantes en rupture (dernières 8) avec lien vers la gestion des stocks filtrée. */
export function OutOfStockList({ items, total }: { items: InventoryItem[]; total: number }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">Variantes en rupture</h2>
        <Link href={OUT_OF_STOCK_HREF} className="text-brand inline-flex items-center gap-1 text-xs font-medium hover:underline">
          Gérer les stocks <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Aucune rupture" description="Toutes les variantes ont du stock." className="m-4 border-0" />
      ) : (
        <ul className="divide-y">
          {items.map((i) => (
            <li key={i.variantId}>
              <Link href={OUT_OF_STOCK_HREF} className="hover:bg-accent/50 flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <ProductThumb src={i.imageUrl} alt="" className="size-10" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{i.productName}</span>
                  <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <ColorSwatch color={i.colorCode} className="size-3" />
                    {i.color} · {i.size} · {i.sku}
                  </span>
                </span>
                <span className="bg-destructive-soft text-destructive inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                  <PackageX className="size-3" aria-hidden /> Rupture
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > items.length && (
        <p className="text-muted-foreground border-t px-4 py-2 text-xs sm:px-5">
          + {total - items.length} autre{total - items.length > 1 ? "s" : ""} variante{total - items.length > 1 ? "s" : ""} en rupture
        </p>
      )}
    </Card>
  );
}

const activityIcon = { order: ShoppingBag, stock: Package, product: Shirt, customer: Users } as const;

/** Flux d'activités récentes (commandes, mouvements de stock). */
export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="border-b px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">Activité récente</h2>
      </div>
      {events.length === 0 ? (
        <EmptyState title="Aucune activité" description="Les commandes et mouvements de stock récents apparaîtront ici." className="m-4 border-0" />
      ) : (
        <ol className="divide-y">
          {events.map((e) => {
            const Icon = activityIcon[e.type];
            return (
              <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
                <span className="bg-secondary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                  <Icon className="text-muted-foreground size-3.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug break-words">{e.message}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{formatDateTime(e.at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
