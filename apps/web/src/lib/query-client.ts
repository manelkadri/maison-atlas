import { MutationCache, QueryClient } from "@tanstack/react-query";

/**
 * Toute mutation réussie invalide l'ensemble du cache : avec la base mock locale c'est instantané,
 * et cela garantit que stocks, commandes, statistiques et catalogue restent cohérents entre eux
 * (ex. une commande modifie le stock ET les statistiques).
 * Avec l'API réelle, on pourra affiner par clé.
 */
export function makeQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: () => {
        void client.invalidateQueries();
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  });
  return client;
}

let browserClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
