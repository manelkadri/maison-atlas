import { formatDZD } from "@fashion/shared";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProductMargin } from "@/features/analytics/breakdowns";
import { formatPercent } from "@/features/customers/logic";

const MAX_ROWS = 10;

/** Marge par produit (commandes livrées de la période). */
export function MarginTable({ margins }: { margins: ProductMargin[] }) {
  const rows = margins.slice(0, MAX_ROWS);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="text-base">Marge par produit</CardTitle>
        <CardDescription>
          Commandes livrées de la période, prix de vente moyen constaté et coût d&apos;achat figé. Avant remises par code promo.
          {margins.length > MAX_ROWS && ` Les ${MAX_ROWS} produits les plus rentables sur ${margins.length}.`}
        </CardDescription>
      </CardHeader>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableCaption className="sr-only">Marge brute par produit</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Unités</TableHead>
              <TableHead className="text-right">Prix de vente moyen</TableHead>
              <TableHead className="text-right">Coût d&apos;achat moyen</TableHead>
              <TableHead className="text-right">Marge unitaire</TableHead>
              <TableHead className="text-right">Marge brute</TableHead>
              <TableHead className="text-right">Taux de marge</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.productId}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-right tabular-nums">{m.unitsSold}</TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">{formatDZD(m.averageSellingPrice)}</TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">{formatDZD(m.averageUnitCost)}</TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">{formatDZD(m.averageSellingPrice - m.averageUnitCost)}</TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatDZD(m.grossProfit)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(m.marginRate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y md:hidden" aria-label="Marge par produit">
        {rows.map((m) => (
          <li key={m.productId} className="space-y-2 p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{m.name}</p>
              <p className="text-muted-foreground shrink-0 text-xs tabular-nums">{m.unitsSold} u.</p>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Vente moy.</dt>
                <dd className="tabular-nums">{formatDZD(m.averageSellingPrice)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Coût moy.</dt>
                <dd className="tabular-nums">{formatDZD(m.averageUnitCost)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Marge</dt>
                <dd className="font-semibold tabular-nums">
                  {formatDZD(m.grossProfit)} ({formatPercent(m.marginRate, 0)})
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </Card>
  );
}
