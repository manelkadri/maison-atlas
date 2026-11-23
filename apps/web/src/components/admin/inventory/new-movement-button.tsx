"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useInventory } from "@/features/inventory/hooks";
import { MovementDialog } from "./movement-dialog";

/** Bouton global « Nouveau mouvement » (en-tête de page) : la variante se choisit dans le formulaire. */
export function NewMovementButton() {
  const [open, setOpen] = useState(false);
  const { data } = useInventory();
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!data || data.length === 0}>
        <Plus aria-hidden /> Nouveau mouvement
      </Button>
      <MovementDialog open={open} onOpenChange={setOpen} items={data ?? []} />
    </>
  );
}
