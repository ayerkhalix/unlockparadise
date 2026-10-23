import { z } from "zod";
export const accessTypes = [
  "Boat departure",
  "Drop-off",
  "Trailhead",
  "Parking",
] as const;
export const accessPointInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: z.enum(accessTypes),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    directions: z.string().trim().max(1000),
  })
  .strict();
export type AccessPoint = z.infer<typeof accessPointInput>;
