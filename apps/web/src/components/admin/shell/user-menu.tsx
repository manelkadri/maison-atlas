"use client";

import Link from "next/link";
import { LogOut, Settings, Store } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_ROOT } from "@/config/admin-nav";
import { useAdminLogout } from "@/features/auth/hooks";
import { isApiMode } from "@/lib/api-config";
import { useAdminSessionStore } from "@/stores/admin-session.store";

/** Initiales (2 lettres max) à partir de l'e-mail de la session. */
export function getInitials(email: string | null | undefined): string {
  if (!email) return "PR";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : local.slice(0, 2);
  return (letters || "PR").toUpperCase();
}

export function UserMenu() {
  const email = useAdminSessionStore((s) => s.email);
  const onLogout = useAdminLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu du profil">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{getInitials(email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">Propriétaire</p>
          <p className="text-muted-foreground truncate text-xs">{email ?? "—"}</p>
          {!isApiMode() && <p className="text-warning mt-1 text-[0.7rem]">Session de démonstration (simulée)</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`${ADMIN_ROOT}/settings`}>
            <Settings aria-hidden /> Paramètres
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/" target="_blank" rel="noopener noreferrer">
            <Store aria-hidden /> Voir la boutique
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} variant="destructive">
          <LogOut aria-hidden /> Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
