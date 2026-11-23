import { WILAYAS, type ShippingZone } from "@fashion/shared";
import { settingsFormSchema, type SettingsFormValues } from "@fashion/validators";
import type { StoreSettings } from "@/types/settings.types";

/** Schéma du formulaire : schéma partagé + contrôle des liens de réseaux sociaux (http/https si renseignés). */
export const settingsFormSchemaWithLinks = settingsFormSchema.superRefine((d, ctx) => {
  for (const key of ["instagram", "tiktok"] as const) {
    const value = d.social[key];
    if (value && !/^https?:\/\/\S+\.\S+/i.test(value)) {
      ctx.addIssue({ code: "custom", path: ["social", key], message: "Lien invalide : il doit commencer par https://" });
    }
  }
});

export function settingsToFormValues(s: StoreSettings): SettingsFormValues {
  return {
    storeName: s.storeName,
    tagline: s.tagline,
    logoUrl: s.logoUrl,
    phone: s.phone,
    email: s.email,
    address: s.address,
    openingHours: s.openingHours,
    plusCode: s.plusCode,
    whatsapp: s.whatsapp,
    social: { ...s.social },
    shippingFees: {
      "1": { ...s.shippingFees["1"] },
      "2": { ...s.shippingFees["2"] },
      "3": { ...s.shippingFees["3"] },
    },
    freeShippingThreshold: s.freeShippingThreshold,
    defaultAlertThreshold: s.defaultAlertThreshold,
  };
}

/** Valeurs du formulaire → paramètres à enregistrer (la devise n'est jamais modifiable). */
export function formValuesToSettings(v: SettingsFormValues): Partial<StoreSettings> {
  return {
    storeName: v.storeName.trim(),
    tagline: v.tagline.trim(),
    logoUrl: v.logoUrl.trim(),
    phone: v.phone.trim(),
    email: v.email.trim(),
    address: v.address.trim(),
    openingHours: v.openingHours.trim(),
    plusCode: v.plusCode.trim(),
    whatsapp: v.whatsapp.trim(),
    social: { instagram: v.social.instagram.trim(), tiktok: v.social.tiktok.trim() },
    shippingFees: v.shippingFees,
    freeShippingThreshold: v.freeShippingThreshold,
    defaultAlertThreshold: v.defaultAlertThreshold,
  };
}

export const ZONE_DESCRIPTIONS: Record<ShippingZone, { title: string; hint: string }> = {
  "1": { title: "Zone 1", hint: "Proche — Alger et wilayas voisines" },
  "2": { title: "Zone 2", hint: "Intermédiaire — nord et hauts plateaux" },
  "3": { title: "Zone 3", hint: "Éloignée — sud et extrême sud" },
};

export function getWilayasOfZone(zone: ShippingZone) {
  return WILAYAS.filter((w) => w.zone === zone);
}
