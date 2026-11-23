"use client";

import { ErrorContent } from "@/components/layout/status-pages";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="contenu">
      <ErrorContent error={error} reset={reset} />
    </main>
  );
}
