"use client";
import { ContentImage } from "@/components/ui/content-image";

import { useDecision } from "../ui/decision";
import { createContext, useContext, useSyncExternalStore } from "react";
import Link from "next/link";
import { type Product } from "@/lib/merch-products";
import { php } from "@/lib/commerce";
import { notify, notifyUndo } from "@/lib/client-api";
import { Icon } from "../icon";
import { captureInterest } from "@/lib/analytics-client";
import { FlightCount } from "../ui/flight-count";
import { FloatingDock } from "../ui/floating-dock";
type Entry = {
  productId: number;
  size: string;
  quantity: number;
  priceCentavos?: number;
};
type Snapshot = { items: Entry[]; loaded: boolean; persistent: boolean };
const empty: Snapshot = { items: [], loaded: false, persistent: true };
let snapshot = empty;
const listeners = new Set<() => void>();
const storageKey = "unlock-paradise-cart";
function normalize(value: unknown): Entry[] {
  if (!Array.isArray(value)) return [];
  const result: Entry[] = [];
  for (const entry of value.slice(0, 100)) {
    if (!entry || typeof entry !== "object") continue;
    if (!Number.isInteger(entry.productId)) continue;
    const size = entry.size || "One Size";
    if (
      typeof size !== "string" ||
      size.length > 100 ||
      !Number.isFinite(entry.quantity)
    )
      continue;
    const quantity = Math.min(99, Math.max(1, Math.floor(entry.quantity)));
    const old = result.find(
      (e) => e.productId === entry.productId && e.size === size,
    );
    if (old) old.quantity = Math.min(99, old.quantity + quantity);
    else
      result.push({
        productId: entry.productId,
        size,
        quantity,
        priceCentavos: Number.isSafeInteger(entry.priceCentavos)
          ? entry.priceCentavos
          : undefined,
      });
  }
  return result;
}
function load() {
  try {
    snapshot = {
      items: normalize(JSON.parse(localStorage.getItem(storageKey) || "[]")),
      loaded: true,
      persistent: true,
    };
  } catch {
    snapshot = { items: [], loaded: true, persistent: false };
  }
}
function changed() {
  listeners.forEach((fn) => fn());
}
function external(event: StorageEvent) {
  if (event.key === storageKey || event.key === null) {
    load();
    changed();
  }
}
function subscribe(callback: () => void) {
  if (!listeners.size) {
    load();
    window.addEventListener("storage", external);
  }
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
    if (!listeners.size) window.removeEventListener("storage", external);
  };
}
function save(items: Entry[]) {
  let persistent = true;
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    persistent = false;
  }
  snapshot = { items, loaded: true, persistent };
  changed();
  return persistent;
}
const CartContext = createContext<Snapshot>(empty);
const CatalogContext = createContext<Product[]>([]);
export function useCatalog() {
  return useContext(CatalogContext);
}
export function CartProvider({
  children,
  products,
}: {
  children: React.ReactNode;
  products: Product[];
}) {
  const value = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => empty,
  );
  return (
    <CatalogContext.Provider value={products}>
      <CartContext.Provider value={value}>{children}</CartContext.Provider>
    </CatalogContext.Provider>
  );
}
export function useCart() {
  const data = useContext(CartContext);
  const products = useCatalog();
  const restore = (removed: Entry[]) => {
    const next = normalize([...snapshot.items, ...removed]);
    for (const entry of removed) {
      const current = snapshot.items.find(
        (item) =>
          item.productId === entry.productId && item.size === entry.size,
      );
      const product = products.find((item) => item.id === entry.productId);
      const variant = product?.variants?.find(
        (item) => item.label === entry.size,
      );
      const quantity = (current?.quantity || 0) + entry.quantity;
      if (
        quantity > 99 ||
        (variant?.stock != null &&
          variant.stock > 0 &&
          quantity > variant.stock)
      )
        throw new Error(
          "This quantity cannot be restored. Adjust the cart quantity and try Undo again.",
        );
    }
    const persistent = save(next);
    notify(
      persistent
        ? "Your cart selection was restored."
        : "Restored for this visit. Browser storage is unavailable.",
      !persistent,
    );
  };
  const available = (e: Entry) => {
    const p = products.find((p) => p.id === e.productId);
    const v = p?.variants?.find((v) => v.label === e.size);
    return (
      !!p &&
      p.sizes.includes(e.size) &&
      (!v || v.stock === null || v.stock >= e.quantity)
    );
  };
  const items = data.items.filter(available).map((e) => {
    const p = products.find((p) => p.id === e.productId)!;
    const priceCentavos =
      p.variants?.find((v) => v.label === e.size)?.price_centavos ??
      p.priceCentavos ??
      Math.round(p.price * 100);
    return {
      ...e,
      priceCentavos,
      product: { ...p, price: priceCentavos / 100 },
      priceChanged:
        e.priceCentavos !== undefined && e.priceCentavos !== priceCentavos,
    };
  });
  return {
    ...data,
    items,
    unavailable: data.items.filter((e) => !available(e)),
    count: items.reduce((s, i) => s + i.quantity, 0),
    subtotal: items.reduce((s, i) => s + i.priceCentavos * i.quantity, 0) / 100,
    add: (product: Product, size: string, quantity: number) => {
      if (
        !product.sizes.includes(size) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 99
      )
        return false;
      const existing = snapshot.items.find(
        (i) => i.productId === product.id && i.size === size,
      );
      const variant = product.variants?.find((v) => v.label === size);
      if (
        !product.inStock ||
        (variant?.stock !== null &&
          variant?.stock !== undefined &&
          variant.stock < (existing?.quantity || 0) + quantity)
      ) {
        notify("This quantity is not available. Review your selection.", true);
        return false;
      }
      const priceCentavos =
        variant?.price_centavos ??
        product.priceCentavos ??
        Math.round(product.price * 100);
      const next = existing
        ? snapshot.items.map((i) =>
            i === existing
              ? {
                  ...i,
                  quantity: Math.min(99, i.quantity + quantity),
                  priceCentavos,
                }
              : i,
          )
        : [
            ...snapshot.items,
            { productId: product.id, size, quantity, priceCentavos },
          ];
      const persisted = save(next);
      captureInterest("product_added_to_bag", { product_id: product.id });
      notify(
        persisted
          ? `${product.name} added to your cart.`
          : "Added for this visit. Browser storage is unavailable.",
        !persisted,
      );
      return true;
    },
    quantity: (productId: number, size: string, quantity: number) => {
      const variant = products
        .find((p) => p.id === productId)
        ?.variants?.find((v) => v.label === size);
      if (
        variant?.stock !== undefined &&
        variant.stock !== null &&
        quantity > variant.stock
      ) {
        notify("This quantity exceeds current stock.", true);
        return;
      }
      if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 99)
        save(
          snapshot.items.map((i) =>
            i.productId === productId && i.size === size
              ? { ...i, quantity }
              : i,
          ),
        );
    },
    remove: (productId: number, size: string) => {
      const removed = snapshot.items.filter(
        (item) => item.productId === productId && item.size === size,
      );
      save(
        snapshot.items.filter(
          (i) => i.productId !== productId || i.size !== size,
        ),
      );
      if (removed.length)
        notifyUndo("Item removed from your cart.", () => restore(removed));
    },
    clear: () => {
      const removed = [...snapshot.items];
      save([]);
      if (removed.length)
        notifyUndo("Shopping cart cleared.", () => restore(removed));
    },
  };
}
export const peso = (value: number) => php(Math.round(value * 100));
export function FloatingCart() {
  const cart = useCart();
  return (
    <FloatingDock>
      <Link
        href="/merch/cart/"
        className="p2-floating"
        data-flight-target="bag"
        data-tooltip="Open shopping cart"
        aria-label={`Open shopping cart${cart.loaded ? ` ${cart.count} ${cart.count === 1 ? "item" : "items"}` : ""}`}
      >
        <Icon name="Cart" size={22} />
        <span>Shopping cart</span>{" "}
        <FlightCount value={cart.loaded ? cart.count : "…"} />
      </Link>
    </FloatingDock>
  );
}
export function MerchNav() {
  return (
    <nav className="p2-merch-nav" aria-label="Merchandise">
      <Link href="/merch/">Unlock Paradise / Merch</Link>
    </nav>
  );
}
export function CartPage() {
  const { ask, dialog } = useDecision();
  const cart = useCart();
  return (
    <>
      {dialog}
      <div className="p2-section-head">
        <div>
          <span className="p2-eyebrow">Wear the adventure</span>
          <h1>Shopping cart</h1>
          <p className="p2-muted">
            Save your selection here. Merchandise ordering is not open yet.
          </p>
        </div>
        {cart.items.length > 0 && (
          <button
            className="p2-button p2-button--quiet"
            onClick={async () => {
              if (await ask("Remove all items from your cart?")) cart.clear();
            }}
          >
            Clear cart
          </button>
        )}
      </div>
      {cart.unavailable.length > 0 && (
        <div className="p2-error" role="status">
          <p>
            Some saved selections are unavailable or exceed current stock. They
            are excluded from the subtotal.
          </p>
          {cart.unavailable.map((i) => (
            <div key={`${i.productId}:${i.size}`}>
              Saved selection · {i.size}{" "}
              <button
                className="p2-button p2-button--quiet"
                onClick={() => cart.remove(i.productId, i.size)}
              >
                Remove unavailable selection
              </button>
            </div>
          ))}
        </div>
      )}
      {!cart.loaded ? (
        <p role="status">Loading your cart…</p>
      ) : !cart.items.length ? (
        <div className="p2-empty">
          <h2>Your cart is ready when you are.</h2>
          <p>Explore tees, hoodies, caps and bags from the collection.</p>
          <Link className="p2-button" href="/merch/">
            Explore the collection
          </Link>
        </div>
      ) : (
        <div className="p2-cart-layout">
          <section aria-label="Items in your cart">
            {cart.items.map((i) => (
              <article
                className="p2-cart-item"
                key={`${i.productId}:${i.size}`}
              >
                <Link
                  href={`/merch/products/${i.product.slug}/`}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <ContentImage
                    sizes="96px"
                    src={i.product.displayImage}
                    alt=""
                  />
                </Link>
                <div>
                  <h2>
                    <Link href={`/merch/products/${i.product.slug}/`}>
                      {i.product.name}
                    </Link>
                  </h2>
                  <p className="p2-muted">
                    {i.product.color} · {i.size}
                  </p>
                  <p>{peso(i.product.price)}</p>
                  {i.priceChanged && (
                    <p role="status">
                      The price has changed. The current price is shown.
                    </p>
                  )}
                  <div className="p2-actions">
                    <label>
                      Quantity
                      <input
                        aria-label={`Quantity for ${i.product.name}, ${i.size}`}
                        type="number"
                        min={1}
                        max={99}
                        value={i.quantity}
                        onChange={(e) =>
                          cart.quantity(
                            i.productId,
                            i.size,
                            Number(e.target.value),
                          )
                        }
                      />
                    </label>
                    <button
                      className="p2-icon"
                      aria-label={`Remove ${i.product.name}, ${i.size}`}
                      onClick={() => cart.remove(i.productId, i.size)}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <strong>{php(i.priceCentavos * i.quantity)}</strong>
              </article>
            ))}
          </section>
          <aside className="p2-cart-summary">
            <h2>Your selection</h2>
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{peso(cart.subtotal)}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>To be confirmed</dd>
              </div>
            </dl>
            <p className="p2-muted">
              This is a collection preview. No order is placed and no payment is
              collected.
            </p>
            <Link className="p2-button p2-full" href="/merch/checkout/">
              View ordering status
            </Link>
            <Link className="p2-back" href="/merch/">
              Continue exploring
            </Link>
          </aside>
        </div>
      )}
      {!cart.persistent && (
        <p role="status" className="p2-error">
          Your browser cannot save this cart between visits.
        </p>
      )}
    </>
  );
}
export function MerchCheckout() {
  const cart = useCart();
  return (
    <div className="p2-narrow p2-empty">
      <span className="p2-eyebrow">The next adventure is coming</span>
      <h1>Ordering opens soon.</h1>
      <p>
        {cart.count
          ? `${cart.count} ${cart.count === 1 ? "item is" : "items are"} in your cart. `
          : ""}
        Online orders and payments are not available yet. Your selection stays
        in this browser when storage is available.
      </p>
      <p className="p2-muted">
        Explorer+ membership is separate. Approved demo accounts can try its
        Xendit test checkout.
      </p>
      <Link className="p2-back" href="/membership/">
        View membership plans ↗
      </Link>
      <Link className="p2-button" href="/merch/cart/">
        Return to your cart
      </Link>
      <Link className="p2-button p2-button--quiet" href="/merch/">
        Explore the collection
      </Link>
    </div>
  );
}
