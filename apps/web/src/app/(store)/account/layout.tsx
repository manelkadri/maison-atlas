import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccountShell } from "@/components/store/account/account-shell";

// Espace personnel : jamais indexé.
export const metadata: Metadata = {
  title: { default: "Mon espace", template: "%s | Mon espace" },
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
