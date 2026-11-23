"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, Eye, EyeOff, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_ROOT } from "@/config/admin-nav";
import type { Product } from "@/types/product.types";

export type ProductAction = "publish" | "unpublish" | "archive" | "restore" | "delete";

/** Menu d'actions d'une ligne produit : modifier, publier/dépublier, archiver/restaurer, supprimer. */
export function ProductRowActions({ product, disabled, onAction }: { product: Product; disabled?: boolean; onAction: (action: ProductAction, product: Product) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions pour ${product.name}`} disabled={disabled}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`${ADMIN_ROOT}/products/${product.id}/edit`}>
            <Pencil aria-hidden /> Modifier
          </Link>
        </DropdownMenuItem>
        {!product.isArchived &&
          (product.isPublished ? (
            <DropdownMenuItem onSelect={() => onAction("unpublish", product)}>
              <EyeOff aria-hidden /> Dépublier (brouillon)
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => onAction("publish", product)}>
              <Eye aria-hidden /> Publier
            </DropdownMenuItem>
          ))}
        {product.isArchived ? (
          <DropdownMenuItem onSelect={() => onAction("restore", product)}>
            <ArchiveRestore aria-hidden /> Restaurer
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onAction("archive", product)}>
            <Archive aria-hidden /> Archiver
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onAction("delete", product)}>
          <Trash2 aria-hidden /> Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
