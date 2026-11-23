import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/shell/admin-shell";

/**
 * Coque du dashboard (sidebar, header, garde de session simulée).
 * ATTENTION : la protection est faite côté navigateur et n'est PAS sécurisée.
 * Elle sera assurée par le backend en phase 2 (cookie httpOnly, JWT, rôle propriétaire).
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
