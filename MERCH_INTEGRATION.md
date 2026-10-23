# Merch integration

The original repository at `C:\Users\Ayer\Documents\GitHub\unlockparadise-merchpage` was inspected read-only. It is a Next.js 16.3 storefront with four product definitions, product PNGs, variant/quantity selection and a browser-local shopping cart. Its checkout says coming soon. There is no commerce API, order service, inventory service, payment integration or working purchase flow to port.

Phase 2 integrates the real catalog into `src/lib/merch-products.ts` and copies ten source images to `public/merch/images/`. The original repository's files are unchanged. Source ratings, review counts, bestseller labels and inventory claims are not presented as verified live commerce data.

| Route                     | Behavior                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `/merch/`                 | Photographic collection, category filter and search                                                |
| `/merch/products/[slug]/` | Real product imagery, gallery, material/care, sizes, quantity, sizing and related catalog products |
| `/merch/cart/`            | Variant-specific quantities, remove/clear, catalog-derived prices and persistent cart              |
| `/merch/checkout/`        | Explicit ordering-unavailable state and return links                                               |

The cart validates stored product IDs, sizes and quantities (1–99), resolves prices from the catalog, and reports storage failures. It uses the original `unlock-paradise-cart` browser key with a safe adapter. It does not collect payment or shipping data, create an order, fabricate delivery totals or show a fake successful checkout.

The main brand header/footer, typography, navy/teal/gold palette, focus states and shared dialogs are used throughout. The global floating action becomes a shopping cart throughout merch, product, cart and ordering-status routes. It shares the local cart provider and updates the item count immediately. Browser tests verify variant choice, quantity, reload persistence, removal and the truthful checkout state.

Real ordering remains blocked on a commerce backend, inventory/order requirements and separately authorized payment setup. This foundation is suitable for catalog preview and local cart use.
