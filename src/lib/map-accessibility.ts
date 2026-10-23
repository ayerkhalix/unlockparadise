// Mapbox 3.4 puts attribution's title on an aria-hidden child. Name the button.
export function labelMapControls(container: HTMLElement) {
  container
    .querySelectorAll<HTMLButtonElement>(".mapboxgl-control-container button")
    .forEach((button) => {
      const label =
        button.getAttribute("aria-label") ||
        button.querySelector("[title]")?.getAttribute("title");
      if (label) {
        button.setAttribute("aria-label", label);
        button.setAttribute("data-tooltip", label);
      }
    });
}
