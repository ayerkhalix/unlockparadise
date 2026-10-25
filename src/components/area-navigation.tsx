import Link from "next/link";
export function AreaNavigation({
  area,
  categories,
  selected,
}: {
  area: { slug: string; name: string };
  categories: { slug: string; name: string }[];
  selected?: string;
}) {
  return (
    <nav className="area-navigation" aria-label={`${area.name} categories`}>
      <Link
        className="area-navigation__back"
        href={`/?map_area=${area.slug}${selected === "restaurants" || selected === "coffee" ? "&map_page=1" : ""}#palawan-map`}
      >
        ← All {area.name} categories
      </Link>
      <div className="area-navigation__categories">
        {categories.map((c) => (
          <Link
            href={`/area/${area.slug}/${c.slug}/`}
            key={c.slug}
            aria-current={selected === c.slug ? "page" : undefined}
          >
            {c.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
