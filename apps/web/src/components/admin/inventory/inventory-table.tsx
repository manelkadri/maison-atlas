"use client";

import { ClipboardCheck, History, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/ui/color-swatch";
import { ProductImage } from "@/components/ui/product-image";
import { StockStatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ManualMovementType } from "@/features/inventory/logic";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/types/inventory.types";

export type InventoryAction = { kind: "movement"; type: ManualMovementType; item: InventoryItem } | { kind: "history"; item: InventoryItem };

type Props = {
  items: InventoryItem[];
  onAction: (action: InventoryAction) => void;
};

function StockValue({ item }: { item: InventoryItem }) {
  return (
    <span
      className={cn(
        "text-base font-semibold tabular-nums",
        item.status === "out_of_stock" && "text-destructive",
        item.status === "low" && "text-warning",
      )}
    >
      {item.stock}
    </span>
  );
}

function ProductLink({ item }: { item: InventoryItem }) {
  return (
    <Link
      href={`/admin/dashboard/products/${item.productId}/edit`}
      className="hover:text-brand font-medium underline-offset-2 hover:underline"
    >
      {item.productName}
    </Link>
  );
}

function Thumb({ item }: { item: InventoryItem }) {
  return <ProductImage src={item.imageUrl} alt="" ratio="1/1" className="size-11 shrink-0 rounded-md" sizes="44px" />;
}

function RowActions({ item, onAction, labeled }: { item: InventoryItem; onAction: Props["onAction"]; labeled?: boolean }) {
  const name = `${item.productName}, ${item.color}, ${item.size}`;
  const actions = [
    { label: "Ajouter", full: "Ajouter des quantités", icon: Plus, run: () => onAction({ kind: "movement", type: "in", item }) },
    { label: "Retirer", full: "Retirer du stock", icon: Minus, run: () => onAction({ kind: "movement", type: "out", item }) },
    { label: "Ajuster", full: "Ajustement de stock", icon: ClipboardCheck, run: () => onAction({ kind: "movement", type: "adjustment", item }) },
    { label: "Historique", full: "Historique des mouvements", icon: History, run: () => onAction({ kind: "history", item }) },
  ];
  return (
    <div className={cn(labeled ? "grid grid-cols-2 gap-2" : "flex items-center justify-end gap-1")}>
      {actions.map(({ label, full, icon: Icon, run }) => (
        <Button
          key={label}
          type="button"
          variant={labeled ? "outline" : "ghost"}
          size={labeled ? "default" : "icon-sm"}
          onClick={run}
          aria-label={`${full} — ${name}`}
          title={full}
          className={labeled ? "min-h-10" : undefined}
        >
          <Icon aria-hidden />
          {labeled && label}
        </Button>
      ))}
    </div>
  );
}

export function InventoryTable({ items, onAction }: Props) {
  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <Table>
          <TableCaption className="sr-only">Stock par variante (taille et couleur)</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Couleur</TableHead>
              <TableHead>Taille</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
              <TableHead className="text-right">Seuil</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.variantId}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Thumb item={item} />
                    <ProductLink item={item} />
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <ColorSwatch color={item.colorCode} /> {item.color}
                  </span>
                </TableCell>
                <TableCell>{item.size}</TableCell>
                <TableCell className="text-right">
                  <StockValue item={item} />
                </TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">{item.alertThreshold}</TableCell>
                <TableCell>
                  <StockStatusBadge status={item.status} />
                </TableCell>
                <TableCell>
                  <RowActions item={item} onAction={onAction} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="grid gap-3 p-3 sm:grid-cols-2 lg:hidden" aria-label="Stock par variante">
        {items.map((item) => (
          <li key={item.variantId} className="bg-card rounded-lg border p-3">
            <div className="flex items-start gap-3">
              <Thumb item={item} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <ProductLink item={item} />
                </p>
                <p className="text-muted-foreground font-mono text-xs">{item.sku}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <ColorSwatch color={item.colorCode} /> {item.color}
                  </span>
                  <span>Taille {item.size}</span>
                </p>
              </div>
              <StockStatusBadge status={item.status} />
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Quantité disponible</span>
              <span>
                <StockValue item={item} /> <span className="text-muted-foreground text-xs">(seuil {item.alertThreshold})</span>
              </span>
            </div>
            <div className="mt-3">
              <RowActions item={item} onAction={onAction} labeled />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
