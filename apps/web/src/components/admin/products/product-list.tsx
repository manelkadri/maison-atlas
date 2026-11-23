"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate } from "@fashion/shared";
import { PackageSearch, Plus, RefreshCw, Shirt, Star, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { TablePagination } from "@/components/admin/table-pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { ToneBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ADMIN_ROOT } from "@/config/admin-nav";
import { useCategories } from "@/features/categories/hooks";
import { getCategoryPath, getProductCategoryOptions } from "@/features/categories/tree";
import {
  DEFAULT_PRODUCT_FILTERS,
  PRODUCTS_PAGE_SIZE,
  filterAndSortProducts,
  getProductStatus,
  getStockSummary,
  paginateProducts,
  type ProductListFilters,
  type ProductPublicationStatus,
} from "@/features/products/list-utils";
import { useArchiveProduct, useDeleteProduct, useProducts, useRestoreProduct, useSetPublished } from "@/features/products/hooks";
import { useDebouncedValue } from "@/features/products/use-debounced-value";
import { ServiceError, getErrorMessage } from "@/services";
import type { Product } from "@/types/product.types";
import { ProductFilters } from "./product-filters";
import { ProductRowActions, type ProductAction } from "./product-row-actions";
import { ProductThumb } from "./product-thumb";

const STATUS_BADGE: Record<ProductPublicationStatus, { label: string; tone: "success" | "neutral" | "warning" }> = {
  published: { label: "Publié", tone: "success" },
  draft: { label: "Brouillon", tone: "neutral" },
  archived: { label: "Archivé", tone: "warning" },
};

type PendingConfirm = { kind: "archive" | "delete" | "restore"; product: Product } | null;

function StockCell({ product }: { product: Product }) {
  const s = getStockSummary(product);
  return (
    <div className="space-y-1">
      <p className="font-medium tabular-nums">
        {s.total} <span className="text-muted-foreground text-xs font-normal">en stock</span>
      </p>
      <p className="text-muted-foreground text-xs">
        {s.variantCount} variante{s.variantCount > 1 ? "s" : ""}
      </p>
      {s.outVariants > 0 && (
        <ToneBadge tone="danger">
          {s.outVariants} en rupture
        </ToneBadge>
      )}
    </div>
  );
}

export function ProductList() {
  const products = useProducts();
  const categories = useCategories(true);
  const setPublished = useSetPublished();
  const archive = useArchiveProduct();
  const restore = useRestoreProduct();
  const remove = useDeleteProduct();

  const [filters, setFilters] = useState<ProductListFilters>(DEFAULT_PRODUCT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const search = useDebouncedValue(searchInput, 250);

  const categoryList = useMemo(() => categories.data ?? [], [categories.data]);
  const categoryOptions = useMemo(() => getProductCategoryOptions(categoryList), [categoryList]);
  const all = useMemo(() => products.data ?? [], [products.data]);

  const filtered = useMemo(() => filterAndSortProducts(all, { ...filters, search }, categoryList), [all, filters, search, categoryList]);
  const pageData = paginateProducts(filtered, page, PRODUCTS_PAGE_SIZE);

  const setFilter = <K extends keyof ProductListFilters>(key: K, value: ProductListFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilters(DEFAULT_PRODUCT_FILTERS);
    setSearchInput("");
    setPage(1);
  };

  const categoryName = (id: string) => getCategoryPath(categoryList, id) || "—";

  const run = async (product: Product, task: () => Promise<unknown>, successMessage: string): Promise<boolean> => {
    setBusyId(product.id);
    try {
      await task();
      toast.success(successMessage);
      return true;
    } catch (err) {
      const conflict = err instanceof ServiceError && err.code === "CONFLICT";
      toast.error(getErrorMessage(err), conflict ? { description: "Utilisez plutôt « Archiver » pour retirer ce produit de la boutique." } : undefined);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const togglePublished = (product: Product, isPublished: boolean) =>
    run(
      product,
      () => setPublished.mutateAsync({ id: product.id, isPublished }),
      isPublished ? `« ${product.name} » est maintenant publié.` : `« ${product.name} » repasse en brouillon.`,
    );

  const onAction = (action: ProductAction, product: Product) => {
    if (action === "publish") void togglePublished(product, true);
    else if (action === "unpublish") void togglePublished(product, false);
    else if (action === "archive") setConfirm({ kind: "archive", product });
    else if (action === "restore") setConfirm({ kind: "restore", product });
    else setConfirm({ kind: "delete", product });
  };

  const onConfirm = async (): Promise<void> => {
    if (!confirm) return;
    const { kind, product } = confirm;
    if (kind === "archive") await run(product, () => archive.mutateAsync(product.id), `« ${product.name} » a été archivé.`);
    if (kind === "restore") await run(product, () => restore.mutateAsync(product.id), `« ${product.name} » a été restauré (en brouillon).`);
    if (kind === "delete") await run(product, () => remove.mutateAsync(product.id), `« ${product.name} » a été supprimé définitivement.`);
    // En cas d'échec, on referme aussi : l'erreur est affichée dans un toast.
    setConfirm(null);
  };

  const confirmPending = confirm !== null && busyId === confirm.product.id;
  const hasFilters = filters.categoryId !== "all" || filters.publication !== "all" || filters.stock !== "all" || filters.includeArchived || search.trim() !== "";

  return (
    <>
      <PageHeader
        title="Produits"
        description="Gérez le catalogue : fiches, prix, variantes et publication."
        actions={
          <Button asChild>
            <Link href={`${ADMIN_ROOT}/products/new`}>
              <Plus aria-hidden /> Ajouter un produit
            </Link>
          </Button>
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <ProductFilters
          filters={filters}
          searchInput={searchInput}
          onSearchChange={(v) => {
            setSearchInput(v);
            setPage(1);
          }}
          onFilterChange={setFilter}
          onReset={resetFilters}
          categoryOptions={categoryOptions}
        />

        {products.isPending && (
          <div className="space-y-3 p-4" role="status" aria-label="Chargement des produits">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {products.isError && (
          <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <TriangleAlert className="text-destructive size-6" aria-hidden />
            <p className="text-sm font-medium">Impossible de charger les produits.</p>
            <p className="text-muted-foreground text-sm">{getErrorMessage(products.error)}</p>
            <Button variant="outline" size="sm" onClick={() => void products.refetch()}>
              <RefreshCw aria-hidden /> Réessayer
            </Button>
          </div>
        )}

        {products.data && all.length === 0 && (
          <div className="p-4">
            <EmptyState
              icon={Shirt}
              title="Aucun produit"
              description="Créez votre premier produit pour commencer à vendre."
              action={
                <Button asChild>
                  <Link href={`${ADMIN_ROOT}/products/new`}>
                    <Plus aria-hidden /> Ajouter un produit
                  </Link>
                </Button>
              }
            />
          </div>
        )}

        {products.data && all.length > 0 && filtered.length === 0 && (
          <div className="p-4">
            <EmptyState
              icon={PackageSearch}
              title="Aucun résultat"
              description="Aucun produit ne correspond à ces critères."
              action={
                hasFilters ? (
                  <Button variant="outline" onClick={resetFilters}>
                    Réinitialiser les filtres
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}

        {products.data && filtered.length > 0 && (
          <>
            {/* Tableau (≥ md) */}
            <div className="hidden md:block">
              <Table>
                <TableCaption className="sr-only">
                  Liste des produits : {filtered.length} résultat{filtered.length > 1 ? "s" : ""}, page {pageData.page} sur {pageData.totalPages}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20 pl-4">
                      <span className="sr-only">Image</span>
                    </TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead className="w-14 pr-4">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.items.map((p) => {
                    const status = getProductStatus(p);
                    const badge = STATUS_BADGE[status];
                    const busy = busyId === p.id;
                    return (
                      <TableRow key={p.id} data-state={busy ? "busy" : undefined} className={busy ? "opacity-60" : undefined}>
                        <TableCell className="pl-4">
                          <ProductThumb src={p.images[0]?.url} alt={p.images[0]?.alt ?? p.name} />
                        </TableCell>
                        <TableCell className="max-w-[16rem]">
                          <Link href={`${ADMIN_ROOT}/products/${p.id}/edit`} className="hover:text-brand line-clamp-2 font-medium underline-offset-4 hover:underline">
                            {p.name}
                          </Link>
                          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            {p.reference}
                            {p.isFeatured && (
                              <span className="text-warning inline-flex items-center gap-0.5">
                                <Star className="size-3 fill-current" aria-hidden /> Vedette
                              </span>
                            )}
                          </p>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[12rem] text-sm">{categoryName(p.categoryId)}</TableCell>
                        <TableCell>
                          <Price price={p.price} compareAtPrice={p.compareAtPrice} size="sm" />
                        </TableCell>
                        <TableCell>
                          <StockCell product={p} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ToneBadge tone={badge.tone}>{badge.label}</ToneBadge>
                            {!p.isArchived && (
                              <Switch
                                checked={p.isPublished}
                                disabled={busy}
                                onCheckedChange={(v) => void togglePublished(p, v)}
                                aria-label={p.isPublished ? `Dépublier ${p.name}` : `Publier ${p.name}`}
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{formatDate(p.createdAt)}</TableCell>
                        <TableCell className="pr-4">
                          <ProductRowActions product={p} disabled={busy} onAction={onAction} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Cartes (< md) */}
            <ul className="divide-y md:hidden">
              {pageData.items.map((p) => {
                const status = getProductStatus(p);
                const badge = STATUS_BADGE[status];
                const busy = busyId === p.id;
                const s = getStockSummary(p);
                return (
                  <li key={p.id} className={busy ? "p-4 opacity-60" : "p-4"}>
                    <div className="flex gap-3">
                      <ProductThumb src={p.images[0]?.url} alt={p.images[0]?.alt ?? p.name} className="size-16" />
                      <div className="min-w-0 flex-1">
                        <Link href={`${ADMIN_ROOT}/products/${p.id}/edit`} className="line-clamp-2 font-medium">
                          {p.name}
                        </Link>
                        <p className="text-muted-foreground truncate text-xs">
                          {p.reference} · {categoryName(p.categoryId)}
                        </p>
                        <div className="mt-1">
                          <Price price={p.price} compareAtPrice={p.compareAtPrice} size="sm" />
                        </div>
                      </div>
                      <ProductRowActions product={p} disabled={busy} onAction={onAction} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <ToneBadge tone={badge.tone}>{badge.label}</ToneBadge>
                      <span className="text-muted-foreground tabular-nums">{s.total} en stock</span>
                      {s.outVariants > 0 && <ToneBadge tone="danger">{s.outVariants} en rupture</ToneBadge>}
                      {!p.isArchived && (
                        <label className="ml-auto flex items-center gap-2 text-xs">
                          Publié
                          <Switch checked={p.isPublished} disabled={busy} onCheckedChange={(v) => void togglePublished(p, v)} />
                        </label>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <TablePagination page={pageData.page} pageSize={PRODUCTS_PAGE_SIZE} total={pageData.total} onPageChange={setPage} />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={confirm?.kind === "delete"}
        onOpenChange={(o) => !o && !confirmPending && setConfirm(null)}
        title="Supprimer ce produit définitivement ?"
        variant="destructive"
        confirmLabel="Supprimer"
        isPending={confirmPending}
        description={
          <>
            <p>
              « {confirm?.product.name} » et toutes ses variantes seront supprimés. Cette action est <strong>irréversible</strong>.
            </p>
            <p className="mt-2">Si le produit figure dans des commandes, la suppression sera refusée : archivez-le alors.</p>
          </>
        }
        onConfirm={onConfirm}
      />
      <ConfirmDialog
        open={confirm?.kind === "archive"}
        onOpenChange={(o) => !o && !confirmPending && setConfirm(null)}
        title="Archiver ce produit ?"
        variant="destructive"
        confirmLabel="Archiver"
        isPending={confirmPending}
        description={
          <p>
            « {confirm?.product.name} » sera retiré de la boutique et repassé en brouillon. Les commandes passées sont conservées et vous pourrez le restaurer à tout moment.
          </p>
        }
        onConfirm={onConfirm}
      />
      <ConfirmDialog
        open={confirm?.kind === "restore"}
        onOpenChange={(o) => !o && !confirmPending && setConfirm(null)}
        title="Restaurer ce produit ?"
        confirmLabel="Restaurer"
        isPending={confirmPending}
        description={<p>« {confirm?.product.name} » redeviendra visible dans le catalogue admin, en brouillon. Vous pourrez ensuite le publier.</p>}
        onConfirm={onConfirm}
      />
    </>
  );
}
