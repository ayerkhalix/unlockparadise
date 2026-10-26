import { safeBrowseReturn } from "./browsing-return";
import type { Tier } from "./destinations";

/** A shared upgrade link never starts payment or grants membership. */
export function upgradeHref(tier: Tier, returnTo?: string) {
  const target = membershipReturnTarget(returnTo);
  if (tier === "explorer-plus") return "/membership/";
  return `${tier === "explorer" ? "/checkout/" : "/membership/"}?return_to=${encodeURIComponent(target)}`;
}

export function membershipReturnTarget(value?: string | null): string {
  const browse = safeBrowseReturn(value || null);
  if (browse) return browse;
  if (value && value.length <= 2048 && !/[\\\u0000-\u001f\u007f]/.test(value)) {
    try {
      const url = new URL(value, "https://membership.invalid");
      if (
        value.startsWith("/") &&
        url.origin === "https://membership.invalid" &&
        /^\/place\/[a-zA-Z0-9_-]+\/$/.test(url.pathname)
      )
        return url.pathname + url.search + url.hash;
    } catch {
      /* Fall back to the account. */
    }
  }
  return "/account/";
}
