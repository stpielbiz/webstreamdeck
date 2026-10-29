import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PlaylistProvider } from "@/components/playlist-context";
import { AccountAccessProvider } from "@/lib/account-access";
import { signedOutPath } from "@/lib/fire-tv-device";
import { trace } from "@/lib/debug-log";
import { restoreFromBackup, verifyInBackground } from "@/lib/session-keeper";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Trust the sign-in saved on the device; a flaky connection must never
    // send a paired Fire Stick back to the code screen.
    await restoreFromBackup();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      trace("Sent to sign-in: no saved sign-in on this device");
      throw redirect({ to: signedOutPath() });
    }
    void verifyInBackground(() => {
      void supabase.auth.signOut({ scope: "local" }).then(() => {
        window.location.replace(signedOutPath());
      });
    });
    return { user: data.session.user };
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
