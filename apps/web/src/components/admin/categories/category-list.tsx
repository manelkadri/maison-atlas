"use client";

import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, CornerDownRight, FolderPlus, FolderTree, Lock, Pencil, Plus, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { ProductThumb } from "@/components/admin/products/product-thumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ToneBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useArchiveCategory, useCategories, useRestoreCategory } from "@/features/categories/hooks";
import { buildCategoryRows, type CategoryRow } from "@/features/categories/tree";
import { useProducts } from "@/features/products/hooks";
import { useDebouncedValue } from "@/features/products/use-debounced-value";
import { getErrorMessage } from "@/services";
import type { Category } from "@/types/product.types";
import { CategoryFormDialog, type CategoryDialogState } from "./category-form-dialog";

type PendingConfirm = { kind: "archive" | "restore"; row: CategoryRow } | null;

const LOCKED_MESSAGE = "Collection système : elle ne peut être ni archivée ni supprimée.";

function RowActions({
  row,
  parentArchived,
  busy,
  onEdit,
  onAddChild,
  onArchive,
  onRestore,
}: {
  row: CategoryRow;
  parentArchived: boolean;
  busy: boolean;
  onEdit: () => void;
  onAddChild: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const c = row.category;
  const locked = c.kind === "collection";
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={onEdit} disabled={busy} aria-label={`Modifier ${c.name}`}>
            <Pencil aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Modifier</TooltipContent>
      </Tooltip>

      {row.depth === 0 && c.kind === "category" && !c.isArchived && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onAddChild} disabled={busy} aria-label={`Ajouter une sous-catégorie à ${c.name}`}>
              <FolderPlus aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ajouter une sous-catégorie</TooltipContent>
        </Tooltip>
      )}

      {locked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} role="img" aria-label={LOCKED_MESSAGE} className="text-muted-foreground flex size-8 items-center justify-center rounded-md">
              <Lock className="size-4" aria-hidden />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-60">{LOCKED_MESSAGE}</TooltipContent>
        </Tooltip>
      ) : c.isArchived ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onRestore} disabled={busy} aria-label={`Restaurer ${c.name}`}>
              <ArchiveRestore aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{parentArchived ? "Restaurer (la catégorie parente est archivée)" : "Restaurer"}</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onArchive} disabled={busy} aria-label={`Archiver ${c.name}`} className="text-destructive hover:text-destructive">
              <Archive aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Archiver</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function StatusBadge({ category }: { category: Category }) {
  return category.isArchived ? <ToneBadge tone="warning">Archivée</ToneBadge> : <ToneBadge tone="success">Active</ToneBadge>;
}

function NameCell({ row }: { row: CategoryRow }) {
  const c = row.category;
  return (
    <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: row.depth * 20 }}>
      {row.depth > 0 && <CornerDownRight className="text-muted-foreground size-4 shrink-0" aria-hidden />}
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{c.name}</span>
          {c.kind === "collection" && (
            <ToneBadge tone="info">
              <Lock className="size-3" aria-hidden /> Collection
            </ToneBadge>
          )}
        </p>
        {c.description && <p className="text-muted-foreground line-clamp-1 text-xs">{c.description}</p>}
        {row.depth === 0 && row.childCount > 0 && (
          <p className="text-muted-foreground text-xs">
            {row.childCount} sous-catégorie{row.childCount > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function ProductCount({ row }: { row: CategoryRow }) {
  if (row.category.kind === "collection") return <span className="text-muted-foreground">—</span>;
  return (
    <span className="tabular-nums">
      {row.productCount}
      {row.depth === 0 && row.childCount > 0 && <span className="text-muted-foreground text-xs"> ({row.treeProductCount} avec sous-cat.)</span>}
    </span>
  );
}

export function CategoryList() {
  const categories = useCategories(true);
  const products = useProducts();
  const archive = useArchiveCategory();
  const restore = useRestoreCategory();

  const [searchInput, setSearchInput] = useState("");
  const [showArchived, setShowArchived] = useState(true);
  const [dialog, setDialog] = useState<CategoryDialogState | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const search = useDebouncedValue(searchInput, 250);

  const all = useMemo(() => categories.data ?? [], [categories.data]);
  const productList = useMemo(() => products.data ?? [], [products.data]);
  const rows = useMemo(() => buildCategoryRows(all, productList, { search, includeArchived: showArchived }), [all, productList, search, showArchived]);
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);

  const parentArchived = (c: Category) => !!c.parentId && !!byId.get(c.parentId)?.isArchived;

  const onConfirm = async (): Promise<void> => {
    if (!confirm) return;
    const { kind, row } = confirm;
    const c = row.category;
    setBusyId(c.id);
    try {
      if (kind === "archive") {
        await archive.mutateAsync(c.id);
        toast.success(row.childCount > 0 ? `« ${c.name} » et ses sous-catégories ont été archivées.` : `« ${c.name} » a été archivée.`);
      } else {
        await restore.mutateAsync(c.id);
        toast.success(`« ${c.name} » a été restaurée.`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  };

  const archiveCount = confirm?.kind === "archive" ? confirm.row : undefined;
  const confirmBusy = !!confirm && busyId === confirm.row.category.id;

  const renderActions = (row: CategoryRow) => (
    <RowActions
      row={row}
      parentArchived={parentArchived(row.category)}
      busy={busyId === row.category.id}
      onEdit={() => setDialog({ mode: "edit", category: row.category })}
      onAddChild={() => setDialog({ mode: "create", parentId: row.category.id })}
      onArchive={() => setConfirm({ kind: "archive", row })}
      onRestore={() => setConfirm({ kind: "restore", row })}
    />
  );

  return (
    <>
      <PageHeader
        title="Catégories"
        description="Organisez la boutique en catégories et sous-catégories."
        actions={
          <Button onClick={() => setDialog({ mode: "create", parentId: null })}>
            <Plus aria-hidden /> Nouvelle catégorie
          </Button>
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between" role="search" aria-label="Filtrer les catégories">
          <div className="relative w-full sm:max-w-sm">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <Input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Rechercher une catégorie…" aria-label="Rechercher une catégorie" className="pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="show-archived" checked={showArchived} onCheckedChange={(v) => setShowArchived(v === true)} />
            <Label htmlFor="show-archived" className="text-sm font-normal">
              Afficher les catégories archivées
            </Label>
          </div>
        </div>

        {categories.isPending && (
          <div className="space-y-3 p-4" role="status" aria-label="Chargement des catégories">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}

        {categories.isError && (
          <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <TriangleAlert className="text-destructive size-6" aria-hidden />
            <p className="text-sm font-medium">Impossible de charger les catégories.</p>
            <p className="text-muted-foreground text-sm">{getErrorMessage(categories.error)}</p>
            <Button variant="outline" size="sm" onClick={() => void categories.refetch()}>
              <RefreshCw aria-hidden /> Réessayer
            </Button>
          </div>
        )}

        {categories.data && rows.length === 0 && (
          <div className="p-4">
            <EmptyState
              icon={FolderTree}
              title={search.trim() ? "Aucun résultat" : "Aucune catégorie"}
              description={search.trim() ? "Aucune catégorie ne correspond à cette recherche." : "Créez une première catégorie pour classer vos produits."}
              action={
                search.trim() ? (
                  <Button variant="outline" onClick={() => setSearchInput("")}>
                    Effacer la recherche
                  </Button>
                ) : (
                  <Button onClick={() => setDialog({ mode: "create", parentId: null })}>
                    <Plus aria-hidden /> Nouvelle catégorie
                  </Button>
                )
              }
            />
          </div>
        )}

        {categories.data && rows.length > 0 && (
          <>
            <div className="hidden md:block">
              <Table>
                <TableCaption className="sr-only">
                  Arborescence des catégories : {rows.length} ligne{rows.length > 1 ? "s" : ""}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20 pl-4">
                      <span className="sr-only">Image</span>
                    </TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Produits</TableHead>
                    <TableHead className="text-right">Ordre</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.category.id} className={row.category.isArchived ? "opacity-70" : undefined}>
                      <TableCell className="pl-4">
                        <ProductThumb src={row.category.imageUrl || undefined} alt={`Image de ${row.category.name}`} className="size-10" />
                      </TableCell>
                      <TableCell className="max-w-[20rem]">
                        <NameCell row={row} />
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{row.category.slug}</TableCell>
                      <TableCell>
                        <ProductCount row={row} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.category.displayOrder}</TableCell>
                      <TableCell>
                        <StatusBadge category={row.category} />
                      </TableCell>
                      <TableCell className="pr-4">{renderActions(row)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y md:hidden">
              {rows.map((row) => (
                <li key={row.category.id} className={row.category.isArchived ? "p-4 opacity-70" : "p-4"}>
                  <div className="flex items-start gap-3" style={{ paddingLeft: row.depth * 16 }}>
                    <ProductThumb src={row.category.imageUrl || undefined} alt={`Image de ${row.category.name}`} className="size-12" />
                    <div className="min-w-0 flex-1">
                      <NameCell row={{ ...row, depth: 0 }} />
                      <p className="text-muted-foreground mt-1 font-mono text-xs">{row.category.slug}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <StatusBadge category={row.category} />
                        <span className="text-muted-foreground">
                          {row.category.kind === "collection" ? "Collection" : `${row.productCount} produit${row.productCount > 1 ? "s" : ""}`} · ordre {row.category.displayOrder}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">{renderActions(row)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {dialog && <CategoryFormDialog key={dialog.mode === "edit" ? dialog.category.id : `new-${dialog.parentId ?? "root"}`} state={dialog} categories={all} onClose={() => setDialog(null)} />}

      <ConfirmDialog
        open={confirm?.kind === "archive"}
        onOpenChange={(o) => !o && !confirmBusy && setConfirm(null)}
        title="Archiver cette catégorie ?"
        variant="destructive"
        confirmLabel="Archiver"
        isPending={confirmBusy}
        description={
          <div className="space-y-2">
            <p>« {archiveCount?.category.name} » sera retirée de la boutique.</p>
            {archiveCount && archiveCount.childCount > 0 && (
              <p>
                Ses <strong>{archiveCount.childCount} sous-catégorie{archiveCount.childCount > 1 ? "s" : ""}</strong> seront archivée{archiveCount.childCount > 1 ? "s" : ""} avec elle.
              </p>
            )}
            {archiveCount && archiveCount.treeProductCount > 0 && (
              <p>
                {archiveCount.treeProductCount} produit{archiveCount.treeProductCount > 1 ? "s sont rattachés" : " est rattaché"} à cette arborescence : ils ne sont pas supprimés, mais pensez à les reclasser.
              </p>
            )}
            <p className="text-muted-foreground text-xs">Vous pourrez la restaurer à tout moment (les sous-catégories se restaurent une à une).</p>
          </div>
        }
        onConfirm={onConfirm}
      />
      <ConfirmDialog
        open={confirm?.kind === "restore"}
        onOpenChange={(o) => !o && !confirmBusy && setConfirm(null)}
        title="Restaurer cette catégorie ?"
        confirmLabel="Restaurer"
        isPending={confirmBusy}
        description={<p>« {confirm?.row.category.name} » redeviendra active dans la boutique.</p>}
        onConfirm={onConfirm}
      />
    </>
  );
}
