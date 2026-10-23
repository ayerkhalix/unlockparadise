"use client";
import { normalizeInterests, type Interest } from "@/lib/traveler";
import { useAmbientMotion } from "@/lib/use-ambient-motion";

const atmospheres: Record<Interest, React.ReactNode> = {
  beach: (
    <g className="nameplate-tide">
      <path
        d="M-40 85Q25 62 90 85T220 85T350 85T480 85T610 85V130H-40Z"
        fill="currentColor"
        stroke="none"
        opacity=".13"
      />
      <path d="M-40 98Q25 75 90 98T220 98T350 98T480 98T610 98" />
      <circle cx="458" cy="31" r="22" opacity=".35" />
    </g>
  ),
  river: (
    <g className="nameplate-current">
      <path d="M-40 28Q70 4 180 28T400 28T620 28M-40 54Q70 30 180 54T400 54T620 54M-40 80Q70 56 180 80T400 80T620 80M-40 106Q70 82 180 106T400 106T620 106" />
      <path
        d="M-40 39Q70 15 180 39T400 39T620 39"
        strokeWidth="12"
        opacity=".15"
      />
    </g>
  ),
  mountain: (
    <g className="nameplate-alpine">
      <path
        d="m260 120 75-95 43 56 35-62 105 101Z"
        fill="currentColor"
        stroke="none"
        opacity=".15"
      />
      <path d="m275 120 60-76 43 56 35-62 90 82M324 58l12 10 9-11M402 59l12 12 12-12" />
      <path
        className="nameplate-trail"
        d="m290 120 24-12-13-10 33-12"
        strokeDasharray="3 7"
      />
    </g>
  ),
  culture: (
    <g className="nameplate-heritage">
      <path d="M17 18h486v84H17ZM25 26h470v68H25" opacity=".3" />
      <path d="m446 28 13 13-13 13-13-13ZM446 65l13 13-13 13-13-13ZM475 47l13 13-13 13-13-13Z" />
    </g>
  ),
  food: (
    <g className="nameplate-table">
      <circle cx="468" cy="65" r="45" />
      <circle cx="468" cy="65" r="35" opacity=".4" />
      <path
        className="nameplate-aroma"
        d="M378 70q-12-17 0-34M395 84q-12-17 0-34M412 67q-12-17 0-34"
      />
    </g>
  ),
  coffee: (
    <g className="nameplate-coffee">
      <path
        className="nameplate-aroma"
        d="M370 115q-27-30 0-60t0-60M414 136q-27-30 0-60t0-60M458 115q-27-30 0-60t0-60"
      />
      <ellipse cx="471" cy="98" rx="44" ry="12" opacity=".3" />
    </g>
  ),
};

export function TravelerTitle({
  selected,
  children,
}: {
  selected: readonly string[];
  children: string;
}) {
  const keys = normalizeInterests(selected);
  const theme = keys.length === 6 ? "wildcard" : keys[0] || "beach";
  const ref = useAmbientMotion<HTMLSpanElement>();
  return (
    <span
      ref={ref}
      className={`traveler-nameplate traveler-nameplate--${theme}`}
      data-playing="false"
    >
      <svg
        className="traveler-nameplate__art"
        viewBox="0 0 520 120"
        preserveAspectRatio="none"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        aria-hidden="true"
      >
        {keys.slice(0, 3).map((key) => (
          <g key={key}>{atmospheres[key]}</g>
        ))}
      </svg>
      <span className="traveler-nameplate__text">{children}</span>
    </span>
  );
}
