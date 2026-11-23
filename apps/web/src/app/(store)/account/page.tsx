import type { Metadata } from "next";
import { AccountOverview } from "@/components/store/account/overview";

export const metadata: Metadata = { title: "Aperçu" };

export default function AccountPage() {
  return <AccountOverview />;
}
