import type { Metadata } from "next";
import { NotFoundContent } from "@/components/layout/status-pages";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false } };

/** 404 à l'intérieur de la boutique : conserve le header et le footer. */
export default function StoreNotFound() {
  return <NotFoundContent />;
}
