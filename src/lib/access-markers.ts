import type { AccessPoint } from "./access-points";
import { iconPath } from "@/components/icon";
export function accessMarker(
  point: AccessPoint,
  onSelect?: () => void,
  placement: "above" | "below" = "above",
) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("role", "button");
  button.className = "access-map-marker";
  button.dataset.labelSide = placement;
  button.setAttribute("aria-label", `${point.type}: ${point.name}`);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 -960 960 960");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    iconPath(
      point.type === "Boat departure"
        ? "Boat"
        : point.type === "Trailhead"
          ? "Hike"
          : "Directions",
    ),
  );
  svg.append(path);
  button.append(svg);
  const label = document.createElement("span");
  label.className = "access-map-marker__label";
  label.textContent = `${point.type} · ${point.name}`;
  button.append(label);
  if (onSelect) button.addEventListener("click", onSelect);
  return button;
}
