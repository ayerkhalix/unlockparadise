import { z } from "zod";

export const collectionTaglineInput = z
  .string()
  .trim()
  .max(160, "Keep the tagline to 160 characters or fewer.");

export const DEFAULT_BRAND = "00000000-0000-4000-8000-000000000b01";
export const DEFAULT_COLLECTION = "00000000-0000-4000-8000-000000000c01";
export const productCategories = ["Tees", "Hoodies", "Headwear", "Bags"];
export const productColors = [
  "Navy",
  "Sand",
  "Natural",
  "Black",
  "White",
  "Green",
  "Blue",
  "Gray",
  "Red",
  "Multicolor",
];
export const productSizes = [
  "One Size",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
];
export const slugFromName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
