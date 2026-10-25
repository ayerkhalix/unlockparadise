/** Only browse surfaces may be return targets. Never accept external or auth URLs. */
export function safeBrowseReturn(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  )
    return null;
  try {
    const url = new URL(value, "https://browse.invalid");
    if (
      url.origin !== "https://browse.invalid" ||
      !/^\/(?:$|area(?:\/|$)|place_category(?:\/|$)|itineraries(?:\/|$)|bucketlist(?:\/|$)|portfolio(?:\/|$)|account(?:\/|$))/.test(
        url.pathname,
      )
    )
      return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
