"use client";

import { ErrorContent } from "@/components/layout/status-pages";

/** Erreur à l'intérieur de la boutique : conserve le header et le footer. */
export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorContent error={error} reset={reset} />;
}
