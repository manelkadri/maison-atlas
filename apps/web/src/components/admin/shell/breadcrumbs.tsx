"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useSyncExternalStore } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ADMIN_SEGMENT_LABELS } from "@/config/admin-nav";
import { cn } from "@/lib/utils";

/* ---------- Libellés dynamiques (segments d'URL comme un identifiant produit) ---------- */

type Labels = Readonly<Record<string, string>>;

let labels: Labels = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): Labels => labels;

/**
 * Associe un libellé lisible à un segment dynamique du fil d'Ariane.
 * `href` est l'URL complète du segment, ex. `/admin/dashboard/products/prod_12` ; `label` peut être
 * undefined pendant le chargement (le fil d'Ariane affiche alors « Détail »).
 */
export function useBreadcrumbLabel(href: string, label: string | undefined): void {
  useEffect(() => {
    if (!label) return;
    labels = { ...labels, [href]: label };
    emit();
    return () => {
      const { [href]: _removed, ...rest } = labels;
      labels = rest;
      emit();
    };
  }, [href, label]);
}

/* ---------- Construction du fil d'Ariane ---------- */

export type Crumb = { href: string; label: string; current: boolean };

/** Fonction pure : transforme un pathname admin en fil d'Ariane. */
export function buildBreadcrumbs(pathname: string, dynamicLabels: Labels = {}): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "admin") segments.shift();
  let href = "/admin";
  const crumbs = segments.map((segment) => {
    href += `/${segment}`;
    return { href, label: dynamicLabels[href] ?? ADMIN_SEGMENT_LABELS[segment] ?? "Détail", current: false };
  });
  const last = crumbs[crumbs.length - 1];
  if (last) last.current = true;
  return crumbs;
}

export function AdminBreadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const dynamicLabels = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const crumbs = buildBreadcrumbs(pathname, dynamicLabels);
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb className={cn("min-w-0", className)}>
      <BreadcrumbList className="flex-nowrap gap-1.5 text-sm sm:gap-2">
        {crumbs.map((crumb, index) => {
          // Sur mobile, seuls les deux derniers niveaux sont affichés.
          const hiddenOnMobile = index < crumbs.length - 2;
          return (
            <Fragment key={crumb.href}>
              {index > 0 && <BreadcrumbSeparator className={cn(hiddenOnMobile && "hidden sm:block")} />}
              <BreadcrumbItem className={cn("min-w-0", hiddenOnMobile && "hidden sm:inline-flex")}>
                {crumb.current ? (
                  <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href} className="truncate">
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
