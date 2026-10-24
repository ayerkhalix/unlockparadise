import icons from "@/data/icons.json";

const paths: Record<string, string> = {
  ...icons,
  Menu: "M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z",
  Clock:
    "M480-80q-83 0-156-31.5T197-197Q143-251 111.5-324T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm132-132 56-56-148-148v-184h-80v216l172 172Z",
  Lock: "M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm296.5-223.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z",
  Star: "m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 136-146 12 111 97-33 143Zm126 21L264-136l57-246-191-165 252-22 98-232 98 232 252 22-191 165 57 246-216-130Zm0-204Z",
  Share:
    "M720-80H240q-33 0-56.5-23.5T160-160v-440q0-33 23.5-56.5T240-680h120v80H240v440h480v-440H600v-80h120q33 0 56.5 23.5T800-600v440q0 33-23.5 56.5T720-80ZM440-320v-446l-64 64-56-58 160-160 160 160-56 58-64-64v446h-80Z",
  Directions:
    "m480-880 400 400-400 400L80-480l400-400Zm0 114L194-480l286 286 286-286-286-286Zm-40 446v-160h120l-40 40 56 56 136-136-136-136-56 56 40 40H360v240h80Z",
  Person:
    "M400-120v-280h-80v-240h320v240h-80v280H400Zm80-560q-33 0-56.5-23.5T400-760q0-33 23.5-56.5T480-840q33 0 56.5 23.5T560-760q0 33-23.5 56.5T480-680Z",
  Location:
    "M480-80Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-106q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0-294q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Z",
  People:
    "M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm720 0v-112q0-45-22.5-83T678-416q51 6 96 15.5t84 22.5q29 15 45.5 43.5T920-272v112H760ZM247-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47Zm451 24q22-27 32-62t10-75q0-40-10-75t-32-62q60 7 101 51t41 106q0 62-41 106t-101 51Z",
};
export function iconPath(name: string) {
  return paths[name] || paths.Local;
}
export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  if (["Search", "Explore", "Notes"].includes(name))
    return (
      <svg
        className="upd-icon"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {name === "Search" ? (
          <>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 5 5" />
          </>
        ) : name === "Explore" ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="m16 8-2 6-6 2 2-6 6-2Z" />
          </>
        ) : (
          <>
            <rect x="5" y="3" width="14" height="18" rx="2" />
            <path d="M9 8h6M9 12h6M9 16h4" />
          </>
        )}
      </svg>
    );
  if (name === "Coffee" || name === "Nature")
    return (
      <svg
        className="upd-icon"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {name === "Coffee" ? (
          <>
            <path d="M5 7h12v8a6 6 0 0 1-12 0V7Zm12 1h2a3 3 0 0 1 0 6h-2M4 22h16M8 2v2m5-2v2" />
          </>
        ) : (
          <>
            <path d="M20 3C8 2 2 9 5 16c5 8 15 3 15-13Z M4 21 16 9M9 16l-1-5m5 1 4 1" />
          </>
        )}
      </svg>
    );
  if (name === "Cart")
    return (
      <svg
        className="upd-icon"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 3h3l3 12h11l3-9H6M9 19h.01M18 19h.01" />
        <circle cx="9" cy="19" r="1" />
        <circle cx="18" cy="19" r="1" />
      </svg>
    );
  if (name === "Bucket")
    return (
      <svg
        className="upd-icon"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 7h16l-2 14H6L4 7Zm0 0 3-4h10l3 4M9 12l2 2 4-4" />
      </svg>
    );
  if (name === "Visited")
    return (
      <svg
        className="upd-icon"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m3 21 8-13 10 13H3Zm8-13V2h8l-2 3 2 3h-8M7 15l3 2 3-2" />
      </svg>
    );
  return (
    <svg
      className="upd-icon"
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.Local} />
    </svg>
  );
}
