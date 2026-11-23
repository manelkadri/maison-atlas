"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { formatDZD, getPickupPointsForWilaya, getShippingFee, getWilaya } from "@fashion/shared";
import { checkoutSchema, type CheckoutFormValues } from "@fashion/validators";
import { AlertTriangle, Banknote, Building2, Home, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { applyCartReconciliation } from "@/features/cart/apply-reconciliation";
import { useCartTotals } from "@/features/cart/hooks";
import { buildCreateOrderInput, isCartConflictError } from "@/features/checkout/place-order";
import { useCreateOrder } from "@/features/orders/hooks";
import { useProducts } from "@/features/products/hooks";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services";
import { useCartStore } from "@/stores/cart.store";
import { useCustomerSessionStore } from "@/stores/customer-session.store";
import { usePlacedOrdersStore } from "@/stores/placed-orders.store";
import type { DeliveryMethod } from "@/types/order.types";
import { OrderSummary } from "./order-summary";
import { WilayaSelect } from "./wilaya-select";

const FORM_ID = "checkout-form";
const NOTE_MAX = 300;

type CheckoutFormProps = {
  initialValues: CheckoutFormValues;
  /** Appelé juste avant la redirection : le parent évite d'afficher « panier vide » pendant ce temps. */
  onPlaced: () => void;
};

type ServerFeedback = { message: string; details: string[] };

function SectionCard({ title, step, children }: { title: string; step: number; children: React.ReactNode }) {
  return (
    <section className="bg-card border-border rounded-lg border p-5 sm:p-6">
      <h2 className="mb-5 flex items-center gap-3 text-lg font-medium">
        <span className="bg-foreground text-background flex size-6 items-center justify-center rounded-full text-xs tabular-nums" aria-hidden>
          {step}
        </span>
        <span className="font-display">{title}</span>
      </h2>
      {children}
    </section>
  );
}

export function CheckoutForm({ initialValues, onPlaced }: CheckoutFormProps) {
  const router = useRouter();
  const setShipping = useCartStore((s) => s.setShipping);
  const clearCart = useCartStore((s) => s.clear);
  const email = useCustomerSessionStore((s) => s.profile?.email);
  const createOrder = useCreateOrder();
  const productsQuery = useProducts({ onlyPublic: true });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({ resolver: zodResolver(checkoutSchema), defaultValues: initialValues, mode: "onTouched" });

  const wilayaCode = useWatch({ control, name: "wilayaCode" });
  const method = useWatch({ control, name: "deliveryMethod" });
  const note = useWatch({ control, name: "note" }) ?? "";
  const totals = useCartTotals({ wilayaCode, method });

  const lock = useRef(false);
  const [feedback, setFeedback] = useState<ServerFeedback | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  const pickupPoints = getPickupPointsForWilaya(wilayaCode);
  const wilaya = getWilaya(wilayaCode);
  const busy = isSubmitting || createOrder.isPending;

  const field = (name: keyof CheckoutFormValues) => ({
    id: `checkout-${name}`,
    "aria-invalid": !!errors[name] || undefined,
    "aria-describedby": errors[name] ? `checkout-${name}-error` : undefined,
  });

  const feeFor = (m: DeliveryMethod) => (totals.settings ? getShippingFee(totals.settings, wilayaCode, m, totals.subtotal) : undefined);

  const submitOrder = async (values: CheckoutFormValues) => {
    if (lock.current) return; // anti double-clic
    lock.current = true;
    setFeedback(null);
    try {
      const input = buildCreateOrderInput({ values, items: totals.items, promoCode: totals.promo.activeCode, email });
      const order = await createOrder.mutateAsync(input);
      // Mémorise (numéro, téléphone) sur l'appareil : c'est ce qui permet de suivre la commande sans compte.
      usePlacedOrdersStore.getState().remember({ orderNumber: order.orderNumber, phone: input.customer.phone, createdAt: order.createdAt });
      onPlaced();
      clearCart();
      toast.success(`Commande ${order.orderNumber} enregistrée`, { description: "Nous vous appelons très bientôt pour la confirmer." });
      router.replace(`/order-confirmation?number=${encodeURIComponent(order.orderNumber)}`);
      // Le verrou reste actif : on quitte la page.
    } catch (error) {
      lock.current = false;
      if (isCartConflictError(error)) {
        // Stock ou produit modifié depuis l'ajout au panier : on réconcilie sans toucher aux champs saisis.
        const fresh = await productsQuery.refetch();
        const result = applyCartReconciliation(fresh.data ?? productsQuery.data ?? [], { removeInvalid: true });
        setFeedback({
          message: error.message,
          details: [
            ...Object.values(result.issues).map((i) => `${i.message} Article retiré de votre panier.`),
            ...result.notices.map((n) => n.message),
          ],
        });
        toast.error("Votre panier a été mis à jour");
      } else {
        const message = getErrorMessage(error);
        setFeedback({ message, details: [] });
        toast.error(message);
      }
    }
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-12 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="lg:order-2 lg:self-stretch">
        <OrderSummary
          totals={totals}
          formId={FORM_ID}
          isSubmitting={busy}
          shippingHint={wilaya ? `${wilaya.name} · ${method === "home" ? "à domicile" : "en bureau"}` : undefined}
        />
      </div>

      <form id={FORM_ID} onSubmit={(event) => void handleSubmit(submitOrder)(event)} noValidate className="space-y-6 lg:order-1" aria-label="Informations de commande">
        {feedback && (
          <div
            ref={feedbackRef}
            tabIndex={-1}
            role="alert"
            className="border-destructive/30 bg-destructive-soft rounded-md border p-4 text-sm outline-none"
          >
            <p className="flex items-start gap-2.5 font-medium">
              <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
              {feedback.message}
            </p>
            {feedback.details.length > 0 && (
              <ul className="text-muted-foreground mt-2 ml-6.5 list-disc space-y-1 pl-4">
                {feedback.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            <p className="text-muted-foreground mt-2 ml-6.5">Vos informations sont conservées. Vérifiez le récapitulatif puis validez à nouveau.</p>
          </div>
        )}

        <SectionCard step={1} title="Vos coordonnées">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nom" htmlFor="checkout-lastName" error={errors.lastName?.message} required>
              <Input {...register("lastName")} {...field("lastName")} autoComplete="family-name" className="h-11" />
            </FormField>
            <FormField label="Prénom" htmlFor="checkout-firstName" error={errors.firstName?.message} required>
              <Input {...register("firstName")} {...field("firstName")} autoComplete="given-name" className="h-11" />
            </FormField>
            <FormField
              label="Téléphone"
              htmlFor="checkout-phone"
              error={errors.phone?.message}
              hint="Le livreur et notre équipe vous appelleront sur ce numéro."
              required
              className="sm:col-span-2"
            >
              <Input {...register("phone")} {...field("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="0555 12 34 56" className="h-11" />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard step={2} title="Livraison">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Wilaya" htmlFor="checkout-wilayaCode" error={errors.wilayaCode?.message} required>
              <Controller
                control={control}
                name="wilayaCode"
                render={({ field: f }) => (
                  <WilayaSelect
                    id="checkout-wilayaCode"
                    ref={f.ref}
                    value={f.value}
                    invalid={!!errors.wilayaCode}
                    describedBy={errors.wilayaCode ? "checkout-wilayaCode-error" : undefined}
                    onChange={(code) => {
                      f.onChange(code);
                      // Le bureau choisi n'appartient plus à la wilaya : on le réinitialise.
                      setValue("pickupPointId", undefined, { shouldValidate: false });
                      setShipping({ wilayaCode: code });
                    }}
                  />
                )}
              />
            </FormField>
            <FormField label="Commune" htmlFor="checkout-commune" error={errors.commune?.message} required>
              <Input {...register("commune")} {...field("commune")} autoComplete="address-level2" className="h-11" />
            </FormField>
          </div>

          <fieldset className="mt-6">
            <legend className="mb-3 text-sm font-medium">Mode de livraison</legend>
            <Controller
              control={control}
              name="deliveryMethod"
              render={({ field: f }) => (
                <RadioGroup
                  value={f.value}
                  onValueChange={(value) => {
                    f.onChange(value);
                    setShipping({ method: value as DeliveryMethod });
                  }}
                  className="grid gap-3 sm:grid-cols-2"
                  aria-label="Mode de livraison"
                >
                  {(
                    [
                      { value: "home", label: "Livraison à domicile", hint: "Chez vous, à l'adresse indiquée", icon: Home },
                      { value: "pickup_point", label: "Livraison en bureau", hint: "Retrait dans le bureau de votre choix", icon: Building2 },
                    ] as const
                  ).map(({ value, label, hint, icon: Icon }) => {
                    const fee = feeFor(value);
                    return (
                      <label
                        key={value}
                        htmlFor={`delivery-${value}`}
                        className={cn(
                          "flex min-h-20 cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors",
                          f.value === value ? "border-foreground ring-foreground bg-background ring-1" : "border-input hover:border-foreground/50",
                        )}
                      >
                        <RadioGroupItem id={`delivery-${value}`} value={value} className="mt-0.5" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2 text-sm font-medium">
                            <span className="flex items-center gap-1.5">
                              <Icon className="size-4" aria-hidden />
                              {label}
                            </span>
                            <span className="tabular-nums">{fee === undefined ? "—" : fee === 0 ? "Offerte" : formatDZD(fee)}</span>
                          </span>
                          <span className="text-muted-foreground mt-1 block text-xs">{hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              )}
            />
          </fieldset>

          <div className="mt-6 space-y-4">
            {method === "home" ? (
              <FormField label="Adresse complète" htmlFor="checkout-address" error={errors.address?.message} hint="Rue, numéro, quartier, repère utile pour le livreur." required>
                <Textarea {...register("address")} {...field("address")} rows={3} autoComplete="street-address" />
              </FormField>
            ) : (
              <FormField label="Bureau de livraison" htmlFor="checkout-pickupPointId" error={errors.pickupPointId?.message} required>
                <Controller
                  control={control}
                  name="pickupPointId"
                  render={({ field: f }) => (
                    <Select value={f.value || undefined} onValueChange={f.onChange}>
                      <SelectTrigger
                        id="checkout-pickupPointId"
                        ref={f.ref}
                        aria-invalid={!!errors.pickupPointId || undefined}
                        aria-describedby={errors.pickupPointId ? "checkout-pickupPointId-error" : undefined}
                        className="bg-card h-11 w-full"
                      >
                        <SelectValue placeholder={`Choisir un bureau à ${wilaya?.name ?? "votre wilaya"}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {pickupPoints.map((point) => (
                          <SelectItem key={point.id} value={point.id}>
                            {point.name} — {point.address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            )}

            <FormField
              label="Remarque (facultative)"
              htmlFor="checkout-note"
              error={errors.note?.message}
              hint="Un horaire préféré, un étage, une consigne pour le livreur…"
            >
              <Textarea {...register("note")} {...field("note")} rows={2} maxLength={NOTE_MAX} />
              <p className="text-muted-foreground text-right text-xs tabular-nums" aria-live="polite">
                {note.length} / {NOTE_MAX}
              </p>
            </FormField>
          </div>
        </SectionCard>

        <SectionCard step={3} title="Paiement">
          <div className="border-foreground bg-background ring-foreground flex items-start gap-3 rounded-md border p-4 ring-1">
            <Banknote className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="text-sm">
              <p className="font-medium">Paiement à la livraison (Cash on Delivery)</p>
              <p className="text-muted-foreground mt-1 leading-relaxed">
                Aucun paiement en ligne. Vous réglez le montant total en espèces au livreur, à la réception de votre commande, après l&apos;avoir vérifiée. C&apos;est
                le seul mode de paiement proposé.
              </p>
            </div>
          </div>
        </SectionCard>

        <div className="lg:hidden">
          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy || totals.shippingFee === undefined}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Lock aria-hidden />}
            {busy ? "Enregistrement…" : "Confirmer la commande"}
          </Button>
          <p className="text-muted-foreground mt-3 text-center text-xs">
            En confirmant, vous acceptez que nous vous appelions pour valider la commande.
          </p>
        </div>
      </form>
    </div>
  );
}
