"use client";

import { DatabaseBackup } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useResetDemoData } from "@/features/settings/hooks";
import { getErrorMessage } from "@/services";

/** Réinitialisation des données de démonstration (action destructive, confirmée). */
export function DemoDataSection() {
  const reset = useResetDemoData();
  const [open, setOpen] = useState(false);

  const confirm = async () => {
    try {
      await reset.mutateAsync();
      toast.success("Données de démonstration réinitialisées.");
      setOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <div className="space-y-3 text-sm">
        <p className="bg-warning-soft text-warning rounded-md px-3 py-2">
          Toutes les données de cette application (produits, commandes, clients, stocks) sont <strong>fictives</strong> et stockées uniquement dans ce navigateur.
        </p>
        <p className="text-muted-foreground">
          La réinitialisation remet les produits, commandes, stocks, clients, promotions et paramètres à leurs valeurs d&apos;origine. Les modifications effectuées seront perdues.
        </p>
        <Button type="button" variant="destructive" className="h-auto min-h-9 max-w-full py-2 whitespace-normal" onClick={() => setOpen(true)}>
          <DatabaseBackup aria-hidden /> Réinitialiser les données de démonstration
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Réinitialiser les données de démonstration ?"
        variant="destructive"
        confirmLabel="Oui, tout réinitialiser"
        isPending={reset.isPending}
        onConfirm={confirm}
        description={
          <div className="space-y-2">
            <p>Cette action est irréversible. Elle remet aux valeurs d&apos;origine :</p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>les produits, variantes et leurs stocks ;</li>
              <li>les commandes et leur historique ;</li>
              <li>les clients, promotions et paramètres de la boutique.</li>
            </ul>
          </div>
        }
      />
    </>
  );
}
