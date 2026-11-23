"use client";

import Link from "next/link";
import { ExternalLink, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminBreadcrumbs } from "./breadcrumbs";
import { NotificationsMenu } from "./notifications";
import { UserMenu } from "./user-menu";

export function AdminHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="bg-background/90 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label="Ouvrir le menu de navigation">
        <Menu aria-hidden />
      </Button>
      <AdminBreadcrumbs className="flex-1" />
      <div className="flex shrink-0 items-center gap-1">
        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
          <Link href="/" target="_blank" rel="noopener noreferrer">
            Voir la boutique
            <ExternalLink aria-hidden />
            <span className="sr-only">(s&apos;ouvre dans un nouvel onglet)</span>
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon" className="sm:hidden">
          <Link href="/" target="_blank" rel="noopener noreferrer" aria-label="Voir la boutique (nouvel onglet)">
            <ExternalLink aria-hidden />
          </Link>
        </Button>
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
