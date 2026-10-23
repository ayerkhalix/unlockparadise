import { travelFlight } from "./travel-motion";
export function animateCartAddition(
  control: HTMLElement | null,
  image: string,
) {
  const product = control?.closest(".p2-product-card,.p2-product-detail");
  travelFlight({
    kind: "bag",
    control,
    image,
    photo: product?.querySelector<HTMLElement>(
      ".p2-product-main img,.p2-product-card__photo img",
    ),
  });
}
