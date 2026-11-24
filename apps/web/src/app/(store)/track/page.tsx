import type { Metadata } from "next";
import { PublicTracking } from "@/components/store/account/public-tracking";

// Page de suivi sans compte : jamais indexée (elle ne contient aucun contenu public).
export const metadata: Metadata = {
  title: "Suivre une commande",
  robots: { index: false, follow: false },
};

export default function TrackPage() {
  return <PublicTracking />;
}
