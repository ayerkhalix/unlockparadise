import { fragment } from "@/lib/content";
import { membershipMarkup } from "@/lib/auth/markup";
import { OriginalMarkup } from "./original-markup";
import type { Tier } from "@/lib/destinations";

/** Keep destination hooks on the existing membership comparison and its feature truth. */
export function MembershipComparison({
  tier,
  returnTo,
}: {
  tier: Tier;
  returnTo: string;
}) {
  let html =
    membershipMarkup(fragment("membership") || "", tier !== "public").match(
      /<section class="upd-membership__plans">[\s\S]*?<\/section>/,
    )?.[0] || "";
  html = html
    .replace(
      'href="/checkout/"',
      `href="/membership/?return_to=${encodeURIComponent(returnTo)}"`,
    )
    .replace(
      'href="/join/?redirect_to=/membership/"',
      `href="/join/?redirect_to=${encodeURIComponent(returnTo)}"`,
    );
  if (tier !== "public") html = html.replace("You're here", "Browse freely");
  return <OriginalMarkup html={html} />;
}
