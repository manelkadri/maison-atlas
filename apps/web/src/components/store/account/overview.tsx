"use client";

import { formatDate, formatDZD } from "@fashion/shared";
import { ArrowRight, Heart, Package, ShoppingBag, UserRound } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount, useMyOrders } from "@/features/account/hooks";

const quickLinks = [
  { label: "Mes commandes", description: "Suivre et consulter vos achats", href: "/account/orders", icon: Package },
  { label: "Mon profil", description: "Modifier vos informations", href: "/account/profile", icon: UserRound },
  { label: "Mes favoris", description: "Retrouver les pièces enregistrées", href: "/favorites", icon: Heart },
  { label: "Continuer mes achats", description: "Découvrir la boutique", href: "/shop", icon: ShoppingBag },
] as const;

export function AccountOverview() {
  const { data: profile } = useAccount();
  const { data, isLoading, isError } = useMyOrders(!!profile);
  if (!profile) return null;

  // Le serveur ne renvoie que les commandes de la cliente connectée (identité = session).
  const sorted = [...(data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const last = sorted[0];

  return (
    <div className="space-y-12">
      <header>
        <p className="eyebrow">Mon espace</p>
        <h1 className="font-display mt-2 text-3xl sm:text-4xl">Bonjour, {profile.firstName}</h1>
        <p className="text-muted-foreground mt-2">Voici un aperçu de votre activité.</p>
      </header>

      <section aria-labelledby="account-summary" className="space-y-4">
        <h2 id="account-summary" className="font-display text-xl">
          Résumé
        </h2>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2" role="status">
            <span className="sr-only">Chargement de vos commandes…</span>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : isError ? (
          <p className="text-destructive text-sm" role="alert">
            Impossible de charger vos commandes pour le moment. Veuillez réessayer.
          </p>
        ) : sorted.length === 0 || !last ? (
          <EmptyState
            icon={Package}
            title="Aucune commande pour le moment"
            description="Vos commandes apparaîtront ici dès que vous en aurez passé une."
            action={
              <Link href="/shop" className="text-sm font-medium underline underline-offset-4">
                Découvrir la boutique
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-card rounded-md border p-5">
              <p className="text-muted-foreground text-sm">Commandes passées</p>
              <p className="font-display mt-2 text-4xl tabular-nums">{sorted.length}</p>
            </div>
            <Link href={`/account/orders/${last.orderNumber}`} className="bg-card hover:bg-accent/40 group block rounded-md border p-5 transition-colors">
              <p className="text-muted-foreground text-sm">Dernière commande</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="font-medium">{last.orderNumber}</span>
                <OrderStatusBadge status={last.status} />
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                {formatDate(last.createdAt)} · <span className="tabular-nums">{formatDZD(last.total)}</span>
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 group-hover:underline">
                Voir le détail <ArrowRight className="size-4" aria-hidden />
              </span>
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="account-links" className="space-y-4">
        <h2 id="account-links" className="font-display text-xl">
          Accès rapides
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {quickLinks.map(({ label, description, href, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="bg-card hover:bg-accent/40 flex min-h-20 items-center gap-4 rounded-md border p-4 transition-colors">
                <span className="bg-secondary flex size-11 shrink-0 items-center justify-center rounded-full">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="text-muted-foreground block text-sm">{description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
