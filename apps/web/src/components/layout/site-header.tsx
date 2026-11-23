"use client";

import Link from "next/link";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { useSettings } from "@/features/settings/hooks";
import type { Category } from "@/types/product.types";
import type { StoreSettings } from "@/types/settings.types";
import { StoreLogo, isRenderableLogo } from "@/components/ui/store-logo";
import { cn } from "@/lib/utils";
import { HeaderActions } from "./header-actions";
import { MainNav, MainNavFallback } from "./main-nav";
import { MobileMenu } from "./mobile-menu";

type SiteHeaderProps = {
  initialSettings?: StoreSettings;
  categories: Category[];
};

/** Header sticky : menu mobile, logo (serif), navigation principale, recherche / compte / favoris / panier. */
export function SiteHeader({ initialSettings, categories }: SiteHeaderProps) {
  const { data: settings } = useSettings(initialSettings);
  const storeName = settings?.storeName || siteConfig.name;
  const hasLogo = isRenderableLogo(settings?.logoUrl);

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
      {/* Un logo image demande un en-tête plus haut pour rester lisible. */}
      <div className={cn("container-store flex items-center gap-1 sm:gap-2", hasLogo ? "h-20 lg:h-24" : "h-16 lg:h-[72px]")}>
        {/* useSearchParams (lien actif) impose une limite Suspense. */}
        <Suspense fallback={<span className="size-11 lg:hidden" aria-hidden />}>
          <MobileMenu storeName={storeName} logoUrl={settings?.logoUrl} categories={categories} />
        </Suspense>

        <Link
          href="/"
          className="font-display focus-visible:outline-ring mr-auto flex min-w-0 items-center truncate rounded-sm px-1 text-xl tracking-tight sm:text-2xl lg:mr-0 lg:w-64"
          aria-label={`${storeName} — accueil`}
        >
          <StoreLogo logoUrl={settings?.logoUrl} storeName={storeName} imageClassName="h-14 max-w-48 lg:h-[4.5rem] lg:max-w-64" />
        </Link>

        <div className="hidden flex-1 justify-center lg:flex">
          <Suspense fallback={<MainNavFallback className="flex" />}>
            <MainNav className="flex" />
          </Suspense>
        </div>

        <HeaderActions className="lg:w-56 lg:justify-end" />
      </div>
    </header>
  );
}
