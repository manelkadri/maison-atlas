import type { Metadata } from "next";
import type { ReactNode } from "react";

// L'administration ne doit jamais être indexée par les moteurs de recherche.
export const metadata: Metadata = {
  title: { default: "Administration", template: "%s | Administration" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    // `data-theme="admin"` active l'identité visuelle du dashboard (voir globals.css).
    <div data-theme="admin" className="bg-background text-foreground min-h-dvh">
      {children}
    </div>
  );
}
