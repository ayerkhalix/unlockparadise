export type InterestEvent =
  | "place_viewed"
  | "place_saved"
  | "place_removed_from_bucketlist"
  | "place_added_to_itinerary"
  | "itinerary_created"
  | "product_viewed"
  | "product_added_to_bag";
export function captureInterest(
  name: InterestEvent,
  entity: { place_id?: string; product_id?: number } = {},
) {
  if (
    typeof window === "undefined" ||
    navigator.webdriver ||
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl ||
    location.pathname.startsWith("/admin")
  )
    return;
  try {
    if (localStorage.getItem("upd-analytics-consent") !== "allowed") return;
    let session = sessionStorage.getItem("upd-analytics-session");
    if (!session) {
      session = crypto.randomUUID();
      sessionStorage.setItem("upd-analytics-session", session);
    }
    void fetch("/api/v1/interest/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        ...entity,
        session_id: session,
        event_id: crypto.randomUUID(),
        consent: true,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* Optional measurement never blocks the requested action. */
  }
}
