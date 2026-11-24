"use client";

import { phoneSchema } from "@fashion/validators";
import { Loader2, Search } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useTrackOrder } from "@/features/account/hooks";
import { getErrorMessage } from "@/services";
import type { PublicTrackedOrder } from "@/types/order.types";

type TrackOrderFormProps = {
  initialOrderNumber?: string;
  /** Appelé quand le couple (numéro, téléphone) correspond : seule la vue publique minimale est transmise. */
  onFound: (order: PublicTrackedOrder) => void;
};

/**
 * « Suivre une commande » SANS compte : numéro + téléphone. Rien n'est mémorisé sur l'appareil (ni numéro ni téléphone).
 * Le message d'échec est unique (numéro inconnu ou téléphone différent) : rien n'est révélé.
 */
export function TrackOrderForm({ initialOrderNumber = "", onFound }: TrackOrderFormProps) {
  const uid = useId();
  const track = useTrackOrder();
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const number = orderNumber.trim().toUpperCase();
    if (!number) return setError("Saisissez le numéro de commande.");
    const parsedPhone = phoneSchema.safeParse(phone);
    if (!parsedPhone.success) return setError(parsedPhone.error.issues[0]?.message ?? "Numéro de téléphone invalide.");

    setError(null);
    try {
      const order = await track.mutateAsync({ orderNumber: number, phone: parsedPhone.data });
      if (!order) {
        setError("Aucune commande ne correspond à ce numéro et à ce téléphone. Vérifiez vos informations.");
        return;
      }
      setPhone("");
      onFound(order);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate aria-label="Suivre une commande" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Numéro de commande" htmlFor={`${uid}-number`} required>
          <Input
            id={`${uid}-number`}
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="CMD-2026-000123"
            autoComplete="off"
            className="h-11"
          />
        </FormField>
        <FormField label="Téléphone utilisé pour la commande" htmlFor={`${uid}-phone`} required>
          <Input
            id={`${uid}-phone`}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0555 12 34 56"
            className="h-11"
          />
        </FormField>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={track.isPending} className="h-11">
        {track.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
        {track.isPending ? "Recherche…" : "Suivre ma commande"}
      </Button>
    </form>
  );
}
