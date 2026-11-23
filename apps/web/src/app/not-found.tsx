import type { Metadata } from "next";
import { NotFoundContent } from "@/components/layout/status-pages";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false } };

export default function NotFound() {
  return (
    <main id="contenu">
      <NotFoundContent />
    </main>
  );
}
