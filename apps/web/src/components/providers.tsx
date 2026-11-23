"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getQueryClient } from "@/lib/query-client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  // Synchronise plusieurs onglets : si le stockage local change ailleurs, on recharge les données.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "fashion-mock-db") void queryClient.invalidateQueries();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      <Toaster position="top-center" richColors={false} closeButton />
    </QueryClientProvider>
  );
}
