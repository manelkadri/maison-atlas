"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/use-hydrated";
import { isApiMode } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import { useCustomerSessionStore } from "@/stores/customer-session.store";
import { DemoBanner } from "./demo-banner";
import { LoginForm } from "./login-form";

const ACCOUNT_NAV = [
  { label: "Aperçu", href: "/account", exact: true },
  { label: "Commandes", href: "/account/orders", exact: false },
  { label: "Profil", href: "/account/profile", exact: false },
] as const;

/**
 * Garde-fou visuel de l'espace client SIMULÉ : sans profil en session, affiche le formulaire d'accès.
 * Ce n'est PAS une protection : n'importe qui peut modifier le localStorage.
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const profile = useCustomerSessionStore((s) => s.profile);
  const signOut = useCustomerSessionStore((s) => s.signOut);
  const pathname = usePathname() ?? "";

  if (!hydrated) {
    return (
      <div className="container-store py-12" role="status" aria-live="polite">
        <span className="sr-only">Chargement de votre espace…</span>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-24 w-full max-w-2xl" />
      </div>
    );
  }

  // Mode API : les pages de commandes n'ont pas besoin de profil (le suivi repose sur numéro + téléphone mémorisés).
  const ordersWithoutProfile = isApiMode() && (pathname === "/account/orders" || pathname.startsWith("/account/orders/"));

  if (!profile && !ordersWithoutProfile) {
    return (
      <div className="container-store py-12 lg:py-20">
        <LoginForm />
      </div>
    );
  }

  const onSignOut = () => {
    signOut();
    toast.success("Vous êtes déconnecté");
  };

  return (
    <div className="container-store py-10 lg:py-14">
      {!ordersWithoutProfile && <DemoBanner className="mb-8" />}
      <nav aria-label="Espace client" className="mb-10 flex items-center gap-1 overflow-x-auto border-b">
        {ACCOUNT_NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm whitespace-nowrap transition-colors",
                active ? "border-foreground font-medium" : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {item.label}
            </Link>
          );
        })}
        {profile && (
          <button
            type="button"
            onClick={onSignOut}
            className="text-muted-foreground hover:text-foreground -mb-px ml-auto inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-4 text-sm whitespace-nowrap"
          >
            <LogOut className="size-4" aria-hidden />
            Déconnexion
          </button>
        )}
      </nav>
      {children}
    </div>
  );
}
