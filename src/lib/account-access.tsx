import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, type ReactNode } from "react";

import { getAccountAccess } from "@/lib/account-access.functions";

export type AccountAccess = {
  expiresAt: string | null;
  neverExpires: boolean;
  expired: boolean;
};

const AccountAccessContext = createContext<ReturnType<typeof useAccountAccessQuery> | null>(null);

function useAccountAccessQuery() {
  const getAccess = useServerFn(getAccountAccess);
  return useQuery({
    queryKey: ["account-access"],
    queryFn: () => getAccess(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function AccountAccessProvider({ children }: { children: ReactNode }) {
  const access = useAccountAccessQuery();
  return <AccountAccessContext.Provider value={access}>{children}</AccountAccessContext.Provider>;
}

export function useAccountAccess() {
  const access = useContext(AccountAccessContext);
  if (!access) throw new Error("useAccountAccess must be used inside AccountAccessProvider");
  return access;
}