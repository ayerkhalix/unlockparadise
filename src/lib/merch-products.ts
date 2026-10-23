export type SizeGuideRow = {
  size: string;
  chest: string;
  length: string;
  shoulder: string;
};

export type ProductDetails = {
  material: string;
  fit: string;
  weight: string;
  care: string;
};

export type Product = {
  id: number;
  priceCentavos?: number;
  brandId?: string;
  brand?: string;
  collectionId?: string;
  collection?: string;
  collectionTagline?: string;
  seo?: { title: string; description: string };
  imageAlts?: string[];
  variants?: {
    id: string;
    label: string;
    sku: string;
    price_centavos: number;
    stock: number | null;
    active: boolean;
  }[];
  slug: string;
  name: string;
  price: number;
  category: string;
  color: string;
  /** Short descriptor shown on the shop card. */
  descriptor: string;
  /** One-line summary shown near the top of the product page. */
  shortDescription: string;
  /** Editorial "About the product" copy — unique per product. */
  about: string;
  badge?: string;
  inStock: boolean;
  rating: { value: number; count: number };
  /** Sizes. A single "One Size" entry means the product has no real size choice. */
  sizes: string[];
  details: ProductDetails;
  /** Bulleted highlights shown in the Details accordion. */
  highlights: string[];
  /** Optional sizing table for apparel. */
  sizeGuide?: SizeGuideRow[];
  /** Slugs of related products shown in "You might also like". */
  related: string[];
  /** Image shown on the product card. */
  displayImage: string;
  /** Images shown in the gallery/lightbox and the detail-page gallery. */
  images: string[];
};

const apparelSizeGuide: SizeGuideRow[] = [
  { size: "S", chest: '20"', length: '27"', shoulder: '18"' },
  { size: "M", chest: '21"', length: '28"', shoulder: '19"' },
  { size: "L", chest: '23"', length: '29"', shoulder: '20"' },
  { size: "XL", chest: '25"', length: '30"', shoulder: '21"' },
  { size: "XXL", chest: '27"', length: '31"', shoulder: '22"' },
];

/**
 * Original catalog import fixture and reusable product types.
 * Runtime storefront data is read from Supabase by repositories/commerce.ts.
 * To swap in the client's real assets later, replace the image paths below.
 */
export const products: Product[] = [
  {
    id: 1,
    slug: "whats-it-gonna-be-tee",
    name: "What's It Gonna Be Tee",
    price: 999,
    category: "Tees",
    color: "Navy",
    descriptor: "Front & Back Design",
    shortDescription:
      "A premium heavyweight cotton tee with a subtle front chest emblem and a bold statement back graphic.",
    about:
      "Built for spontaneous road trips, weekend hikes, and everything in between. The What\u2019s It Gonna Be Tee pairs everyday comfort with an adventure-inspired graphic designed to represent the places worth getting lost in. Whether it is beaches, rivers, or waterfalls, this tee is your reminder to keep chasing the next horizon.",
    badge: "NEW ARRIVAL",
    inStock: true,
    rating: { value: 4.8, count: 124 },
    sizes: ["S", "M", "L", "XL", "XXL"],
    details: {
      material: "100% Premium Cotton",
      fit: "Relaxed Fit",
      weight: "Heavyweight",
      care: "Machine wash cold / Hang dry",
    },
    highlights: [
      "Premium cotton construction",
      "Front and back screen-printed graphic",
      "Relaxed everyday fit",
      "Soft, breathable and built to last",
      "Designed for outdoor adventures",
    ],
    sizeGuide: apparelSizeGuide,
    related: [
      "wander-pullover-hoodie",
      "summit-trail-cap",
      "explorer-canvas-tote",
    ],
    displayImage: "/merch/images/tee1-display.png",
    images: [
      "/merch/images/tee1-display.png",
      "/merch/images/tee1-front.png",
      "/merch/images/tee1-back.png",
      "/merch/images/tee1-detail.png",
    ],
  },
  {
    id: 2,
    slug: "wander-pullover-hoodie",
    name: "Wander Pullover Hoodie",
    price: 1899,
    category: "Hoodies",
    color: "Sand",
    descriptor: "Heavyweight Fleece",
    shortDescription:
      "A cozy heavyweight fleece pullover finished with a minimalist mountain range printed across the back.",
    about:
      "When the trail turns cold and the sun dips behind the ridge, the Wander Pullover Hoodie keeps you moving. Brushed fleece on the inside, a clean mountain-line graphic on the back, and a relaxed silhouette that layers over anything. Made for early call times, campfire nights, and the long drive home.",
    badge: "BESTSELLER",
    inStock: true,
    rating: { value: 4.9, count: 88 },
    sizes: ["S", "M", "L", "XL", "XXL"],
    details: {
      material: "80% Cotton / 20% Polyester",
      fit: "Regular Fit",
      weight: "Heavyweight Fleece",
      care: "Machine wash cold / Tumble dry low",
    },
    highlights: [
      "Brushed heavyweight fleece interior",
      "Minimalist mountain-range back print",
      "Ribbed cuffs and hem for warmth",
      "Kangaroo pocket",
      "Relaxed layering fit",
    ],
    sizeGuide: apparelSizeGuide,
    related: [
      "whats-it-gonna-be-tee",
      "summit-trail-cap",
      "explorer-canvas-tote",
    ],
    displayImage: "/merch/images/hoodie-display.png",
    images: [
      "/merch/images/hoodie-display.png",
      "/merch/images/hoodie-back.png",
    ],
  },
  {
    id: 3,
    slug: "summit-trail-cap",
    name: "Summit Trail Cap",
    price: 699,
    category: "Headwear",
    color: "Navy",
    descriptor: "Embroidered Logo",
    shortDescription:
      "A structured six-panel cap with a clean embroidered palm emblem and an adjustable strap for any head size.",
    about:
      "Shade for the summit and everything before it. The Summit Trail Cap keeps the sun out of your eyes with a structured crown, a curved brim, and a tonal embroidered emblem that quietly says you have been places. One adjustable strap, endless trails.",
    inStock: true,
    rating: { value: 4.7, count: 63 },
    sizes: ["One Size"],
    details: {
      material: "Cotton Twill",
      fit: "Adjustable Strap",
      weight: "Structured Crown",
      care: "Spot clean only",
    },
    highlights: [
      "Structured six-panel crown",
      "Tonal embroidered palm emblem",
      "Curved brim",
      "Adjustable back strap",
      "One size fits most",
    ],
    related: [
      "whats-it-gonna-be-tee",
      "wander-pullover-hoodie",
      "explorer-canvas-tote",
    ],
    displayImage: "/merch/images/cap-display.png",
    images: ["/merch/images/cap-display.png", "/merch/images/cap-side.png"],
  },
  {
    id: 4,
    slug: "explorer-canvas-tote",
    name: "Explorer Canvas Tote",
    price: 549,
    category: "Bags",
    color: "Natural",
    descriptor: "Heavy Canvas",
    shortDescription:
      "A durable heavy-canvas tote with a printed adventure badge \u2014 built for market runs and shoreline hauls.",
    about:
      "Made from heavy natural canvas that only gets better with wear, the Explorer Canvas Tote carries your day trips with room to spare. Reinforced handles, a roomy main compartment, and a printed sun-and-mountain badge on the front. Reusable, rugged, and ready for whatever you throw in it.",
    badge: "ECO",
    inStock: true,
    rating: { value: 4.6, count: 41 },
    sizes: ["One Size"],
    details: {
      material: "100% Heavy Cotton Canvas",
      fit: "Oversized Carry-All",
      weight: "16 oz Canvas",
      care: "Hand wash / Air dry",
    },
    highlights: [
      "Heavy 16 oz cotton canvas",
      "Reinforced carry handles",
      "Printed sun-and-mountain badge",
      "Roomy main compartment",
      "Reusable and eco-friendly",
    ],
    related: [
      "whats-it-gonna-be-tee",
      "wander-pullover-hoodie",
      "summit-trail-cap",
    ],
    displayImage: "/merch/images/tote-display.png",
    images: ["/merch/images/tote-display.png"],
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getRelatedProducts(product: Product): Product[] {
  return product.related
    .map((slug) => getProductBySlug(slug))
    .filter((p): p is Product => Boolean(p));
}

/** True when the product offers a real size choice (not a single "One Size"). */
export function hasSizeChoice(product: Product): boolean {
  return !(product.sizes.length === 1 && product.sizes[0] === "One Size");
}
