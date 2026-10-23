import { z } from "zod";
import identityNames from "./traveler-identities.json";

export const interests = [
  {
    key: "beach",
    label: "Beaches & Islands",
    categories: ["beaches", "islands"],
    icon: "Beaches",
    detail: "Coastal escapes & island discoveries",
  },
  {
    key: "river",
    label: "Rivers & Waterfalls",
    categories: ["rivers", "waterfalls"],
    icon: "Rivers",
    detail: "Freshwater trails & wild cascades",
  },
  {
    key: "mountain",
    label: "Mountain Hikes",
    categories: ["mountain-hikes"],
    icon: "Mountains",
    detail: "Trails, peaks & mountain views",
  },
  {
    key: "culture",
    label: "Local Visits",
    categories: ["others"],
    icon: "Culture",
    detail: "Local culture & everyday discoveries",
  },
  {
    key: "food",
    label: "Food",
    categories: ["restaurants"],
    icon: "Food",
    detail: "Local flavors & favorite meals",
  },
  {
    key: "coffee",
    label: "Coffee",
    categories: ["coffee"],
    icon: "Coffee",
    detail: "Good brews & welcoming cafés",
  },
] as const;
export const interestKeys = [
  "beach",
  "river",
  "mountain",
  "culture",
  "food",
  "coffee",
] as const;
export type Interest = (typeof interestKeys)[number];
export function normalizeInterests(keys: readonly string[]): Interest[] {
  const normalized = new Set(
    keys.flatMap((key) =>
      key === "island"
        ? ["beach"]
        : key === "waterfall"
          ? ["river"]
          : key === "nature"
            ? ["river", "mountain"]
            : [key],
    ),
  );
  return interestKeys.filter((key) => normalized.has(key));
}
export const paces = [
  {
    key: "slow",
    label: "Slow & Easy",
    detail: "Relaxing, low-pressure experiences",
    icon: "Sunset",
  },
  {
    key: "balanced",
    label: "A Little of Both",
    detail: "A mix of leisure and adventure",
    icon: "Islands",
  },
  {
    key: "adventure",
    label: "Full Adventure",
    detail: "Hikes, exploration & active days",
    icon: "Mountains",
  },
] as const;
export const styles = [
  {
    key: "hidden",
    label: "Hidden Gems",
    detail: "Discovering lesser-known spots",
    icon: "Local",
  },
  {
    key: "scenic",
    label: "Scenic Moments",
    detail: "Beautiful views & photography",
    icon: "Sunrise",
  },
  {
    key: "outdoor",
    label: "Outdoor Challenges",
    detail: "Active adventures",
    icon: "Hike",
  },
  {
    key: "food",
    label: "Food Discoveries",
    detail: "Exploring local flavors",
    icon: "Food",
  },
  {
    key: "everything",
    label: "Everything, Please",
    detail: "Trying a bit of everything",
    icon: "Activities",
  },
] as const;
export const companions = [
  { key: "solo", label: "Solo" },
  { key: "partner", label: "Partner" },
  { key: "friends", label: "Friends" },
  { key: "family", label: "Family" },
  { key: "depends", label: "It Depends" },
] as const;
export const archetypes: Record<
  string,
  { label: string; icon: string; description: string }
> = {
  "curious-explorer": {
    label: "Explorer",
    icon: "Directions",
    description: "Choose your interests to discover your explorer identity.",
  },
  ...Object.fromEntries(
    Object.entries(identityNames).map(([maskText, label]) => {
      const mask = Number(maskText);
      const selected = interests.filter((_, index) => mask & (1 << index));
      return [
        mask === 63 ? "wildcard" : "identity-" + mask,
        {
          label,
          icon: mask === 63 ? "Directions" : selected[0].icon,
          description:
            mask === 63
              ? "For explorers who embrace everything: coastal escapes, wild rivers, mountain trails, local culture, great food, and good coffee."
              : "For explorers drawn to " +
                selected
                  .map((interest) => interest.label.toLowerCase())
                  .join(", ") +
                ".",
        },
      ];
    }),
  ),
};
export type Archetype = keyof typeof archetypes;
export const answersSchema = z
  .object({
    interests: z
      .array(z.enum(interestKeys))
      .max(6)
      .refine(
        (v) => new Set(v).size === v.length,
        "Choose each interest once.",
      ),
    pace: z.enum(["slow", "balanced", "adventure"]).nullable(),
    style: z
      .enum(["hidden", "scenic", "outdoor", "food", "everything"])
      .nullable(),
    companion: z
      .enum(["solo", "partner", "friends", "family", "depends"])
      .nullable(),
    public_badges: z.boolean(),
  })
  .strict();
export type TravelAnswers = z.infer<typeof answersSchema>;
export type TravelPreferences = TravelAnswers & {
  user_id: string;
  status: "pending" | "completed" | "skipped" | "dismissed";
  archetype: Archetype;
  version: number;
  updated_at: string;
};
export type PublicTravelerBadge = {
  review_id: string;
  archetype: Archetype;
  interests: Interest[];
};
export const emptyAnswers: TravelAnswers = {
  interests: [],
  pace: null,
  style: null,
  companion: null,
  public_badges: false,
};
// Exact interest combinations are shared with the generated database mapping.
export function classifyTraveler(answers: {
  interests: readonly string[];
  pace?: string | null;
  style?: string | null;
}): Archetype {
  const selected = normalizeInterests(answers.interests);
  const mask = interestKeys.reduce(
    (value, key, index) => value | (selected.includes(key) ? 1 << index : 0),
    0,
  );
  return mask === 63
    ? "wildcard"
    : mask
      ? "identity-" + mask
      : "curious-explorer";
}
export function travelerReason(answers: TravelAnswers) {
  const selected = normalizeInterests(answers.interests);
  if (!selected.length)
    return "Choose your interests to discover your explorer identity. You can update them any time.";
  return (
    "Based on your selected interests: " +
    selected
      .map((key) => interests.find((interest) => interest.key === key)!.label)
      .join(", ") +
    ". Pace and travel style personalize your trip preferences without changing this identity."
  );
}
export const travelerWriteSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("complete"),
      version: z.number().int().min(0),
      answers: answersSchema,
    })
    .strict(),
  z
    .object({
      op: z.enum(["skip", "dismiss", "clear"]),
      version: z.number().int().min(0),
    })
    .strict(),
]);
