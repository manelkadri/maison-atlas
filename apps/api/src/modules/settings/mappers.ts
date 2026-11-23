import type { Prisma, StoreSettings as StoreSettingsRow } from "@prisma/client";
import type { StoreSettings } from "@fashion/types";
import { settingsFormSchema } from "@fashion/validators";
import { DEFAULT_SETTINGS } from "./defaults";

/** Ligne Prisma → StoreSettings. Les colonnes JSON sont revalidées ; en cas de corruption, on retombe sur les valeurs par défaut. */
export function toStoreSettings(row: StoreSettingsRow): StoreSettings {
  const social = settingsFormSchema.shape.social.safeParse(row.social);
  const fees = settingsFormSchema.shape.shippingFees.safeParse(row.shippingFees);
  return {
    storeName: row.storeName,
    tagline: row.tagline,
    logoUrl: row.logoUrl,
    phone: row.phone,
    email: row.email,
    address: row.address,
    openingHours: row.openingHours,
    plusCode: row.plusCode,
    whatsapp: row.whatsapp,
    social: social.success ? social.data : DEFAULT_SETTINGS.social,
    currency: "DZD",
    shippingFees: fees.success ? fees.data : DEFAULT_SETTINGS.shippingFees,
    freeShippingThreshold: row.freeShippingThreshold,
    defaultAlertThreshold: row.defaultAlertThreshold,
  };
}

/** StoreSettings → données Prisma (sans `currency`, qui n'est pas stockée : la devise est toujours le DZD). */
export function toSettingsData(settings: Omit<StoreSettings, "currency">): Omit<Prisma.StoreSettingsUncheckedCreateInput, "id"> {
  return {
    storeName: settings.storeName,
    tagline: settings.tagline,
    logoUrl: settings.logoUrl,
    phone: settings.phone,
    email: settings.email,
    address: settings.address,
    openingHours: settings.openingHours,
    plusCode: settings.plusCode,
    whatsapp: settings.whatsapp,
    social: settings.social,
    shippingFees: settings.shippingFees,
    freeShippingThreshold: settings.freeShippingThreshold,
    defaultAlertThreshold: settings.defaultAlertThreshold,
  };
}
