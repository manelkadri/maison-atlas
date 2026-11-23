"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { SettingsFormValues } from "@fashion/validators";
import { Loader2, Settings as SettingsIcon, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { InstagramIcon, TikTokIcon } from "@/components/ui/social-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSettings, useUpdateSettings } from "@/features/settings/hooks";
import { formValuesToSettings, settingsFormSchemaWithLinks, settingsToFormValues } from "@/features/settings/logic";
import { isApiMode } from "@/lib/api-config";
import { getErrorMessage } from "@/services";
import type { StoreSettings } from "@/types/settings.types";
import { DemoDataSection } from "./demo-data-section";
import { LogoUpload } from "./logo-upload";
import { ShippingZones } from "./shipping-zones";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4 px-5">{children}</CardContent>
    </Card>
  );
}

export function SettingsView() {
  const { data, isLoading, isError, error, refetch } = useSettings();

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Chargement des paramètres">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return (
      <EmptyState
        icon={SettingsIcon}
        title="Impossible de charger les paramètres"
        description={getErrorMessage(error)}
        action={
          <Button variant="outline" onClick={() => void refetch()}>
            Réessayer
          </Button>
        }
      />
    );
  }
  return <SettingsForm settings={data} />;
}

function SettingsForm({ settings }: { settings: StoreSettings }) {
  const update = useUpdateSettings();
  const values = useMemo(() => settingsToFormValues(settings), [settings]);
  const snapshot = JSON.stringify(values);

  const form = useForm<SettingsFormValues>({ resolver: zodResolver(settingsFormSchemaWithLinks), defaultValues: values });
  const { register, control, handleSubmit, reset, formState } = form;
  const { errors, isDirty } = formState;

  // Resynchronise le formulaire quand les paramètres enregistrés changent (après enregistrement ou réinitialisation).
  useEffect(() => {
    reset(JSON.parse(snapshot) as SettingsFormValues);
  }, [snapshot, reset]);

  // Avertit avant de quitter la page avec des modifications non enregistrées.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const storeName = useWatch({ control, name: "storeName" });

  const onSubmit = handleSubmit(
    async (v) => {
      try {
        await update.mutateAsync(formValuesToSettings(v));
        reset(v);
        toast.success("Paramètres enregistrés.");
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    },
    () => toast.error("Certains champs sont invalides : vérifiez les sections signalées."),
  );

  const err = errors;

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Section title="Informations de la boutique" description="Affichées sur la boutique, les e-mails et le bon de commande.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nom de la boutique" htmlFor="st-name" error={err.storeName?.message} required>
              <Input id="st-name" aria-invalid={!!err.storeName} aria-describedby={err.storeName ? "st-name-error" : undefined} {...register("storeName")} />
            </FormField>
            <FormField label="Slogan" htmlFor="st-tagline" error={err.tagline?.message}>
              <Input id="st-tagline" aria-invalid={!!err.tagline} aria-describedby={err.tagline ? "st-tagline-error" : undefined} {...register("tagline")} />
            </FormField>
          </div>
          <div className="space-y-1.5">
            <Label>Logo</Label>
            <Controller control={control} name="logoUrl" render={({ field }) => <LogoUpload value={field.value} onChange={field.onChange} storeName={storeName} />} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-currency">Devise</Label>
            <Input id="st-currency" value="Dinar algérien (DZD)" disabled readOnly className="sm:max-w-xs" />
            <p className="text-muted-foreground text-xs">La devise est fixe : tous les montants sont en dinars algériens.</p>
          </div>
        </Section>

        <Section title="Coordonnées" description="Utilisées pour le contact client et le bon de commande.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Téléphone" htmlFor="st-phone" error={err.phone?.message} required hint="Ex. 0550 12 34 56">
              <Input id="st-phone" type="tel" aria-invalid={!!err.phone} aria-describedby={err.phone ? "st-phone-error" : undefined} {...register("phone")} />
            </FormField>
            <FormField label="E-mail" htmlFor="st-email" error={err.email?.message} required>
              <Input id="st-email" type="email" aria-invalid={!!err.email} aria-describedby={err.email ? "st-email-error" : undefined} {...register("email")} />
            </FormField>
            <FormField label="Numéro WhatsApp" htmlFor="st-whatsapp" error={err.whatsapp?.message} hint="Le bouton WhatsApp de la boutique ouvre une conversation avec ce numéro. Laissez vide pour le masquer.">
              <Input id="st-whatsapp" type="tel" aria-invalid={!!err.whatsapp} aria-describedby={err.whatsapp ? "st-whatsapp-error" : undefined} {...register("whatsapp")} />
            </FormField>
          </div>
          <FormField label="Adresse" htmlFor="st-address" error={err.address?.message} required>
            <Textarea id="st-address" rows={2} aria-invalid={!!err.address} aria-describedby={err.address ? "st-address-error" : undefined} {...register("address")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Horaires d'ouverture" htmlFor="st-hours" error={err.openingHours?.message} hint="Affichés sur la page « Nous trouver » et dans le pied de page.">
              <Textarea id="st-hours" rows={2} aria-invalid={!!err.openingHours} aria-describedby={err.openingHours ? "st-hours-error" : undefined} {...register("openingHours")} />
            </FormField>
            <FormField
              label="Plus Code Google Maps"
              htmlFor="st-pluscode"
              error={err.plusCode?.message}
              hint="Copiez-le depuis la fiche Google Maps de la boutique (ex. 8V36+H8 Aïn Témouchent). À défaut, l'adresse sert à placer la carte."
            >
              <Input id="st-pluscode" aria-invalid={!!err.plusCode} aria-describedby={err.plusCode ? "st-pluscode-error" : undefined} {...register("plusCode")} />
            </FormField>
          </div>
        </Section>

        <Section title="Réseaux sociaux" description="Liens complets (https://…). Laissez vide pour masquer l'icône sur la boutique.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Instagram" htmlFor="st-instagram" error={err.social?.instagram?.message}>
              <div className="relative">
                <InstagramIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
                <Input id="st-instagram" inputMode="url" className="pl-9" placeholder="https://instagram.com/…" aria-invalid={!!err.social?.instagram} aria-describedby={err.social?.instagram ? "st-instagram-error" : undefined} {...register("social.instagram")} />
              </div>
            </FormField>
            <FormField label="TikTok" htmlFor="st-tiktok" error={err.social?.tiktok?.message}>
              <div className="relative">
                <TikTokIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
                <Input id="st-tiktok" inputMode="url" className="pl-9" placeholder="https://tiktok.com/@…" aria-invalid={!!err.social?.tiktok} aria-describedby={err.social?.tiktok ? "st-tiktok-error" : undefined} {...register("social.tiktok")} />
              </div>
            </FormField>
          </div>
        </Section>

        <Section title="Frais de livraison" description="Tarifs par zone et par mode de livraison. La livraison est facturée à part, jamais incluse dans le prix des articles.">
          <ShippingZones register={register} errors={errors} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Seuil de livraison offerte (DA)"
              htmlFor="st-free"
              error={err.freeShippingThreshold?.message}
              hint="Sous-total à partir duquel la livraison est gratuite. 0 = désactivé."
            >
              <Input id="st-free" type="number" inputMode="numeric" min={0} step={500} aria-invalid={!!err.freeShippingThreshold} aria-describedby={err.freeShippingThreshold ? "st-free-error" : undefined} {...register("freeShippingThreshold", { valueAsNumber: true })} />
            </FormField>
            <FormField
              label="Seuil d'alerte de stock par défaut"
              htmlFor="st-alert"
              error={err.defaultAlertThreshold?.message}
              hint="Appliqué aux nouvelles variantes : « Stock faible » à ce niveau ou en dessous."
            >
              <Input id="st-alert" type="number" inputMode="numeric" min={0} aria-invalid={!!err.defaultAlertThreshold} aria-describedby={err.defaultAlertThreshold ? "st-alert-error" : undefined} {...register("defaultAlertThreshold", { valueAsNumber: true })} />
            </FormField>
          </div>
        </Section>

        <div
          className={
            isDirty
              ? "bg-card sticky bottom-3 z-10 flex flex-col gap-3 rounded-lg border p-3 shadow-md sm:flex-row sm:items-center sm:justify-between"
              : "flex justify-end"
          }
        >
          {isDirty && (
            <p role="status" className="text-warning flex items-center gap-2 text-sm font-medium">
              <TriangleAlert className="size-4" aria-hidden /> Modifications non enregistrées
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" disabled={!isDirty || update.isPending} onClick={() => reset(JSON.parse(snapshot) as SettingsFormValues)}>
              Annuler les modifications
            </Button>
            <Button type="submit" disabled={!isDirty || update.isPending}>
              {update.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Enregistrer les paramètres
            </Button>
          </div>
        </div>
      </form>

      {!isApiMode() && (
        <Section title="Données de démonstration" description="Cette application fonctionne avec des données fictives.">
          <DemoDataSection />
        </Section>
      )}
    </div>
  );
}
