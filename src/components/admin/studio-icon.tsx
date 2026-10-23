import type { ReactNode } from "react";

const drawings: Record<string, ReactNode> = {
  overview: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </>
  ),
  places: (
    <>
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  merchandise: (
    <>
      <path d="M5 7h14l1 14H4L5 7Z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </>
  ),
  orders: (
    <>
      <path d="m3 7 9-4 9 4v10l-9 4-9-4Z M3 7l9 4 9-4 M12 11v10 M8 5l9 4" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 4v16h17 M8 15v-4 M13 15V7 M18 15v-6" />
    </>
  ),
  members: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-2a6 6 0 0 1 12 0v2 M16 5a3 3 0 0 1 0 6 M21 21v-2a6 6 0 0 0-4-5.6" />
    </>
  ),
  reviews: (
    <>
      <path d="M21 11a8 8 0 0 1-8 8H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z M7 8h10 M7 12h7" />
    </>
  ),
  settings: (
    <>
      <path
        d="m9 3-.7 2.2-2 .9-2.1-.5L2.7 8l1.4 1.7-.2 2.2L2 13.2l1.5 2.6 2.2-.2 1.7 1.4L8 20h3l.8-2.1 2.1-.7 2 .7 1.8-2.5-1.1-1.9.4-2.1 1.8-1.4L17.6 7l-2.2.1-1.6-1.5L13 3Z"
        transform="translate(1 0)"
      />
      <circle cx="11" cy="11.5" r="2.7" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 4 4L19 6" />,
  book: (
    <>
      <path d="M4 3h12a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3V4a1 1 0 0 1 1-1Z M3 17h16 M7 7h7 M7 11h5" />
    </>
  ),
};
export function StudioIcon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {drawings[name] || drawings.book}
    </svg>
  );
}
