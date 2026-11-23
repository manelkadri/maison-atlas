"use client";

import { formatDZD, formatDate } from "@fashion/shared";
import { Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeletePromotion, usePromotions, useUpdatePromotion } from "@/features/promotions/hooks";
import {
  PROMOTION_STATUS_LABELS,
  filterPromotions,
  formatPromotionValue,
  getPromotionStatus,
  type PromotionStatus,
  type PromotionStatusFilter,
} from "@/features/promotions/logic";
import { getErrorMessage } from "@/services";
import type { Promotion } from "@/types/promotion.types";
import { CopyCodeButton } from "./copy-code-button";
import { PromoTester } from "./promo-tester";
import { PromotionDialog } from "./promotion-dialog";
import { PromotionStatusBadge } from "./promotion-status-badge";

export function PromotionsView() {
  const { data, isLoading, isError, error, refetch } = usePromotions();
  const update = useUpdatePromotion();
  const remove = useDeletePromotion();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PromotionStatusFilter>("all");
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Promotion | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const visible = useMemo(() => filterPromotions(data ?? [], { search, status }, now), [data, search, status, now]);

  const toggle = async (promo: Promotion, isActive: boolean) => {
    setTogglingId(promo.id);
    try {
      await update.mutateAsync({ id: promo.id, data: { isActive } });
      toast.success(`Code ${promo.code} ${isActive ? "activé" : "désactivé"}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(`Code ${deleting.code} supprimé.`);
      setDeleting(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isFiltered = search.trim() !== "" || status !== "all";

  return (
    <div className="space-y-4">
      <PromoTester />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un code ou un libellé" aria-label="Rechercher un code promo" className="pl-9" />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as PromotionStatusFilter)}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Filtrer par statut">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {(Object.keys(PROMOTION_STATUS_LABELS) as PromotionStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {PROMOTION_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> Nouveau code
          </Button>
        </div>

        <div className="border-t">
          {isLoading ? (
            <div className="space-y-2 p-4" aria-busy="true" aria-label="Chargement des promotions">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-4">
              <EmptyState
                icon={Tag}
                title="Impossible de charger les promotions"
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
                icon={Tag}
                title={isFiltered ? "Aucun code ne correspond" : "Aucun code promo"}
                description={isFiltered ? "Modifiez votre recherche ou le filtre de statut." : "Créez votre premier code pour offrir une réduction à vos clients."}
                action={
                  isFiltered ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch("");
                        setStatus("all");
                      }}
                    >
                      Réinitialiser les filtres
                    </Button>
                  ) : (
                    <Button onClick={() => setCreating(true)}>
                      <Plus aria-hidden /> Nouveau code
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableCaption className="sr-only">Codes promotionnels</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Réduction</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead className="text-right">Minimum</TableHead>
                      <TableHead className="text-right">Utilisations</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actif</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-sm font-semibold">{p.code}</span>
                            <CopyCodeButton code={p.code} />
                          </div>
                          <p className="text-muted-foreground max-w-56 truncate text-xs" title={p.label}>
                            {p.label}
                          </p>
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{formatPromotionValue(p)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(p.startsAt)} → {formatDate(p.endsAt)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">{p.minOrderAmount > 0 ? formatDZD(p.minOrderAmount) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.usageCount}</TableCell>
                        <TableCell>
                          <PromotionStatusBadge status={getPromotionStatus(p, now)} />
                        </TableCell>
                        <TableCell>
                          <Switch checked={p.isActive} disabled={togglingId === p.id} onCheckedChange={(v) => void toggle(p, v)} aria-label={`Activer le code ${p.code}`} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => setEditing(p)} aria-label={`Modifier le code ${p.code}`} title="Modifier">
                              <Pencil aria-hidden />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(p)} aria-label={`Supprimer le code ${p.code}`} title="Supprimer">
                              <Trash2 className="text-destructive" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="grid gap-3 p-3 sm:grid-cols-2 lg:hidden" aria-label="Codes promotionnels">
                {visible.map((p) => (
                  <li key={p.id} className="bg-card rounded-lg border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-semibold">{p.code}</span>
                          <CopyCodeButton code={p.code} />
                        </div>
                        <p className="text-muted-foreground text-xs">{p.label}</p>
                      </div>
                      <PromotionStatusBadge status={getPromotionStatus(p, now)} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-3 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Réduction</dt>
                        <dd className="text-sm font-semibold">{formatPromotionValue(p)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Utilisations</dt>
                        <dd className="text-sm font-semibold tabular-nums">{p.usageCount}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Période</dt>
                        <dd>
                          {formatDate(p.startsAt)} → {formatDate(p.endsAt)}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Montant minimum</dt>
                        <dd>{p.minOrderAmount > 0 ? formatDZD(p.minOrderAmount) : "Aucun"}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                      <label className="flex items-center gap-2 text-xs">
                        <Switch checked={p.isActive} disabled={togglingId === p.id} onCheckedChange={(v) => void toggle(p, v)} />
                        {p.isActive ? "Actif" : "Inactif"}
                      </label>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                          <Pencil aria-hidden /> Modifier
                        </Button>
                        <Button variant="outline" size="icon-sm" onClick={() => setDeleting(p)} aria-label={`Supprimer le code ${p.code}`}>
                          <Trash2 className="text-destructive" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Card>

      <PromotionDialog key="create" open={creating} onOpenChange={setCreating} />
      <PromotionDialog key={editing?.id ?? "edit"} open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} promotion={editing} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Supprimer ce code promo ?"
        variant="destructive"
        confirmLabel="Supprimer"
        isPending={remove.isPending}
        onConfirm={confirmDelete}
        description={
          deleting && (
            <p>
              Le code <strong className="font-mono">{deleting.code}</strong> sera supprimé définitivement ({deleting.usageCount} utilisation(s) enregistrée(s)). Les commandes déjà passées conservent leur remise. Pour le suspendre
              sans le perdre, désactivez-le plutôt.
            </p>
          )
        }
      />
    </div>
  );
}
