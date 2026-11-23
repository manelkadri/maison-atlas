"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/use-hydrated";
import { isApiMode } from "@/lib/api-config";
import { queryKeys } from "@/lib/query-keys";
import { authService, getErrorMessage } from "@/services";
import { useAdminSessionStore } from "@/stores/admin-session.store";

/** Squelette plein écran affiché pendant l'hydratation ou la redirection (jamais de flash du contenu admin). */
export function ShellSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="bg-background flex min-h-dvh">
      <span className="sr-only">Chargement de l&apos;administration…</span>
      <div className="bg-sidebar hidden w-64 shrink-0 flex-col gap-3 p-4 lg:flex">
        <Skeleton className="bg-sidebar-accent h-9 w-40" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="bg-sidebar-accent h-9 w-full" />
        ))}
      </div>
      <div className="flex-1">
        <div className="bg-background h-14 border-b" />
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-56" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * GARDE DE SESSION SIMULÉE (mode mock) — NON SÉCURISÉE.
 * Elle ne fait que lire un drapeau stocké dans le navigateur (sessionStorage) : n'importe qui peut le modifier,
 * et le contenu du bundle reste accessible. Elle reproduit seulement le parcours de connexion de la phase 1.
 */
function MockSessionGuard({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const isAuthenticated = useAdminSessionStore((s) => s.isAuthenticated);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace("/admin/login");
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || !isAuthenticated) return <ShellSkeleton />;
  return <>{children}</>;
}

/**
 * Garde de session RÉELLE (mode API) : la session est le cookie httpOnly, vérifié par le serveur via `authService.me()`.
 * Le store local n'est qu'un miroir d'affichage. Ce contrôle améliore l'expérience ; la vraie protection reste
 * le 401 renvoyé par chaque route `/api/admin/*`.
 */
function ApiSessionGuard({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const login = useAdminSessionStore((s) => s.login);
  const logout = useAdminSessionStore((s) => s.logout);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => authService.me(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data === null) {
      logout();
      router.replace("/admin/login");
    } else if (data) {
      login(data.email);
    }
  }, [data, login, logout, router]);

  if (isError) {
    return (
      <div role="alert" className="bg-background flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-medium">Impossible de vérifier votre session.</p>
        <p className="text-muted-foreground max-w-md text-sm">{getErrorMessage(error)}</p>
        <Button type="button" variant="outline" onClick={() => void refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }
  if (!hydrated || isPending || !data) return <ShellSkeleton />;
  return <>{children}</>;
}

export function SessionGuard({ children }: { children: ReactNode }) {
  // Constante pour toute la durée de vie de l'application : jamais de changement de hooks entre deux rendus.
  return isApiMode() ? <ApiSessionGuard>{children}</ApiSessionGuard> : <MockSessionGuard>{children}</MockSessionGuard>;
}
