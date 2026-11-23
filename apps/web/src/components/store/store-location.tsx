"use client";

import { Clock, MapPin, Phone, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useSettings } from "@/features/settings/hooks";
import { buildMapsEmbedUrl, getMapsQuery } from "@/lib/maps";
import type { StoreSettings } from "@/types/settings.types";

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function InfoRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="bg-brand-soft text-brand flex size-10 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-[1.1rem]" aria-hidden />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">{label}</p>
        <div className="mt-1 text-[0.95rem] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/**
 * Bloc « Nous trouver » : une carte unique (coordonnées à gauche, plan Google Maps à droite).
 * La carte intégrée propose déjà « Ouvrir dans Maps » et l'itinéraire : pas de boutons en double.
 * Les informations viennent des paramètres de la boutique (modifiables dans l'administration).
 */
export function StoreLocation({ initialSettings, headingId }: { initialSettings?: StoreSettings; headingId?: string }) {
  const { data: settings } = useSettings(initialSettings);
  if (!settings) return null;

  const query = getMapsQuery(settings);

  return (
    <div
      role="region"
      aria-labelledby={headingId}
      className="bg-card grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-2xl border shadow-sm lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]"
    >
      <div className="flex flex-col justify-center gap-6 p-6 sm:p-8">
        <p className="font-display text-xl">{settings.storeName}</p>

        <address className="space-y-6 not-italic">
          <InfoRow icon={MapPin} label="Adresse">
            <p className="text-foreground/85">{settings.address}</p>
            {settings.plusCode && (
              <p className="bg-secondary text-muted-foreground mt-2 inline-block rounded-md px-2 py-1 font-mono text-xs">{settings.plusCode}</p>
            )}
          </InfoRow>

          {settings.openingHours && (
            <InfoRow icon={Clock} label="Horaires">
              <p className="text-foreground/85 whitespace-pre-line">{settings.openingHours}</p>
            </InfoRow>
          )}

          {settings.phone && (
            <InfoRow icon={Phone} label="Téléphone">
              <a href={telHref(settings.phone)} className="text-foreground/85 font-medium tabular-nums hover:underline">
                {settings.phone}
              </a>
            </InfoRow>
          )}
        </address>
      </div>

      {query && (
        <div className="bg-secondary relative h-80 border-t sm:h-96 lg:h-auto lg:min-h-[26rem] lg:border-t-0 lg:border-l">
          <iframe
            title={`Carte : emplacement de ${settings.storeName}`}
            src={buildMapsEmbedUrl(query)}
            // Légère désaturation : la carte s'accorde à la palette ivoire / brun de la boutique.
            className="absolute inset-0 size-full border-0 [filter:saturate(0.8)_sepia(0.08)]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
