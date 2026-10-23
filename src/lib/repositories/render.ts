import { mediaAvailable } from "@/lib/media-availability";
import "server-only";
import type { PlaceSummary } from "./places";
import type { Tier } from "@/lib/destinations";
import { iconPath } from "@/components/icon";
import originalMap from "@/data/map.json";
import type { MapConfiguration } from "@/components/palawan-map";
export function heroMarkup(template: string, map: MapConfiguration) {
  return template
    .replace(
      'aria-label="Scroll to map"',
      'aria-label="Start exploring the map"',
    )
    .replace(
      /<button\b[^>]*class="upd-cat-chip"[\s\S]*?<\/button>/g,
      (block) => {
        const label = /data-tip="\d+ ([^"]+)"/.exec(block)?.[1];
        const original = originalMap.categories.find(
          (c) => escape(c.name) === label,
        );
        if (!original) return block;
        const category = map.categories.find((c) => c.slug === original.slug);
        if (!category) return block;
        const count = map.categoryCounts?.[category.slug] || 0;
        let result = block
          .replace(
            /data-tip="\d+ [^"]+"/,
            `data-tip="${count} ${escape(category.name)}"`,
          )
          .replace(/<b>\d+<\/b>/, `<b>${count}</b>`)
          .replace(
            /(class="screen-reader-text">)\d+ [^<]+/,
            "$1" + count + " " + escape(category.name),
          );
        if (!["waterfalls", "others"].includes(category.slug))
          result = result.replace(
            /(class="upd-cat-label">)[^<]+/,
            "$1" + escape(category.name),
          );
        return result
          .replace(
            /<button\b/,
            `<a href="/place_category/${escape(category.slug)}/"`,
          )
          .replace(/<\/button>$/, "</a>")
          .replace(/ type="button"/, "");
      },
    );
}
export function escape(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function icon(name: string, size = 16) {
  if (name === "Bucket" || name === "Visited")
    return `<svg class="upd-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="${name === "Bucket" ? "M4 7h16l-2 14H6L4 7Zm0 0 3-4h10l3 4M9 12l2 2 4-4" : "m3 21 8-13 10 13H3Zm8-13V2h8l-2 3 2 3h-8M7 15l3 2 3-2"}"/></svg>`;
  return `<svg class="upd-icon" width="${size}" height="${size}" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="${iconPath(name)}"/></svg>`;
}
function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function card(
  p: PlaceSummary,
  tier: Tier,
  variant: "default" | "account-preview" = "default",
) {
  const mountain = p.place_categories.some(
    (c) => c.categories.slug === "mountain-hikes",
  );
  const duration = mountain ? p.place_details?.hike_minutes : p.travel_minutes;
  const transport = mountain
    ? p.accessibility.filter(
        (a) => !["hike", "hiking", "walk", "walking"].includes(a.toLowerCase()),
      )
    : p.accessibility;
  const average = p.rating_average || 0;
  const filled =
    "m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z";
  const empty =
    "m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z";
  const half =
    "M480-323v-348l-58 135-146 13 111 97-33 143 109-66Zm0 95L233-79l65-281L80-549l288-25 112-265 112 265 288 25-218 189 65 281-247-149Z";
  const ratingBadge = p.rating_count
    ? `<div class="upd-card__rating"><span class="upd-rating upd-rating--badge"><span class="upd-rating__stars" aria-label="${average.toFixed(1)} out of 5 stars">${Array.from({ length: 5 }, (_, i) => `<svg class="upd-icon" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="${i < Math.floor(average) ? filled : i === Math.floor(average) && average - Math.floor(average) >= 0.5 ? half : empty}"/></svg>`).join("")}</span> ${average.toFixed(1)} <span class="upd-rating__count">(${p.rating_count})</span></span></div>`
    : "";
  const cover =
    p.place_media.find((m) => m.kind === "cover" && mediaAvailable(m.media))
      ?.media ||
    (variant === "account-preview"
      ? p.place_media.find(
          (m) => m.kind === "gallery" && mediaAvailable(m.media),
        )?.media
      : undefined);
  const title =
    p.vip_content && tier !== "explorer-plus"
      ? `<span class="upd-vip-banner">${icon("Lock")}Explorer+</span>`
      : escape(p.title);
  const images = p.place_media
    .filter((m) => m.kind === "gallery" && mediaAvailable(m.media))
    .sort((a, b) => a.position - b.position)
    .slice(0, 5);
  const strip =
    variant !== "account-preview" &&
    tier !== "public" &&
    (!p.vip_content || tier === "explorer-plus") &&
    images.length > 1;
  return `<div class="upd-card${p.vip_content ? " upd-card--vip" : ""}" id="place-${escape(p.legacy_id || p.id)}" data-place-id="${p.id}" data-travel="${p.travel_minutes ?? ""}" data-access="${p.accessibility.map(slug).join("|")}" data-assets="${p.assets.map(slug).join("|")}" data-vip="${p.vip_content ? "1" : "0"}" data-title="${escape(p.title.toLowerCase())}" data-date="${new Date(p.published_at || 0).getTime() / 1000}" data-rating="${p.rating_average || 0}" data-reviews="${p.rating_count || 0}" data-search="${escape((p.title + " " + p.accessibility.join(" ")).toLowerCase())}">
 ${strip ? "" : `<a class="upd-card__link" href="/place/${escape(p.slug)}/">`}<div class="upd-card__photo${strip ? " upd-card__photo--strip" : ""}">${strip ? `<div class="upd-card__track" data-upd-strip tabindex="0" role="group" aria-label="Photos of ${escape(p.title)}. Use arrow keys to browse.">${images.map((m) => `<a href="/place/${escape(p.slug)}/" tabindex="-1" aria-label="View ${escape(p.title)}"><img src="/api/media/${m.media!.id}/?variant=medium_large" alt="${escape(p.title)}" loading="lazy" decoding="async" draggable="false"></a>`).join("")}</div><div class="upd-card__dots" aria-hidden="true">${images.map((_, i) => `<span class="upd-card__dot${i ? "" : " is-active"}"></span>`).join("")}</div>` : cover ? `<img src="/api/media/${cover.id}/?variant=medium_large" alt="${escape(p.title)}" loading="lazy">` : p.vip_content && tier !== "explorer-plus" ? `<span class="upd-card__lockedphoto">${icon("Lock", 40)}<span>Explorer+ destination</span></span>` : '<span class="upd-card__coming-soon">Coming soon</span>'}${p.vip_content ? `<span class="upd-card__lock" role="img" aria-label="Explorer+ destination" data-tooltip="Explorer+ destination">${icon("Lock")}</span>` : ""}</div>
 ${strip ? `<a class="upd-card__link" href="/place/${escape(p.slug)}/">` : ""}<div class="upd-card__body"><h3 class="upd-card__title">${title}</h3>${ratingBadge}<dl class="upd-card__stats">${duration != null || mountain ? `<div class="upd-card__stat"><dt class="upd-card__label">${mountain ? "Hike time" : "Travel time"}</dt><dd class="upd-card__value">${duration != null ? `${duration} min` : "Unspecified"}</dd></div>` : ""}${transport.length ? `<div class="upd-card__stat upd-card__access"><dt class="upd-card__label">Accessible by</dt><dd class="upd-card__value upd-card__modes">${transport.map((a) => `<span class="upd-card__mode" data-tooltip="${escape(a)} ? ${p.place_details?.transport_minutes?.[a] != null ? `${p.place_details.transport_minutes[a]} min` : "duration unspecified"}" role="img" aria-label="${escape(a)}">${icon(a)}</span>`).join("")}</dd></div>` : ""}</dl></div></a>
 ${tier === "explorer-plus" ? `<div class="upd-card__save"><button type="button" class="upd-action upd-action--icon${p.saved ? " is-saved" : ""}" data-member-op="${p.saved ? "unsave" : "save"}" aria-pressed="${Boolean(p.saved)}" data-place-uuid="${p.id}" aria-label="${p.saved ? "Remove from Bucketlist" : "Add to Bucketlist"}" data-tooltip="${p.saved ? "Remove from Bucketlist" : "Add to Bucketlist"}">${icon("Bucket")}</button><button type="button" class="upd-action upd-action--icon${p.visited ? " is-visited" : ""}" data-member-op="${p.visited ? "unvisit" : "visit"}" aria-pressed="${Boolean(p.visited)}" data-place-uuid="${p.id}" aria-label="${p.visited ? "Remove from Portfolio" : "Add to Portfolio"}" data-tooltip="${p.visited ? "Remove from Portfolio" : "Add to Portfolio"}">${icon("Visited")}</button><button class="p2-card-plan" type="button" data-add-itinerary="${p.id}">+ Itinerary</button></div>` : `<div class="upd-card__save"><button class="p2-card-plan" type="button" data-add-itinerary="${p.id}" aria-label="Add to Itinerary">+ Itinerary</button></div>`}</div>`;
}
export function archiveMarkup(
  template: string,
  places: PlaceSummary[],
  tier: Tier,
) {
  const start = template.indexOf('<div class="upd-grid">');
  const empty = template.indexOf('<p class="upd-feed__empty"', start);
  const end = template.lastIndexOf("</div>", empty);
  if (start < 0 || empty < 0 || end < start)
    throw new Error("Archive template is missing its grid.");
  return (
    template.slice(0, start) +
    `<div class="upd-grid">${places.map((p) => card(p, tier).replace('<h3 class="upd-card__title">', '<h2 class="upd-card__title">').replace("</h3>", "</h2>")).join("")}</div>` +
    template.slice(end + 6)
  );
}
export function featuredMarkup(
  places: PlaceSummary[],
  explanations: Record<string, string> = {},
) {
  return `<section class="upd-featured upd-surface--sand" id="featured"><h2 class="upd-featured-title">Featured destinations</h2><div class="upd-featured-grid">${places
    .map((p) => {
      const cover = p.place_media.find(
        (m) => m.kind === "cover" && mediaAvailable(m.media),
      )?.media;
      const category =
        p.place_categories.find((c) =>
          [
            "beaches",
            "rivers",
            "islands",
            "waterfalls",
            "mountain-hikes",
            "others",
            "restaurants",
          ].includes(c.categories.slug),
        )?.categories || p.place_categories[0]?.categories;
      const label =
        category?.slug === "others"
          ? "Local"
          : category?.slug === "waterfalls"
            ? "Falls"
            : category?.slug === "restaurants"
              ? "Food"
              : category?.name || "";
      const categoryIcon = (
        {
          beaches: "Beaches",
          rivers: "Rivers",
          islands: "Islands",
          waterfalls: "Falls",
          "mountain-hikes": "Mountains",
          others: "Local",
          restaurants: "Food",
        } as Record<string, string>
      )[category?.slug || ""];
      const mountain = p.place_categories.some(
        (c) => c.categories.slug === "mountain-hikes",
      );
      const duration = mountain
        ? p.place_details?.hike_minutes
        : p.travel_minutes;
      const durationMarkup = mountain
        ? `<span class="upd-fcard-chip">${icon("Clock")}Hike: ${duration != null ? `${duration} min` : "unspecified"}</span>`
        : duration != null
          ? `<span class="upd-fcard-chip">${icon("Clock")}${duration} min</span>`
          : "";
      return `<div class="p2-featured-card"><a class="upd-fcard${p.vip_content && p.slug === p.id ? " is-locked" : ""}" href="/place/${escape(p.slug)}/"><span class="upd-fcard-img"${cover ? ` style="background-image:url('/api/media/${cover.id}/?variant=medium_large')"` : ""}>${p.vip_content && p.slug === p.id ? icon("Lock", 48) : ""}</span><span class="upd-fcard-body"><span class="upd-fcard-area">${escape(p.place_areas[0]?.areas.name)}</span><span class="upd-fcard-name">${escape(p.title)}</span><span class="upd-fcard-meta"><span class="upd-fcard-chip">${categoryIcon ? icon(categoryIcon) : ""}${escape(label)}</span>${durationMarkup}</span>${explanations[p.id] ? `<span class="td-featured-reason">${escape(explanations[p.id])}</span>` : ""}</span></a></div>`;
    })
    .join("")}</div></section>`;
}
