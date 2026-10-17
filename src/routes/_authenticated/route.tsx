import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PlaylistProvider } from "@/components/playlist-context";
import { AccountAccessProvider } from "@/lib/account-access";
import { signedOutPath } from "@/lib/fire-tv-device";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: signedOutPath() });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AccountAccessProvider>
      <PlaylistProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </PlaylistProvider>
    </AccountAccessProvider>
  );
}
