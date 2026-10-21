import { useAccountAccess } from "@/lib/account-access";

/** Quiet text label beside the wordmark: never expires / expiry date / expired. Not focusable. */
export function AccountExpiryBadge() {
  const status = useAccountAccess().data;
  if (!status) return null;
  const label = status.neverExpires ? "Never expires"
    : status.expired ? "Expired"
    : status.expiresAt ? `Expires ${new Date(status.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
    : null;
  if (!label) return null;
  return (
    <span className={`shrink-0 whitespace-nowrap text-xs font-medium ${status.expired ? "text-destructive" : "text-muted-foreground"}`}>
      {label}
    </span>
  );
}
