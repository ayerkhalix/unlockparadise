// One measured, decorative flight. Persistence and counts belong to their stores.
type Kind = "bucketlist" | "bag";
type Flight = { cancel: () => void; key?: string };
const active = new Set<Flight>();
const plane =
  '<svg viewBox="0 0 40 32" width="40" height="32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3 38 16 2 29l7-12L2 3Z" fill="#83d9c6" stroke="#f4f4eb" stroke-width="1.5" stroke-linejoin="round"/><path d="m9 17 29-1-25 7-4-6Z" fill="#dfc18a"/><path d="M9 17 38 16" stroke="#102732" stroke-width="1.5"/></svg>';
function visible(element: HTMLElement | null): element is HTMLElement {
  if (!element?.isConnected) return false;
  const r = element.getBoundingClientRect();
  if (
    r.width < 1 ||
    r.height < 1 ||
    r.bottom <= 0 ||
    r.right <= 0 ||
    r.top >= innerHeight ||
    r.left >= innerWidth
  )
    return false;
  for (let el: HTMLElement | null = element; el; el = el.parentElement) {
    const s = getComputedStyle(el);
    if (
      s.display === "none" ||
      s.visibility === "hidden" ||
      Number(s.opacity) === 0 ||
      el.inert
    )
      return false;
  }
  return true;
}
function react(element: HTMLElement, receive = false) {
  if (!element.isConnected) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.classList.add("p2-flight-confirmed");
    setTimeout(() => element.classList.remove("p2-flight-confirmed"), 700);
    return;
  }
  const base = getComputedStyle(element).transform;
  const transform = base === "none" ? "" : base;
  element.animate(
    [
      { transform: `${transform} scale(1)` },
      {
        transform: `${transform} scale(${receive ? 1.09 : 0.96})`,
        offset: 0.4,
      },
      { transform: `${transform} scale(1)` },
    ],
    { duration: receive ? 300 : 180, easing: "cubic-bezier(.16,1,.3,1)" },
  );
}
export function cancelFlights(key?: string) {
  for (const flight of [...active])
    if (!key || flight.key === key) flight.cancel();
}
export function travelFlight({
  kind,
  control,
  image,
  photo,
  key,
}: {
  kind: Kind;
  control: HTMLElement | null;
  image?: string;
  photo?: HTMLElement | null;
  key?: string;
}) {
  if (!visible(control)) return;
  if (key) cancelFlights(key);
  const target = document.querySelector<HTMLElement>(
    `[data-flight-target="${kind}"]`,
  );
  react(control);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (visible(target)) react(target, true);
    return;
  }
  const dialog = control.closest<HTMLDialogElement>("dialog[open]");
  const traveling = visible(target) && (!dialog || dialog.contains(target));
  const origin = kind === "bag" && visible(photo ?? null) ? photo! : control;
  if (origin !== control) react(origin);
  const from = origin.getBoundingClientRect();
  const start = {
    x: (Math.max(0, from.left) + Math.min(innerWidth, from.right)) / 2,
    y: (Math.max(0, from.top) + Math.min(innerHeight, from.bottom)) / 2,
  };
  const to = traveling ? target.getBoundingClientRect() : null;
  const end = to
    ? { x: to.left + to.width / 2, y: to.top + to.height / 2 }
    : { x: start.x + 16, y: start.y - 30 };
  const node = document.createElement("div");
  node.className = `p2-flight p2-flight--${kind}`;
  node.dataset.flightKind = kind;
  node.dataset.flightMode = traveling ? "travel" : "local";
  node.dataset.flightFrom = `${start.x},${start.y}`;
  node.dataset.flightTo = `${end.x},${end.y}`;
  node.setAttribute("aria-hidden", "true");
  if (kind === "bag" && image) {
    const thumbnail = document.createElement("img");
    thumbnail.src = image;
    thumbnail.alt = "";
    node.append(thumbnail);
  } else node.innerHTML = plane;
  (dialog || document.body).append(node);
  const dx = end.x - start.x,
    dy = end.y - start.y;
  const lift = Math.min(190, Math.max(65, Math.hypot(dx, dy) * 0.3));
  const c1 = { x: start.x + dx * 0.18, y: Math.max(22, start.y - lift) };
  const c2 = { x: end.x - dx * 0.25, y: Math.max(22, end.y - lift * 0.8) };
  const frames = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40,
      u = 1 - t;
    const x =
      u ** 3 * start.x +
      3 * u ** 2 * t * c1.x +
      3 * u * t ** 2 * c2.x +
      t ** 3 * end.x;
    const y =
      u ** 3 * start.y +
      3 * u ** 2 * t * c1.y +
      3 * u * t ** 2 * c2.y +
      t ** 3 * end.y;
    const vx =
      3 * u ** 2 * (c1.x - start.x) +
      6 * u * t * (c2.x - c1.x) +
      3 * t ** 2 * (end.x - c2.x);
    const vy =
      3 * u ** 2 * (c1.y - start.y) +
      6 * u * t * (c2.y - c1.y) +
      3 * t ** 2 * (end.y - c2.y);
    const angle = (Math.atan2(vy, vx) * 180) / Math.PI;
    const scale = traveling ? 1 - 0.79 * t ** 1.5 : 1 - 0.25 * t;
    return {
      offset: t,
      transform: `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${kind === "bucketlist" ? angle : -8 + t * 14}deg) scale(${scale})`,
      opacity: t > 0.88 ? (1 - t) / 0.12 : 1,
    };
  });
  const animation = node.animate(frames, {
    duration: traveling ? 800 : 300,
    easing: "linear",
    fill: "both",
  });
  const flight: Flight = {
    key,
    cancel: () => {
      animation.cancel();
      node.remove();
      active.delete(flight);
    },
  };
  while (active.size >= 6) active.values().next().value?.cancel();
  active.add(flight);
  void animation.finished
    .then(() => {
      if (traveling && visible(target)) react(target, true);
    })
    .catch(() => {})
    .finally(() => {
      node.remove();
      active.delete(flight);
    });
}
