import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Garante que falhas no auth não deixem a app em loading eterno.
        // Após 1 retry, React Query seta isError=true e isLoading=false.
        retry: 1,
        retryDelay: 1000,
        staleTime: 30_000, // 30 segundos — evita refetches desnecessários
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
