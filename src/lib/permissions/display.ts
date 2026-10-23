export function fieldVisible(settings: Record<string, unknown>, field: string) {
  const value = settings["place_show_" + field];
  return value !== false && value !== 0 && value !== "0";
}
export function fieldHeading(
  settings: Record<string, unknown>,
  field: string,
  fallback: string,
) {
  const value = settings["place_heading_" + field];
  return typeof value === "string" && value.trim() ? value : fallback;
}
export function fieldDescription(
  settings: Record<string, unknown>,
  group: "asset" | "access",
  label: string,
) {
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const value = settings[`place_${group}_desc_${key}`];
  return typeof value === "string" ? value : undefined;
}
