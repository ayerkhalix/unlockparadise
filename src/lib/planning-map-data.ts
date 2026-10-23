import base from "@/data/map.json";
import { slugFromName } from "./catalog-options";
import type { TravelPlace } from "./planning";
import type { MapConfiguration } from "@/components/palawan-map";

const names = (value: string) => value.split(" · ").filter(Boolean);
export function placesInMapCategory(
  places: TravelPlace[],
  area: string,
  category: string,
) {
  return places.filter(
    (p) => names(p.area).includes(area) && names(p.category).includes(category),
  );
}
export function planningMapData(
  places: TravelPlace[],
  metadata: Pick<MapConfiguration, "areas" | "categories"> = base,
): MapConfiguration {
  const areas = [...new Set(places.flatMap((p) => names(p.area)))]
    .sort()
    .map((name) => {
      const known = metadata.areas.find((a) => a.name === name);
      if (known) return known;
      const coordinates = places
        .filter((p) => names(p.area).includes(name) && p.coordinates)
        .map((p) => p.coordinates!);
      return {
        name,
        slug: slugFromName(name),
        desc: "",
        coords: coordinates.length
          ? [0, 1].map(
              (axis) =>
                coordinates.reduce((sum, point) => sum + point[axis], 0) /
                coordinates.length,
            )
          : [],
      };
    });
  const categories = [...new Set(places.flatMap((p) => names(p.category)))]
    .sort()
    .map((name) => {
      const known = metadata.categories.find(
        (c) =>
          c.name.toLowerCase() === name.toLowerCase() ||
          c.slug === slugFromName(name),
      );
      return {
        name,
        slug: known?.slug || slugFromName(name),
        image: known?.image || "",
      };
    });
  const availability: MapConfiguration["availability"] = {};
  for (const area of areas) {
    availability[area.slug] = {};
    for (const category of categories) {
      const count = placesInMapCategory(
        places,
        area.name,
        category.name,
      ).length;
      if (count) availability[area.slug][category.slug] = count;
    }
  }
  return { areas, categories, availability };
}
