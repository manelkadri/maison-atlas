"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { isRenderableLogo } from "@/components/ui/store-logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { adminNav, isNavItemActive, type AdminNavItem } from "@/config/admin-nav";
import { siteConfig } from "@/config/site";
import { useDashboard } from "@/features/analytics/hooks";
import { useAdminLogout } from "@/features/auth/hooks";
import { useSettings } from "@/features/settings/hooks";
import { cn } from "@/lib/utils";
import { useAdminSessionStore } from "@/stores/admin-session.store";
import { getInitials } from "./user-menu";

type SidebarContentProps = {
  /** Mode icônes (desktop uniquement). */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Appelé après un clic sur un lien (ferme le drawer mobile). */
  onNavigate?: () => void;
};

function NavBadge({ count, collapsed, label }: { count: number; collapsed: boolean; label: string }) {
  if (count <= 0) return null;
  const text = count > 99 ? "99+" : String(count);
  return (
    <span
      className={cn(
        "bg-sidebar-primary text-sidebar-primary-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.7rem] leading-5 font-semibold tabular-nums",
        collapsed && "absolute top-0.5 right-0.5 min-w-4 px-1 text-[0.6rem] leading-4",
      )}
    >
      {text}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  badgeCount,
  onNavigate,
}: {
  item: AdminNavItem;
  active: boolean;
  collapsed: boolean;
  badgeCount: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const badgeLabel = item.badge === "pendingOrders" ? "en attente" : "en rupture";
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "focus-visible:ring-sidebar-ring relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className={cn("size-[1.1rem] shrink-0", active && "text-sidebar-primary")} aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.badge && <span className="ml-auto"><NavBadge count={badgeCount} collapsed={false} label={badgeLabel} /></span>}
      {collapsed && item.badge && <NavBadge count={badgeCount} collapsed label={badgeLabel} />}
    </Link>
  );

  if (!collapsed) return <li>{link}</li>;
  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">
          {item.label}
          {item.badge && badgeCount > 0 ? ` (${badgeCount})` : ""}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

/** Contenu de la sidebar, partagé entre la version desktop fixe et le drawer mobile. */
export function SidebarContent({ collapsed = false, onToggleCollapsed, onNavigate }: SidebarContentProps) {
  const pathname = usePathname();
  const email = useAdminSessionStore((s) => s.email);
  const onLogout = useAdminLogout();
  const dashboard = useDashboard();
  const settings = useSettings();
  const storeName = settings.data?.storeName ?? siteConfig.name;

  const counts = {
    pendingOrders: dashboard.data?.kpis.pendingOrders ?? 0,
    outOfStock: dashboard.data?.kpis.outOfStockVariants ?? 0,
  };

  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full flex-col">
      <div className={cn("border-sidebar-border flex h-14 shrink-0 items-center gap-3 border-b px-4", collapsed && "justify-center px-0")}>
        {isRenderableLogo(settings.data?.logoUrl) ? (
          // Fond clair : le logo reste lisible quelle que soit sa couleur sur la sidebar sombre.
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5">
            <Image src={settings.data.logoUrl} alt="" width={64} height={64} unoptimized className="size-full object-contain" />
          </span>
        ) : (
          <span
            aria-hidden
            className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold"
          >
            {storeName.slice(0, 1).toUpperCase()}
          </span>
        )}
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-white">{storeName}</p>
            <p className="text-sidebar-foreground/60 text-xs">Administration</p>
          </div>
        )}
      </div>

      <nav aria-label="Navigation de l'administration" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {adminNav.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isNavItemActive(item, pathname)}
              collapsed={collapsed}
              badgeCount={item.badge ? counts[item.badge] : 0}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </nav>

      <div className="border-sidebar-border shrink-0 space-y-2 border-t p-3">
        {onToggleCollapsed && (
          <Button
            type="button"
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Déployer le menu" : "Réduire le menu"}
            aria-expanded={!collapsed}
            className={cn("text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white", collapsed ? "mx-auto flex" : "w-full justify-start")}
          >
            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
            {!collapsed && "Réduire le menu"}
          </Button>
        )}

        <div className={cn("flex items-center gap-3 rounded-md p-1", collapsed && "justify-center")}>
          <Avatar className="size-8">
            <AvatarFallback className="bg-sidebar-accent text-xs font-semibold text-white">{getInitials(email)}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-white">{email ?? "Propriétaire"}</p>
              <p className="text-sidebar-foreground/60 text-xs">Propriétaire</p>
            </div>
          )}
          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" onClick={onLogout} aria-label="Se déconnecter" className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white">
                  <LogOut aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Se déconnecter</TooltipContent>
            </Tooltip>
          )}
        </div>
        {collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" onClick={onLogout} aria-label="Se déconnecter" className="text-sidebar-foreground/80 hover:bg-sidebar-accent mx-auto flex hover:text-white">
                <LogOut aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Se déconnecter</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/** Sidebar fixe (≥ lg), rétractable en mode icônes. */
export function DesktopSidebar({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) {
  return (
    <aside
      className={cn(
        "border-sidebar-border fixed inset-y-0 left-0 z-30 hidden border-r transition-[width] duration-200 lg:block",
        collapsed ? "w-[4.5rem]" : "w-64",
      )}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
    </aside>
  );
}
