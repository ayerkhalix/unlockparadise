"use client";
import { useEffect, useRef, useState } from "react";
import { ValidatedForm } from "../ui/validated-form";
import { useDecision } from "../ui/decision";
import {
  adminRequest,
  type Row,
  list,
  useAdminData,
  LoadState,
} from "./shared";
import { CatalogChoice } from "./catalog-choice";
import { centavos, moneyInput, productInput } from "@/lib/commerce";
import {
  DEFAULT_BRAND,
  DEFAULT_COLLECTION,
  productCategories,
  productColors,
  productSizes,
  slugFromName,
} from "@/lib/catalog-options";
import { notify } from "@/lib/client-api";
import { ZodError } from "zod";
import type { SizeGuideRow } from "@/lib/merch-products";

type Variant = {
  id?: string;
  label: string;
  sku: string;
  price: string;
  stock: string;
  active: boolean;
};
type Image = { src: string; alt: string };
export function ProductEditor({
  initial,
  onClose,
  onDirty,
  onBusyChange,
}: {
  initial: Row | null;
  onClose: () => void;
  onDirty: (v: boolean) => void;
  onBusyChange?: (v: boolean) => void;
}) {
  const { ask, dialog } = useDecision();
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [optionBusy, setOptionBusy] = useState(false),
    [error, setError] = useState(""),
    [uploadError, setUploadError] = useState("");
  const [images, setImages] = useState<Image[]>(
    (initial?.images as Image[]) || [],
  );
  const fileInput = useRef<HTMLInputElement>(null),
    replaceIndex = useRef<number | null>(null);
  const content = (initial?.content || {}) as Row;
  const [sizeGuide, setSizeGuide] = useState<SizeGuideRow[]>(
    (content.sizeGuide as SizeGuideRow[]) || [],
  );
  const [name, setName] = useState(String(initial?.name || "")),
    [slug, setSlug] = useState(String(initial?.slug || "")),
    [sku, setSku] = useState(String(initial?.sku || ""));
  const manualSlug = useRef(!!initial),
    manualSku = useRef(!!initial),
    skuSuffix = useRef("");
  const [brand, setBrand] = useState(
      String(initial?.brand_id || DEFAULT_BRAND),
    ),
    [collection, setCollection] = useState(
      String(initial?.collection_id || DEFAULT_COLLECTION),
    );
  const [category, setCategory] = useState(String(initial?.category || "Tees")),
    [color, setColor] = useState(String(content.color || "Navy"));
  const [price, setPrice] = useState(
    moneyInput(Number(initial?.price_centavos || 0)),
  );
  const [variants, setVariants] = useState<Variant[]>(
    initial
      ? list(initial.merch_variants).map((v) => ({
          id: String(v.id),
          label: String(v.label),
          sku: String(v.sku),
          price: moneyInput(Number(v.price_centavos)),
          stock: v.stock === null ? "" : String(v.stock),
          active: !!v.active,
        }))
      : [
          {
            label: "One Size",
            sku: "",
            price: "0.00",
            stock: "0",
            active: true,
          },
        ],
  );
  const options = useAdminData("catalog-options");
  const [created, setCreated] = useState<Row[]>([]);
  const brands = [
    ...list(options.data?.brands),
    ...created.filter((r) => r.kind === "brand"),
  ];
  const collections = [
    ...new Map(
      [
        ...list(options.data?.collections),
        ...created.filter((r) => r.kind === "collection"),
      ].map((r) => [String(r.id), r]),
    ).values(),
  ].filter((r) => r.brand_id === brand);
  const selectedCollection = collections.find((r) => r.id === collection);
  const names = (kind: string, defaults: string[]) =>
    [
      ...new Set([
        ...defaults,
        ...list(options.data?.options)
          .filter((r) => r.kind === kind)
          .map((r) => String(r.name)),
        ...created.filter((r) => r.kind === kind).map((r) => String(r.name)),
      ]),
    ].map((v) => ({ value: v, label: v }));
  const mark = () => {
    setDirty(true);
    onDirty(true);
  };
  const create = (kind: string) => async (value: string, tagline?: string) => {
    setOptionBusy(true);
    onBusyChange?.(true);
    try {
      const result = await adminRequest<{ data: Row }>(
        "catalog-options",
        "POST",
        {
          kind,
          name: value,
          ...(kind === "collection"
            ? { brand_id: brand, tagline: tagline || "" }
            : {}),
        },
      );
      setCreated((rows) => [...rows, { ...result.data, kind }]);
      const id = String(result.data.id);
      if (kind === "brand") {
        setBrand(id);
        setCollection("");
      } else if (kind === "collection") setCollection(id);
      else if (kind === "category") setCategory(value);
      else if (kind === "color") setColor(value);
      mark();
      notify(`${value} added.`);
    } finally {
      setOptionBusy(false);
      onBusyChange?.(false);
    }
  };
  const saveCollectionTagline = async (tagline: string) => {
    setOptionBusy(true);
    onBusyChange?.(true);
    try {
      const result = await adminRequest<{ data: Row }>(
        "catalog-options",
        "PATCH",
        {
          id: collection,
          tagline,
          expected_tagline: String(selectedCollection?.tagline || ""),
        },
      );
      setCreated((rows) => [
        ...rows.filter((r) => r.id !== collection),
        { ...result.data, kind: "collection" },
      ]);
      notify("Collection tagline saved.");
    } finally {
      setOptionBusy(false);
      onBusyChange?.(false);
    }
  };
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const locked = busy || uploading || optionBusy;
  const changeVariant = (
    i: number,
    key: keyof Variant,
    value: string | boolean,
  ) => {
    mark();
    setVariants((rows) =>
      rows.map((v, n) => (n === i ? { ...v, [key]: value } : v)),
    );
  };
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const selected = [...files],
      replace = replaceIndex.current;
    replaceIndex.current = null;
    if (replace === null && images.length + selected.length > 8) {
      setUploadError("Use up to 8 photos.");
      return;
    }
    if (
      selected.some(
        (f) =>
          f.size > 5 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(f.type),
      )
    ) {
      setUploadError("Choose JPG, PNG or WebP photos up to 5 MB each.");
      return;
    }
    setUploading(true);
    onBusyChange?.(true);
    setUploadError("");
    mark();
    try {
      for (const [i, file] of selected.entries()) {
        const body = new FormData();
        body.set("file", file);
        body.set("visibility", "public");
        body.set("alt", name || file.name.replace(/\.[^.]+$/, ""));
        const response = await fetch("/api/admin/upload/", {
          method: "POST",
          body,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Upload failed.");
        const image = {
          src: `/api/media/${result.data.id}/`,
          alt: name || file.name,
        };
        setImages((rows) =>
          replace !== null && i === 0
            ? rows.map((r, n) => (n === replace ? image : r))
            : [...rows, image],
        );
      }
    } catch (e) {
      setUploadError(
        e instanceof Error
          ? e.message
          : "Upload failed. Successfully uploaded photos are kept; retry the remaining photos.",
      );
    } finally {
      setUploading(false);
      onBusyChange?.(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  return (
    <section className="studio-editor product-editor">
      {dialog}
      <div className="studio-heading">
        <div>
          <h1>{initial ? "Edit product" : "Add product"}</h1>
          <p>Choose your options, upload photos, and set a price.</p>
        </div>
        <button
          disabled={locked}
          onClick={async () => {
            if (dirty && !(await ask("Discard unsaved product changes?")))
              return;
            onDirty(false);
            onClose();
          }}
        >
          Back to Merchandise
        </button>
      </div>
      <LoadState
        loading={options.loading}
        error={options.error}
        retry={options.reload}
      />
      <ValidatedForm
        data-backend="true"
        onChange={mark}
        onSubmit={async (e) => {
          e.preventDefault();
          if (locked) return;
          if (!images.length) {
            setUploadError("Upload at least one product photo before saving.");
            fileInput.current?.focus();
            return;
          }
          setBusy(true);
          onBusyChange?.(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const submitter = (e.nativeEvent as SubmitEvent)
              .submitter as HTMLButtonElement | null;
            const status = submitter?.value || String(f.get("status"));
            if (
              status === "archived" &&
              !(await ask(
                `Archive ${name}? It will leave the storefront. Existing orders retain their records.`,
              ))
            )
              return;
            const body = productInput.parse({
              name,
              slug,
              sku,
              brand_id: brand,
              collection_id: collection,
              description: f.get("description"),
              category,
              price_centavos: centavos(price),
              compare_at_centavos: f.get("compare")
                ? centavos(String(f.get("compare")))
                : null,
              status,
              featured: f.has("featured"),
              images,
              content: {
                ...content,
                descriptor: String(f.get("descriptor") || ""),
                shortDescription: String(f.get("shortDescription") || ""),
                color,
                details: {
                  ...((content.details as Record<string, string>) || {}),
                  ...Object.fromEntries(
                    ["material", "fit", "weight", "care"].map((key) => [
                      key,
                      String(f.get(`detail_${key}`) || "").trim(),
                    ]),
                  ),
                },
                highlights: String(f.get("highlights") || "")
                  .split(/\r?\n/)
                  .map((v) => v.trim())
                  .filter(Boolean),
                sizeGuide: sizeGuide.map((row) =>
                  Object.fromEntries(
                    Object.entries(row).map(([key, value]) => [
                      key,
                      value.trim(),
                    ]),
                  ),
                ),
                seo: {
                  title: String(f.get("seo_title") || ""),
                  description: String(f.get("seo_description") || ""),
                },
              },
              expected_version: initial ? Number(initial.version) : undefined,
              variants: variants.map((v, i) => ({
                id: v.id,
                label: v.label,
                sku: v.sku || `${sku}-${i + 1}`,
                price_centavos: centavos(v.price),
                stock: v.stock === "" ? null : Number(v.stock),
                active: v.active,
              })),
            });
            await adminRequest(
              initial ? `merchandise/${initial.id}` : "merchandise",
              initial ? "PATCH" : "POST",
              body,
            );
            onDirty(false);
            setDirty(false);
            notify(
              status === "publish"
                ? "Product published."
                : status === "archived"
                  ? "Product archived."
                  : "Product saved.",
            );
            onClose();
          } catch (e) {
            setError(
              e instanceof ZodError
                ? e.issues.map((issue) => issue.message).join(" ")
                : e instanceof Error
                  ? e.message
                  : "Product could not be saved.",
            );
          } finally {
            setBusy(false);
            onBusyChange?.(false);
          }
        }}
      >
        <fieldset
          disabled={locked || options.loading || !!options.error}
          className="product-editor__fields"
        >
          <section className="studio-form-section">
            <h2>Product details</h2>
            <label>
              Product name
              <input
                name="name"
                required
                maxLength={200}
                value={name}
                onChange={(e) => {
                  const value = e.target.value;
                  setName(value);
                  if (!manualSlug.current)
                    setSlug(slugFromName(value).slice(0, 160));
                  if (!manualSku.current) {
                    skuSuffix.current ||= crypto
                      .randomUUID()
                      .slice(0, 8)
                      .toUpperCase();
                    setSku(
                      `${slugFromName(value).slice(0, 40).toUpperCase()}-${skuSuffix.current}`,
                    );
                  }
                }}
              />
            </label>
            <div className="admin-fields">
              <CatalogChoice
                label="Brand"
                value={brand}
                choices={brands.map((b) => ({
                  value: String(b.id),
                  label: String(b.name),
                }))}
                onChange={(v) => {
                  setBrand(v);
                  setCollection("");
                  mark();
                }}
                onCreate={create("brand")}
              />
              <CatalogChoice
                label="Collection"
                value={collection}
                choices={collections.map((c) => ({
                  value: String(c.id),
                  label: String(c.name),
                }))}
                onChange={(v) => {
                  setCollection(v);
                  mark();
                }}
                onCreate={create("collection")}
                tagline={String(selectedCollection?.tagline || "")}
                onSaveTagline={saveCollectionTagline}
                disabled={!brand}
              />
              <CatalogChoice
                label="Category"
                value={category}
                choices={names("category", productCategories)}
                onChange={(v) => {
                  setCategory(v);
                  mark();
                }}
                onCreate={create("category")}
              />
              <CatalogChoice
                label="Color"
                value={color}
                choices={names("color", productColors)}
                onChange={(v) => {
                  setColor(v);
                  mark();
                }}
                onCreate={create("color")}
              />
            </div>
            <label>
              Card highlight (optional)
              <input
                name="descriptor"
                maxLength={200}
                defaultValue={String(content.descriptor || "")}
                placeholder="Front & Back Design"
              />
              <span className="catalog-choice__hint">
                Shown beside the color on product cards. Add a feature,
                material, or print.
              </span>
            </label>
            <label>
              Short description
              <input
                name="shortDescription"
                maxLength={500}
                defaultValue={String(content.shortDescription || "")}
              />
            </label>
            <label>
              Description
              <textarea
                className="resize-none"
                name="description"
                maxLength={10000}
                rows={4}
                defaultValue={String(initial?.description || "")}
              />
            </label>
          </section>
          <section className="studio-form-section">
            <h2>Photos</h2>
            <p>
              Upload this product’s photos. The first photo is the cover. JPG,
              PNG or WebP, up to 5 MB each; 8 photos maximum.
            </p>
            <input
              ref={fileInput}
              type="file"
              required={images.length === 0}
              multiple
              accept="image/jpeg,image/png,image/webp"
              aria-label="Upload product photos"
              onChange={(e) => void upload(e.target.files)}
            />
            <p role="status">
              {uploading
                ? "Uploading and verifying photos…"
                : `${images.length} of 8 photos`}
            </p>
            {uploadError && (
              <p role="alert" className="studio-error">
                {uploadError}
              </p>
            )}
            <div className="product-photo-grid">
              {images.map((image, i) => (
                <div className="product-photo" key={image.src + ":" + i}>
                  <img
                    src={image.src}
                    alt={image.alt || "Product preview"}
                    width={240}
                    height={240}
                  />
                  <strong>{i === 0 ? "Cover photo" : `Photo ${i + 1}`}</strong>
                  <label>
                    Photo description
                    <input
                      maxLength={300}
                      value={image.alt}
                      onChange={(e) =>
                        setImages((rows) =>
                          rows.map((r, n) =>
                            n === i ? { ...r, alt: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="studio-row-actions">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => {
                        setImages([image, ...images.filter((_, n) => n !== i)]);
                        mark();
                      }}
                    >
                      Make cover
                    </button>
                    <button
                      type="button"
                      disabled={i === 0}
                      aria-label={`Move up photo ${i + 1}`}
                      onClick={() => {
                        const next = [...images];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        setImages(next);
                        mark();
                      }}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        replaceIndex.current = i;
                        if (fileInput.current) {
                          fileInput.current.multiple = false;
                          fileInput.current.click();
                        }
                      }}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImages(images.filter((_, n) => n !== i));
                        mark();
                      }}
                    >
                      Remove photo
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={images.length >= 8}
              onClick={() => {
                replaceIndex.current = null;
                if (fileInput.current) {
                  fileInput.current.multiple = true;
                  fileInput.current.click();
                }
              }}
            >
              {images.length ? "Add photos" : "Upload photos"}
            </button>
          </section>
          <section className="studio-form-section">
            <h2>Options & pricing</h2>
            <label>
              Product price (PHP)
              <input
                name="price"
                required
                inputMode="decimal"
                pattern="[0-9]+(\.[0-9]{1,2})?"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setVariants((rows) =>
                    rows.map((v) =>
                      v.price === price ? { ...v, price: e.target.value } : v,
                    ),
                  );
                }}
              />
            </label>
            <p>
              Choose sizes and set available stock. Blank stock means inventory
              is not counted.
            </p>
            {variants.map((v, i) => (
              <div className="studio-variant" key={v.id || i}>
                <CatalogChoice
                  label={`Size / option ${i + 1}`}
                  value={v.label}
                  choices={names("size", productSizes)}
                  onChange={(value) => changeVariant(i, "label", value)}
                  onCreate={async (value) => {
                    await create("size")(value);
                    changeVariant(i, "label", value);
                  }}
                />
                <label>
                  Price (PHP)
                  <input
                    required
                    inputMode="decimal"
                    pattern="[0-9]+(\.[0-9]{1,2})?"
                    value={v.price}
                    onChange={(e) => changeVariant(i, "price", e.target.value)}
                  />
                </label>
                <label>
                  Stock
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    step={1}
                    value={v.stock}
                    onChange={(e) => changeVariant(i, "stock", e.target.value)}
                  />
                </label>
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={v.active}
                    onChange={(e) =>
                      changeVariant(i, "active", e.target.checked)
                    }
                  />
                  Available
                </label>
                <details>
                  <summary>Option SKU</summary>
                  <label>
                    SKU
                    <input
                      maxLength={80}
                      value={v.sku}
                      placeholder={`${sku}-${i + 1}`}
                      onChange={(e) => changeVariant(i, "sku", e.target.value)}
                    />
                  </label>
                </details>
                <button
                  type="button"
                  disabled={variants.length === 1}
                  onClick={() => {
                    setVariants(variants.filter((_, n) => n !== i));
                    mark();
                  }}
                >
                  Remove option {i + 1}
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={variants.length >= 50}
              onClick={() => {
                setVariants([
                  ...variants,
                  { label: "", sku: "", price, stock: "0", active: true },
                ]);
                mark();
              }}
            >
              Add option
            </button>
          </section>
          <section className="studio-form-section">
            <h2>Details & care</h2>
            <p className="catalog-choice__hint">
              Optional information shown on the product page.
            </p>
            <div className="admin-fields">
              {[
                ["material", "Material", "100% cotton"],
                ["fit", "Fit", "Relaxed fit"],
                ["weight", "Fabric weight", "240 GSM"],
              ].map(([key, label, placeholder]) => (
                <label key={key}>
                  {label}
                  <input
                    name={`detail_${key}`}
                    maxLength={500}
                    defaultValue={String((content.details as Row)?.[key] || "")}
                    placeholder={placeholder}
                  />
                </label>
              ))}
            </div>
            <label>
              Care instructions
              <textarea
                name="detail_care"
                rows={3}
                maxLength={500}
                defaultValue={String((content.details as Row)?.care || "")}
                placeholder="Machine wash cold. Do not bleach. Hang to dry."
              />
            </label>
            <label>
              Product highlights
              <textarea
                name="highlights"
                rows={3}
                defaultValue={((content.highlights as string[]) || []).join(
                  "\n",
                )}
                placeholder={
                  "Soft cotton fabric\nScreen-printed front and back"
                }
              />
              <span className="catalog-choice__hint">
                One highlight per line. Up to 20, with 300 characters each.
              </span>
            </label>
          </section>
          <section className="studio-form-section">
            <h2>Size guide</h2>
            <p className="catalog-choice__hint">
              Optional garment measurements in inches. Leave empty for products
              that do not need a size guide.
            </p>
            {sizeGuide.map((row, i) => (
              <fieldset className="product-size-row" key={i}>
                <legend>Measurement row {i + 1}</legend>
                <div className="product-size-row__fields">
                  <label>
                    Size
                    <select
                      required
                      aria-label={`Size guide size ${i + 1}`}
                      value={row.size}
                      onChange={(e) => {
                        setSizeGuide((rows) =>
                          rows.map((r, n) =>
                            n === i ? { ...r, size: e.target.value } : r,
                          ),
                        );
                        mark();
                      }}
                    >
                      <option value="">Choose size</option>
                      {[
                        ...new Set(
                          [
                            ...productSizes,
                            ...names("size", []).map((s) => s.value),
                            ...variants.map((v) => v.label).filter(Boolean),
                            row.size,
                          ].filter(Boolean),
                        ),
                      ].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(["chest", "length", "shoulder"] as const).map((key) => (
                    <label key={key}>
                      {key[0].toUpperCase() + key.slice(1)}
                      <input
                        aria-label={`Size guide ${key} ${i + 1}`}
                        maxLength={30}
                        value={row[key]}
                        placeholder="—"
                        onChange={(e) => {
                          setSizeGuide((rows) =>
                            rows.map((r, n) =>
                              n === i ? { ...r, [key]: e.target.value } : r,
                            ),
                          );
                          mark();
                        }}
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    aria-label={`Remove measurement row ${i + 1}`}
                    onClick={() => {
                      setSizeGuide((rows) => rows.filter((_, n) => n !== i));
                      mark();
                    }}
                  >
                    Remove
                  </button>
                </div>
              </fieldset>
            ))}
            <button
              type="button"
              disabled={sizeGuide.length >= 20}
              onClick={() => {
                const next =
                  [...variants.map((v) => v.label), ...productSizes].find(
                    (size) => size && !sizeGuide.some((r) => r.size === size),
                  ) || "";
                setSizeGuide((rows) => [
                  ...rows,
                  { size: next, chest: "", length: "", shoulder: "" },
                ]);
                mark();
              }}
            >
              Add measurement row
            </button>
          </section>
          <details className="studio-form-section">
            <summary>Advanced</summary>
            <div className="admin-fields">
              <label>
                Slug
                <input
                  name="slug"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={160}
                  value={slug}
                  onChange={(e) => {
                    manualSlug.current = true;
                    setSlug(e.target.value);
                  }}
                />
              </label>
              <label>
                Product SKU
                <input
                  name="sku"
                  required
                  maxLength={80}
                  value={sku}
                  onChange={(e) => {
                    manualSku.current = true;
                    setSku(e.target.value);
                  }}
                />
              </label>
              <label>
                Compare-at price (PHP)
                <input
                  name="compare"
                  inputMode="decimal"
                  pattern="[0-9]+(\.[0-9]{1,2})?"
                  defaultValue={
                    initial?.compare_at_centavos
                      ? moneyInput(Number(initial.compare_at_centavos))
                      : ""
                  }
                />
              </label>
              <label>
                Search title
                <input
                  name="seo_title"
                  maxLength={160}
                  defaultValue={String((content.seo as Row)?.title || "")}
                />
              </label>
              <label>
                Search description
                <textarea
                  className="resize-none"
                  name="seo_description"
                  maxLength={320}
                  defaultValue={String((content.seo as Row)?.description || "")}
                />
              </label>
            </div>
          </details>
          <section className="studio-form-section">
            <h2>Publish</h2>
            <label>
              Publication status
              <select
                name="status"
                defaultValue={String(initial?.status || "draft")}
              >
                <option value="draft">Draft</option>
                <option value="publish">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="studio-check">
              <input
                type="checkbox"
                name="featured"
                defaultChecked={!!initial?.featured}
              />
              Feature this product
            </label>
          </section>
        </fieldset>
        {error && (
          <p role="alert" className="studio-error">
            {error}
          </p>
        )}
        <div className="studio-savebar">
          <span role="status">
            {busy
              ? "Saving…"
              : uploading
                ? "Uploading…"
                : dirty
                  ? "Unsaved changes"
                  : "Ready"}
          </span>
          <button
            type="submit"
            value="draft"
            disabled={locked || options.loading}
          >
            Save draft
          </button>
          <button
            type="submit"
            value="publish"
            className="admin-primary"
            disabled={locked || options.loading}
          >
            Publish product
          </button>
          <button type="submit" disabled={locked || options.loading}>
            Save changes
          </button>
        </div>
      </ValidatedForm>
    </section>
  );
}
