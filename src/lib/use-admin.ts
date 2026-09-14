import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { checkAdmin } from "./admin.functions";

/** Whether the signed-in account holds the admin role. */
export function useIsAdmin() {
  const fn = useServerFn(checkAdmin);
  const query = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
  });
  return { isAdmin: query.data === true, loading: query.isLoading };
}
