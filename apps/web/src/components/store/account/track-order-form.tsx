"use client";

import { phoneSchema } from "@fashion/validators";
import { Loader2, Search } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { getErrorMessage, orderService } from "@/services";
import { usePlacedOrdersStore } from "@/stores/placed-orders.store";
import type { Order } from "@/types/order.types";

type TrackOrderFormProps = {
  initialOrderNumber?: string;
  /** Appelé quand la commande est retrouvée (elle est déjà mémorisée sur l'appareil). */
  onFound?: (order: Order) => void;
};

/**
 * « Suivre une commande » : numéro + téléphone.
 * Sert à retrouver une commande passée depuis un autre appareil. Si le couple correspond, il est mémorisé sur cet
 * appareil. Le message d'échec est unique (numéro inconnu ou téléphone différent) : rien n'est révélé.
 */
export function TrackOrderForm({ initialOrderNumber = "", onFound }: TrackOrderFormProps) {
  const uid = useId();
  const remember = usePlacedOrdersStore((s) => s.remember);
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const number = orderNumber.trim().toUpperCase();
    if (!number) return setError("Saisissez le numéro de commande.");
    const parsedPhone = phoneSchema.safeParse(phone);
    if (!parsedPhone.success) return setError(parsedPhone.error.issues[0]?.message ?? "Numéro de téléphone invalide.");

    setError(null);
    setPending(true);
    try {
      const order = await orderService.getOrderByNumber(number, parsedPhone.data);
      if (!order) {
        setError("Aucune commande ne correspond à ce numéro et à ce téléphone. Vérifiez vos informations.");
        return;
      }
      remember({ orderNumber: order.orderNumber, phone: parsedPhone.data, createdAt: order.createdAt });
      setPhone("");
      toast.success(`Commande ${order.orderNumber} retrouvée`);
      onFound?.(order);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
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
            autoComplete="tel"
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
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
        {pending ? "Recherche…" : "Suivre ma commande"}
      </Button>
    </form>
  );
}
