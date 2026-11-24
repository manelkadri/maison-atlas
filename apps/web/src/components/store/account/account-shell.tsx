"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount, useLogout } from "@/features/account/hooks";
import { cn } from "@/lib/utils";
import { AuthPanel, ChangePasswordForm } from "./auth-forms";
import { DemoBanner } from "./demo-banner";

const ACCOUNT_NAV = [
  { label: "Aperçu", href: "/account", exact: true },
  { label: "Commandes", href: "/account/orders", exact: false },
  { label: "Profil", href: "/account/profile", exact: false },
] as const;

/**
 * Espace de la cliente. L'accès est contrôlé PAR LE SERVEUR (cookie de session httpOnly) : ce composant ne fait que choisir
 * quoi afficher selon la réponse de `GET /customers/me`, il ne « protège » rien lui-même.
 * - session absente : connexion / création de compte ;
 * - mot de passe provisoire : seul le formulaire de changement est proposé (le serveur refuse tout le reste) ;
 * - sinon : navigation + page demandée.
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const account = useAccount();
  const logout = useLogout();
  const pathname = usePathname() ?? "";

  if (account.isPending) {
    return (
      <div className="container-store py-12" role="status" aria-live="polite">
        <span className="sr-only">Chargement de votre espace…</span>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-24 w-full max-w-2xl" />
      </div>
    );
  }

  if (account.isError) {
    return (
      <div className="container-store py-12" role="alert">
        <p className="text-destructive">Impossible de vérifier votre session pour le moment.</p>
        <button type="button" onClick={() => void account.refetch()} className="mt-3 min-h-10 text-sm font-medium underline underline-offset-4">
          Réessayer
        </button>
      </div>
    );
  }

  if (!account.data) {
    return (
      <div className="container-store py-12 lg:py-20">
        <DemoBanner className="mx-auto mb-6 max-w-md" />
        <AuthPanel intro="Retrouvez vos commandes et gérez vos informations." />
      </div>
    );
  }

  if (account.data.mustChangePassword) {
    return (
      <div className="container-store py-12 lg:py-20">
        <h1 className="font-display mb-6 text-3xl sm:text-4xl">Choisissez votre mot de passe</h1>
        <ChangePasswordForm forced />
      </div>
    );
  }

  const onSignOut = async () => {
    try {
      await logout.mutateAsync();
    } catch {
      // Session locale vidée quoi qu'il arrive (voir useLogout).
    }
    toast.success("Vous êtes déconnecté");
  };

  return (
    <div className="container-store py-10 lg:py-14">
      <DemoBanner className="mb-8" />
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
        <button
          type="button"
          onClick={() => void onSignOut()}
          className="text-muted-foreground hover:text-foreground -mb-px ml-auto inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-4 text-sm whitespace-nowrap"
        >
          <LogOut className="size-4" aria-hidden />
          Déconnexion
        </button>
      </nav>
      {children}
    </div>
  );
}
