import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsView } from "@/components/admin/settings/settings-view";

export const metadata: Metadata = { title: "Paramètres" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Paramètres" description="Informations de la boutique, frais de livraison et seuils d'alerte." />
      <SettingsView />
    </>
  );
}
