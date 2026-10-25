"use client";
import { SearchInput } from "../ui/search-input";
import { ValidatedForm } from "../ui/validated-form";
import { useState } from "react";
import Link from "next/link";
import { type Product } from "@/lib/merch-products";
import { peso, useCart, useCatalog } from "./cart";
import { Modal } from "../ui/modal";
import { InterestView } from "../analytics-preferences";
import { animateCartAddition } from "@/lib/cart-animation";
import { groupMerchCollections } from "@/lib/merch-collections";
import { ContentImage } from "../ui/content-image";
export function ProductCard({
  product: p,
  preview = false,
}: {
  product: Product;
  preview?: boolean;
}) {
  const presentation = (
    <>
      <div className="p2-product-card__photo">
        <ContentImage src={p.displayImage} alt={p.name} loading="lazy" />
        <span>{p.category}</span>
      </div>
      <div className="p2-product-card__info">
        <h3>{p.name}</h3>
        <strong>{peso(p.price)}</strong>
      </div>
      {(p.color || p.descriptor) && (
        <p>{[p.color, p.descriptor].filter(Boolean).join(" · ")}</p>
      )}
    </>
  );
  return (
    <article className="p2-product-card">
      {preview ? (
        <div className="p2-product-card__link">{presentation}</div>
      ) : (
        <Link
          className="p2-product-card__link"
          href={`/merch/products/${p.slug}/`}
        >
          {presentation}
        </Link>
      )}
      {preview ? (
        <p className="p2-muted">
          {p.sizes.join(" · ") || "Add sizes in the editor"}
        </p>
      ) : (
        <AddToBag product={p} compact image={p.displayImage} />
      )}
    </article>
  );
}
function AddToBag({
  product: p,
  image,
  compact = false,
  onSize,
  onGuide,
}: {
  product: Product;
  image: string;
  compact?: boolean;
  onSize?: (size: string) => void;
  onGuide?: () => void;
}) {
  const cart = useCart();
  const [size, setSize] = useState(p.sizes.length === 1 ? p.sizes[0] : "");
  const [quantity, setQuantity] = useState(1);
  const choose = (value: string) => {
    setSize(value);
    onSize?.(value);
  };
  return (
    <ValidatedForm
      className={compact ? "p2-product-add" : "p2-form"}
      data-backend="true"
      onSubmit={(e) => {
        e.preventDefault();
        if (size && cart.add(p, size, quantity))
          animateCartAddition(
            (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null,
            image,
          );
      }}
    >
      {compact ? (
        <label>
          Size
          <select
            aria-label={`Size for ${p.name}`}
            value={size}
            onChange={(e) => choose(e.target.value)}
            required
          >
            <option value="" disabled>
              Select
            </option>
            {p.sizes.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <fieldset className="p2-sizes">
            <legend>
              {p.sizes.length === 1 ? "Size" : "Choose your size"}
            </legend>
            {p.sizes.map((s) => (
              <label key={s}>
                <input
                  type="radio"
                  name="size"
                  value={s}
                  checked={size === s}
                  onChange={() => choose(s)}
                  required
                />
                <span>{s}</span>
              </label>
            ))}
          </fieldset>
          {!!p.sizeGuide?.length && (
            <button type="button" className="p2-size-guide" onClick={onGuide}>
              View size guide ↗
            </button>
          )}
          <label className="p2-quantity">
            Quantity
            <input
              type="number"
              min={1}
              max={99}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
        </>
      )}
      <button
        className="p2-button"
        disabled={!cart.loaded || !p.inStock}
        aria-label={
          compact
            ? `${p.inStock ? "Add to cart" : "Currently unavailable"}: ${p.name}`
            : undefined
        }
      >
        {p.inStock ? "Add to cart" : "Currently unavailable"}
      </button>
      <p className="p2-merch-availability">
        {compact
          ? "Preview only · Ordering opens soon"
          : "Ordering opens soon. You can save items in your cart."}
      </p>
    </ValidatedForm>
  );
}
export function Store() {
  const products = useCatalog();
  const [category, setCategory] = useState("All"),
    [search, setSearch] = useState(""),
    [brand, setBrand] = useState("");
  const shown = products.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      (!brand || p.brandId === brand) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const collections = groupMerchCollections(shown);
  return (
    <>
      <section className="p2-merch-hero">
        <div>
          <h1>
            Keep Palawan
            <br />
            close.
          </h1>
          <p>Tees, layers and everyday pieces from Unlock Paradise.</p>
          <a className="p2-button" href="#collection">
            Shop the collection
          </a>
        </div>
        {products[0] && (
          <figure>
            <ContentImage
              src={products[0].displayImage}
              alt={`${products[0].name}, ${products[0].color}`}
              fetchPriority="high"
            />
            <figcaption>
              {products[0].name} · {products[0].color}
            </figcaption>
          </figure>
        )}
      </section>
      <div className="p2-collection-head" id="collection">
        <div>
          <p className="p2-muted">Collection preview · Ordering opens soon</p>
        </div>
      </div>
      <div
        className="merch-filter-scroll"
        role="region"
        aria-label="Merchandise filters"
        tabIndex={0}
      >
        <div className="merch-filters">
          <label>
            Search merch
            <SearchInput
              label="Search merch"
              value={search}
              onValueChange={setSearch}
              placeholder="Find your next favorite"
            />
          </label>
          <label>
            Brand
            <select
              aria-label="Brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            >
              <option value="">All brands</option>
              {[
                ...new Map(
                  products.map((p) => [
                    p.brandId || "",
                    p.brand || "Unlock Paradise",
                  ]),
                ).entries(),
              ].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              aria-label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="All">All categories</option>
              {[...new Set(products.map((p) => p.category))].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <p className="merch-filter-hint">Scroll for more filters</p>
      <p className="p2-muted" role="status">
        {shown.length} {shown.length === 1 ? "piece" : "pieces"}
      </p>
      {shown.length ? (
        collections.map((section, index) => (
          <section
            className="merch-collection-section"
            key={section.id}
            aria-labelledby={`merch-collection-${index}`}
            data-collection-id={section.id}
          >
            <header className="merch-collection-heading">
              <div className="merch-collection-title">
                <h2 id={`merch-collection-${index}`}>{section.name}</h2>
                {section.tagline && (
                  <p className="merch-collection-tagline">{section.tagline}</p>
                )}
              </div>
              <p className="merch-collection-meta">
                {section.brand} · {section.products.length}{" "}
                {section.products.length === 1 ? "piece" : "pieces"}
              </p>
            </header>
            <div className="p2-product-grid">
              {section.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="p2-empty">
          <h3>No matching pieces</h3>
          <button
            className="p2-button"
            onClick={() => {
              setSearch("");
              setCategory("All");
              setBrand("");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
export function ProductDetail({
  product: p,
  preview = false,
}: {
  product: Product;
  preview?: boolean;
}) {
  const products = useCatalog();
  const [size, setSize] = useState(p.sizes.length === 1 ? p.sizes[0] : ""),
    [photo, setPhoto] = useState(0),
    [zoom, setZoom] = useState(false),
    [guide, setGuide] = useState(false);
  return (
    <>
      {!preview && <InterestView productId={p.id} />}
      {!preview && (
        <Link className="p2-back" href="/merch/">
          ← The collection
        </Link>
      )}
      <div className="p2-product-detail">
        <section aria-label="Product photographs">
          <button
            className="p2-product-main"
            aria-label={`Enlarge ${p.name} photo ${photo + 1}`}
            onClick={() => setZoom(true)}
          >
            <ContentImage
              src={p.images[photo]}
              alt={`${p.name}, view ${photo + 1}`}
            />
          </button>
          <div className="p2-product-thumbs">
            {p.images.map((src, i) => (
              <button
                key={src}
                aria-label={`Show product photo ${i + 1}`}
                aria-pressed={photo === i}
                onClick={() => setPhoto(i)}
              >
                <ContentImage src={src} alt="" />
              </button>
            ))}
          </div>
        </section>
        <section className="p2-product-info">
          <span className="p2-eyebrow">
            {p.category} · {p.color}
          </span>
          <h1>{p.name}</h1>
          <p className="p2-product-price">
            {peso(
              (p.variants?.find((v) => v.label === size)?.price_centavos ??
                p.priceCentavos ??
                Math.round(p.price * 100)) / 100,
            )}
          </p>
          <p className="p2-muted">{p.shortDescription}</p>
          <p className="p2-preview-label">
            Collection preview · Ordering opens soon
          </p>
          {preview ? (
            <div className="p2-form">
              <label>
                Size
                <select value={size} onChange={(e) => setSize(e.target.value)}>
                  <option value="">Select size</option>
                  {p.sizes.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {!!p.sizeGuide?.length && (
                <button
                  type="button"
                  className="p2-size-guide"
                  onClick={() => setGuide(true)}
                >
                  View size guide ↗
                </button>
              )}
              <p className="p2-muted">
                Preview only · Cart actions are disabled.
              </p>
            </div>
          ) : (
            <AddToBag
              product={p}
              image={p.images[photo]}
              onSize={setSize}
              onGuide={() => setGuide(true)}
            />
          )}
          <details className="p2-product-accordion" open>
            <summary>About this piece</summary>
            <p>{p.about}</p>
          </details>
          {(p.highlights.length > 0 ||
            Object.values(p.details).some((value) => value.trim())) && (
            <details className="p2-product-accordion">
              <summary>Details & care</summary>
              {p.highlights.length > 0 && (
                <ul>
                  {p.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
              <dl>
                {Object.entries(p.details)
                  .filter(([, value]) => value.trim())
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
            </details>
          )}
          <details className="p2-product-accordion">
            <summary>Ordering & delivery</summary>
            <p>
              Online ordering is not available yet. Delivery options and final
              availability will be confirmed when the store opens.
            </p>
          </details>
        </section>
      </div>
      {!preview && (
        <section className="p2-related-products">
          <h2>You might also like</h2>
          <div className="p2-product-grid">
            {products
              .filter(
                (product) =>
                  product.id !== p.id &&
                  (!p.related.length || p.related.includes(product.slug)),
              )
              .slice(0, 3)
              .map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
          </div>
        </section>
      )}
      {zoom && (
        <Modal title={p.name} onClose={() => setZoom(false)}>
          <ContentImage
            className="p2-product-zoom"
            src={p.images[photo]}
            alt={`${p.name}, view ${photo + 1}`}
          />
          <div className="p2-actions">
            <button
              className="p2-button p2-button--quiet"
              disabled={photo === 0}
              onClick={() => setPhoto(photo - 1)}
            >
              Previous photo
            </button>
            <span>
              {photo + 1} / {p.images.length}
            </span>
            <button
              className="p2-button p2-button--quiet"
              disabled={photo === p.images.length - 1}
              onClick={() => setPhoto(photo + 1)}
            >
              Next photo
            </button>
          </div>
        </Modal>
      )}
      {guide && (
        <Modal title="Size guide" onClose={() => setGuide(false)}>
          <div className="p2-table-scroll">
            <table className="p2-size-table">
              <caption>Garment measurements (inches)</caption>
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Chest</th>
                  <th>Length</th>
                  <th>Shoulder</th>
                </tr>
              </thead>
              <tbody>
                {p.sizeGuide?.map((r) => (
                  <tr key={r.size}>
                    <th scope="row">{r.size}</th>
                    <td>{r.chest}</td>
                    <td>{r.length}</td>
                    <td>{r.shoulder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </>
  );
}
