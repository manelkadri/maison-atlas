"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminHeader } from "./header";
import { MobileNav } from "./mobile-nav";
import { SessionGuard } from "./session-guard";
import { DesktopSidebar } from "./sidebar";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

function ShellLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  return (
    <div className="min-h-dvh">
      <a
        href="#admin-main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Aller au contenu
      </a>
      <DesktopSidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} />
      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />
      <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64")}>
        <AdminHeader onOpenMenu={() => setMobileOpen(true)} />
        <main id="admin-main" tabIndex={-1} className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Coque du dashboard : garde de session simulée + sidebar + header + zone de contenu. */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <SessionGuard>
      <ShellLayout>{children}</ShellLayout>
    </SessionGuard>
  );
}
