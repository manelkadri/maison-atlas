"use client";

import { useSettings } from "@/features/settings/hooks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/ui/social-icons";
import type { StoreSettings } from "@/types/settings.types";

/**
 * Bouton WhatsApp flottant, présent sur toutes les pages de la boutique.
 * Animation : anneau qui pulse + léger balancement de l'icône ; désactivée si l'utilisateur
 * préfère réduire les animations (règle globale dans globals.css). Masqué si aucun numéro valide.
 */
export function WhatsAppButton({ initialSettings }: { initialSettings?: StoreSettings }) {
  const { data: settings } = useSettings(initialSettings);
  const storeName = settings?.storeName ?? "la boutique";
  const href = buildWhatsAppUrl(settings?.whatsapp, `Bonjour ${storeName}, je vous contacte depuis votre site.`);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Discuter sur WhatsApp (nouvel onglet)"
      className="group fixed right-4 bottom-24 z-30 flex items-center gap-3 md:right-6 md:bottom-6"
    >
      <span className="bg-card text-foreground pointer-events-none hidden rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 md:block">
        Une question ? Écrivez-nous
      </span>
      <span className="relative flex size-14 items-center justify-center">
        <span aria-hidden className="bg-whatsapp animate-whatsapp-ring absolute inset-0 rounded-full" />
        <span aria-hidden className="bg-whatsapp animate-whatsapp-ring absolute inset-0 rounded-full [animation-delay:1.2s]" />
        <span className="bg-whatsapp animate-whatsapp-wiggle relative flex size-14 items-center justify-center rounded-full text-white shadow-lg transition-transform group-hover:scale-110">
          <WhatsAppIcon className="size-7" />
        </span>
      </span>
    </a>
  );
}
