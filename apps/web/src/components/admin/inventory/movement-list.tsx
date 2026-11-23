"use client";

import { formatDateTime } from "@fashion/shared";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StockMovement } from "@/types/inventory.types";
import { MovementTypeBadge, SignedDelta } from "./movement-type-badge";

function Reference({ value }: { value?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  if (value.startsWith("CMD-")) {
    return (
      <Link href={`/admin/dashboard/orders?search=${encodeURIComponent(value)}`} className="text-brand font-mono text-xs underline-offset-2 hover:underline">
        {value}
      </Link>
    );
  }
  return <span className="font-mono text-xs">{value}</span>;
}

type MovementListProps = {
  movements: StockMovement[];
  /** Mode compact (panneau latéral) : cartes uniquement, sans le nom du produit. */
  compact?: boolean;
};

/** Historique des mouvements : tableau sur grand écran, cartes empilées sinon. */
export function MovementList({ movements, compact = false }: MovementListProps) {
  return (
    <>
      {!compact && (
        <div className="hidden overflow-x-auto lg:block">
          <Table>
            <TableCaption className="sr-only">Historique des mouvements de stock</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Produit / variante</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Variation</TableHead>
                <TableHead>Avant → après</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Référence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
                  <TableCell>
                    <p className="font-medium">{m.productName}</p>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <span className="font-mono">{m.sku}</span> · {m.color} · {m.size}
                    </p>
                  </TableCell>
                  <TableCell>
                    <MovementTypeBadge type={m.type} />
                  </TableCell>
                  <TableCell className="text-right">
                    <SignedDelta delta={m.quantityDelta} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {m.quantityBefore} <ArrowRight className="text-muted-foreground inline size-3.5" aria-label="devient" /> {m.quantityAfter}
                  </TableCell>
                  <TableCell className="max-w-56 truncate" title={m.reason}>
                    {m.reason}
                  </TableCell>
                  <TableCell>
                    <Reference value={m.reference} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ul className={compact ? "space-y-2" : "grid gap-2 p-3 sm:grid-cols-2 lg:hidden"} aria-label="Mouvements de stock">
        {movements.map((m) => (
          <li key={m.id} className="bg-card rounded-md border p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {!compact && <p className="truncate font-medium">{m.productName}</p>}
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
                  <span className="font-mono">{m.sku}</span> · {m.color} · {m.size}
                </p>
              </div>
              <MovementTypeBadge type={m.type} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="tabular-nums">
                {m.quantityBefore} <ArrowRight className="text-muted-foreground inline size-3.5" aria-label="devient" /> {m.quantityAfter}{" "}
                <SignedDelta delta={m.quantityDelta} />
              </p>
              <p className="text-muted-foreground text-xs">{formatDateTime(m.createdAt)}</p>
            </div>
            <p className="text-muted-foreground mt-1.5 text-xs">
              {m.reason}
              {m.reference && (
                <>
                  {" · "}
                  <Reference value={m.reference} />
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
