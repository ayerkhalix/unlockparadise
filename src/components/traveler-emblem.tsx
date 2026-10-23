"use client";
import { interests, normalizeInterests, type Interest } from "@/lib/traveler";
import { useAmbientMotion } from "@/lib/use-ambient-motion";

// Crisp linework: every interest set has its own composition and motion layers.
const motifs: Record<Interest, React.ReactNode> = {
  beach: (
    <>
      <path
        className="emblem-sway"
        d="M-19 10q6-5 12 0t12 0 12 0M-19 17q6-5 12 0t12 0 12 0"
      />
      <path d="M-13 3q13-14 26 0ZM2 1Q6-8 3-17M3-14q-9-8-15-2M3-14q8-9 15-4" />
    </>
  ),
  river: (
    <>
      <path d="M-18-12h12v16M8-12h10M5-18v13" />
      <path
        className="emblem-flow"
        d="M-1-12v18q-12 5 0 11M7-5v13q13 5 0 11M-18 20q8-5 16 0t16 0"
      />
    </>
  ),
  mountain: (
    <>
      <path d="m-23 16 16-31L6 6l7-14 13 24ZM-12-5l5 5 5-5" />
      <path className="emblem-trail" d="m-11 17 7-7 7 5 7-5" />
    </>
  ),
  culture: (
    <>
      <path
        className="emblem-draw"
        d="m-23-4 23-15L23-4ZM-18-4v22h36V-4M-24 19h48M-8 18V5H8v13M-14-1h28"
      />
      <path d="M-14 3v5M14 3v5" />
    </>
  ),
  food: (
    <>
      <circle cx="0" cy="1" r="14" />
      <circle cx="0" cy="1" r="8" />
      <path d="M-22-14v11m-4-11v6q4 6 8 0v-6M-22-3v23M23-14v34m0-34q-8 5 0 15" />
      <path className="emblem-steam" d="M-5-17q-4-4 0-8M5-17q4-4 0-8" />
    </>
  ),
  coffee: (
    <>
      <path d="M-17-5H12V9q0 13-14 13T-17 9ZM12-3h6q11 9-6 13M-21 24h37" />
      <path
        className="emblem-steam"
        d="M-9-10q-6-7 0-14M1-10q6-7 0-14M10-12q-5-5 0-10"
      />
    </>
  ),
};
export function travelerEmblemKey(selected: readonly string[]) {
  return normalizeInterests(selected).reduce(
    (mask, key) => mask | (1 << interests.findIndex((i) => i.key === key)),
    0,
  );
}
export function TravelerEmblem({
  selected,
  compact = false,
}: {
  selected: readonly string[];
  compact?: boolean;
}) {
  const ref = useAmbientMotion<HTMLSpanElement>();
  const keys = normalizeInterests(selected);
  const mask = travelerEmblemKey(keys);
  return (
    <span
      ref={ref}
      className={`traveler-emblem${compact ? " traveler-emblem--compact" : ""}`}
      data-identity-mask={mask}
      data-playing="false"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 160 160"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          className="emblem-outline"
          d="M80 5 144 42v76L80 155 16 118V42Z"
        />
        <path className="emblem-inner" d="m80 13 57 33v68l-57 33-57-33V46Z" />
        {keys.length === 0 ? (
          <path
            transform="translate(80 80)"
            d="m0-27 12 20 15 7-20 12-7 15-12-20-15-7 20-12Z"
          />
        ) : (
          keys.map((key, index) => {
            const angle = -Math.PI / 2 + (index * Math.PI * 2) / keys.length;
            const radius = keys.length === 1 ? 0 : keys.length === 2 ? 31 : 41;
            const scale =
              keys.length === 1
                ? 1.65
                : keys.length === 2
                  ? 0.95
                  : keys.length <= 4
                    ? 0.76
                    : 0.65;
            return (
              <g
                key={key}
                className={`emblem-motif emblem-motif--${key}`}
                transform={`translate(${80 + Math.cos(angle) * radius} ${80 + Math.sin(angle) * radius}) scale(${scale})`}
              >
                {motifs[key]}
              </g>
            );
          })
        )}
        {keys.length > 2 && (
          <path className="emblem-center" d="m80 73 7 7-7 7-7-7Z" />
        )}
      </svg>
    </span>
  );
}
