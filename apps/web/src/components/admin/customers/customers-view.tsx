"use client";

import { formatDZD, formatDate, formatPhone } from "@fashion/shared";
import { RotateCcw, Search, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TablePagination } from "@/components/admin/table-pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToneBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCustomers } from "@/features/customers/hooks";
import {
  CUSTOMERS_PAGE_SIZE,
  CUSTOMER_SORT_LABELS,
  customerName,
  deriveWilayaOptions,
  filterCustomers,
  getWilayaName,
  sortCustomers,
  type CustomerSort,
} from "@/features/customers/logic";
import { getErrorMessage } from "@/services";
import type { CustomerSummary } from "@/types/customer.types";

const href = (c: Pick<CustomerSummary, "id">) => `/admin/dashboard/customers/${c.id}`;

export function CustomersView() {
  const [search, setSearch] = useState("");
  const [wilaya, setWilaya] = useState("all");
  const [sort, setSort] = useState<CustomerSort>("spent_desc");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useCustomers();

  const wilayas = useMemo(() => deriveWilayaOptions(data ?? []), [data]);
  const visible = useMemo(() => sortCustomers(filterCustomers(data ?? [], { search, wilayaCode: wilaya }), sort), [data, search, wilaya, sort]);
  const totalPages = Math.max(1, Math.ceil(visible.length / CUSTOMERS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = visible.slice((currentPage - 1) * CUSTOMERS_PAGE_SIZE, currentPage * CUSTOMERS_PAGE_SIZE);
  const isFiltered = search.trim() !== "" || wilaya !== "all";
  const reset = () => {
    setSearch("");
    setWilaya("all");
    setPage(1);
  };

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="space-y-3 p-3 sm:p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_14rem_14rem]">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Nom, téléphone ou e-mail"
              aria-label="Rechercher un client"
              className="pl-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cust-wilaya" className="sr-only">
              Wilaya
            </Label>
            <Select
              value={wilaya}
              onValueChange={(v) => {
                setWilaya(v);
                setPage(1);
              }}
            >
              <SelectTrigger id="cust-wilaya" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les wilayas</SelectItem>
                {wilayas.map((w) => (
                  <SelectItem key={w.code} value={w.code}>
                    {w.code} — {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cust-sort" className="sr-only">
              Trier par
            </Label>
            <Select value={sort} onValueChange={(v) => setSort(v as CustomerSort)}>
              <SelectTrigger id="cust-sort" className="w-full" aria-label="Trier les clients">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CUSTOMER_SORT_LABELS) as CustomerSort[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    Trier : {CUSTOMER_SORT_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Total des achats = commandes <strong>livrées</strong> uniquement, remises déduites, livraison exclue.
          </p>
          {isFiltered && (
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <RotateCcw aria-hidden /> Réinitialiser les filtres
            </Button>
          )}
        </div>
      </div>

      <div className="border-t">
        {isLoading ? (
          <div className="space-y-2 p-4" aria-busy="true" aria-label="Chargement des clients">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              icon={Users}
              title="Impossible de charger les clients"
              description={getErrorMessage(error)}
              action={
                <Button variant="outline" onClick={() => void refetch()}>
                  Réessayer
                </Button>
              }
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Users}
              title="Aucun client"
              description={isFiltered ? "Aucun client ne correspond à cette recherche." : "Les clients apparaissent dès leur première commande."}
              action={
                isFiltered ? (
                  <Button variant="outline" onClick={reset}>
                    Réinitialiser les filtres
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <CustomersTable customers={pageItems} />
            <TablePagination page={currentPage} pageSize={CUSTOMERS_PAGE_SIZE} total={visible.length} onPageChange={setPage} />
          </>
        )}
      </div>
    </Card>
  );
}

function GuestBadge({ customer }: { customer: CustomerSummary }) {
  return customer.isGuest ? <ToneBadge tone="neutral">Invité</ToneBadge> : null;
}

function CustomersTable({ customers }: { customers: CustomerSummary[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <Table>
          <TableCaption className="sr-only">Liste des clients</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Wilaya</TableHead>
              <TableHead className="text-right">Commandes</TableHead>
              <TableHead className="text-right">Total des achats (livré)</TableHead>
              <TableHead>Dernière commande</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={href(c)} className="hover:text-brand font-medium underline-offset-2 hover:underline">
                      {customerName(c)}
                    </Link>
                    <GuestBadge customer={c} />
                  </div>
                </TableCell>
                <TableCell>
                  <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="underline-offset-2 hover:underline">
                    {formatPhone(c.phone)}
                  </a>
                </TableCell>
                <TableCell className="max-w-52 truncate">
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="underline-offset-2 hover:underline">
                      {c.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{getWilayaName(c.wilayaCode)}</TableCell>
                <TableCell className="text-right tabular-nums">{c.ordersCount}</TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatDZD(c.totalSpent)}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="grid gap-3 p-3 sm:grid-cols-2 lg:hidden" aria-label="Clients">
        {customers.map((c) => (
          <li key={c.id} className="bg-card rounded-lg border p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <Link href={href(c)} className="font-medium underline-offset-2 hover:underline">
                {customerName(c)}
              </Link>
              <GuestBadge customer={c} />
            </div>
            <p className="mt-1 flex flex-col gap-0.5 text-xs">
              <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="underline-offset-2 hover:underline">
                {formatPhone(c.phone)}
              </a>
              {c.email ? (
                <a href={`mailto:${c.email}`} className="text-muted-foreground break-all underline-offset-2 hover:underline">
                  {c.email}
                </a>
              ) : (
                <span className="text-muted-foreground">E-mail : —</span>
              )}
              <span className="text-muted-foreground">{getWilayaName(c.wilayaCode)}</span>
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Commandes</dt>
                <dd className="text-sm font-semibold tabular-nums">{c.ordersCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total livré</dt>
                <dd className="text-sm font-semibold tabular-nums">{formatDZD(c.totalSpent)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Dernière</dt>
                <dd>{c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
