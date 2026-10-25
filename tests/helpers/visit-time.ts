import type { Locator } from "@playwright/test";

export async function setVisitTime(
  scope: Locator,
  label: "Start" | "End",
  time: string,
) {
  const [hour, minute] = time.split(":").map(Number);
  await scope
    .getByRole("combobox", { name: `${label} hour`, exact: true })
    .selectOption(String(hour % 12 || 12));
  await scope
    .getByRole("combobox", { name: `${label} minute`, exact: true })
    .selectOption(String(minute).padStart(2, "0"));
  await scope
    .getByRole("combobox", { name: `${label} AM/PM`, exact: true })
    .selectOption(hour >= 12 ? "PM" : "AM");
}
