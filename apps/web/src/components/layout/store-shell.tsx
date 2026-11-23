import type { ReactNode } from "react";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { categoryService, settingsService } from "@/services";
import { AnnouncementBar } from "./announcement-bar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** Enveloppe de la boutique (Server Component) : annonce, header sticky, contenu, footer. */
export async function StoreShell({ children }: { children: ReactNode }) {
  const [settings, categories] = await Promise.all([settingsService.getSettings(), categoryService.getCategories()]);
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#contenu"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-4 py-2 text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Aller au contenu
      </a>
      <AnnouncementBar />
      <SiteHeader initialSettings={settings} categories={categories} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter initialSettings={settings} />
      <WhatsAppButton initialSettings={settings} />
    </div>
  );
}
