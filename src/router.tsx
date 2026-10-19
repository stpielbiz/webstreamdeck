import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();
  // Huge library lists: skip the deep old-vs-new comparison on every update —
  // walking ~14,000 titles each time stalled Fire Sticks for seconds.
  for (const key of ["system-catalogue", "cached-title-metadata", "device-guide", "tv-live-items", "global-search-movie", "global-search-series", "global-search-live", "items"]) {
    queryClient.setQueryDefaults([key], { structuralSharing: false });
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
