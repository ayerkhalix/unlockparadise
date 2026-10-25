"use client";
import { ValidatedForm } from "./ui/validated-form";
import { mediaAvailable } from "@/lib/media-availability";
import { useEffect, useRef, useState } from "react";
import { CoordinatePicker } from "./coordinate-picker";
import { RichTextEditor } from "./rich-text-editor";
import { RecommendationEditor } from "./recommendation-editor";
import { useDecision } from "./ui/decision";
import { slugFromName } from "@/lib/catalog-options";
import { MultiChoice } from "./ui/multi-choice";
import {
  AccessPointEditor,
  type AccessPointDraft,
} from "./access-point-editor";
import { notify } from "@/lib/client-api";
import { TravelerTargeting } from "./traveler-targeting";
import { NearbyPlaceEditor } from "./nearby-place-editor";
import type { NearbyPlace } from "@/lib/nearby-places";
import { PhotoFocalPoint } from "./ui/photo-focal-point";
import { associationFocalPoint, type FocalPoint } from "@/lib/focal-point";
type Row = Record<string, unknown>;
export function PlaceEditor({
  initial,
  onClose,
  onDirtyChange,
  onBusyChange,
}: {
  initial: Row | null;
  onClose: () => void;
  onDirtyChange?: (value: boolean) => void;
  onBusyChange?: (value: boolean) => void;
}) {
  const { ask, dialog } = useDecision();
  const [placeSlug, setPlaceSlug] = useState(String(initial?.slug || ""));
  const manualSlug = useRef(!!initial);
  const [dirty, setDirty] = useState(false);
  const [recommendationsDirty, setRecommendationsDirty] = useState(false),
    [recommendationsBusy, setRecommendationsBusy] = useState(false);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  useEffect(() => {
    if (!dirty && !recommendationsDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, recommendationsDirty]);
  const [areas, setAreas] = useState<Row[]>([]),
    [categories, setCategories] = useState<Row[]>([]),
    [media, setMedia] = useState<Row[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    onBusyChange?.(busy || recommendationsBusy || nearbyBusy);
  }, [busy, recommendationsBusy, nearbyBusy, onBusyChange]);
  const details = (initial?.place_details || {}) as Row;
  const [travelerTypes, setTravelerTypes] = useState<string[]>(
    (details.traveler_types as string[]) || [],
  );
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>(
    (details.nearby_places as NearbyPlace[]) || [],
  );
  const [accessPoints, setAccessPoints] = useState<AccessPointDraft[]>(
    (
      (details.access_points ||
        []) as import("@/lib/access-points").AccessPoint[]
    ).map((p) => ({
      ...p,
      latitude: String(p.latitude),
      longitude: String(p.longitude),
    })),
  );
  const markDirty = () => {
    setDirty(true);
    onDirtyChange?.(true);
  };
  const [gallery, setGallery] = useState<string[]>(
    (
      (initial?.place_media || []) as {
        kind: string;
        position: number;
        media_id: string;
      }[]
    )
      .filter((m) => m.kind === "gallery")
      .sort((a, b) => a.position - b.position)
      .map((m) => m.media_id),
  );
  const [lat, setLat] = useState(
      details.latitude == null ? "" : String(details.latitude),
    ),
    [lng, setLng] = useState(
      details.longitude == null ? "" : String(details.longitude),
    );
  const [mediaSearch, setMediaSearch] = useState("");
  const originalCover = (
    (initial?.place_media || []) as { kind: string; media_id: string }[]
  ).find((m) => m.kind === "cover")?.media_id;
  const [coverId, setCoverId] = useState(String(originalCover || ""));
  const [focalPoints, setFocalPoints] = useState<Record<string, FocalPoint>>(
    () =>
      Object.fromEntries(
        ((initial?.place_media || []) as Row[]).map((photo) => [
          String(photo.media_id),
          associationFocalPoint(
            photo as { focal_x?: number; focal_y?: number },
          ),
        ]),
      ),
  );
  const focusPhoto = (id: string, point: FocalPoint) => {
    setFocalPoints((points) => ({ ...points, [id]: point }));
    setDirty(true);
    onDirtyChange?.(true);
  };
  useEffect(() => {
    let disposed = false;
    void Promise.all([
      fetch("/api/admin/taxonomy/").then((r) => r.json()),
      fetch("/api/admin/media/").then((r) => r.json()),
    ])
      .then(([tax, images]) => {
        if (!disposed) {
          setAreas(tax.areas || []);
          setCategories(tax.categories || []);
          setMedia(images.data || []);
        }
      })
      .catch(() => setMessage("Could not load editor options."));
    return () => {
      disposed = true;
    };
  }, []);
  return (
    <>
      {dialog}
      <div className="admin-toolbar">
        <h1>{initial ? "Edit Place" : "Add Place"}</h1>
        <button
          disabled={busy || recommendationsBusy || nearbyBusy}
          onClick={async () => {
            if (
              (dirty || recommendationsDirty) &&
              !(await ask("Discard unsaved Place changes?"))
            )
              return;
            onClose();
          }}
        >
          Back to Places
        </button>
      </div>
      <nav className="place-editor-jumps" aria-label="Place editor sections">
        <a href="#place-basics">Details</a>
        <a href="#place-audience">Traveler types</a>
        <a href="#place-nearby">Nearby places</a>
        <a
          href="#place-photos"
          onClick={() => {
            const section = document.getElementById("place-photos");
            if (section instanceof HTMLDetailsElement) section.open = true;
          }}
        >
          Photos
        </a>
      </nav>
      <ValidatedForm
        className="place-editor-form"
        data-backend="true"
        onChange={() => {
          setDirty(true);
          onDirtyChange?.(true);
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || recommendationsBusy || nearbyBusy) return;
          setBusy(true);
          onBusyChange?.(true);
          setMessage("");
          const data = new FormData(e.currentTarget);
          const list = (key: string) => data.getAll(key).map(String),
            number = (key: string) =>
              data.get(key) === "" ? null : Number(data.get(key));
          const body = {
            expected_updated_at: initial?.updated_at || undefined,
            seo: {
              title: String(data.get("seo_title") || ""),
              description: String(data.get("seo_description") || ""),
              canonical: String(data.get("seo_canonical") || ""),
            },
            title: data.get("title"),
            slug: data.get("slug"),
            status:
              (
                (e.nativeEvent as SubmitEvent)
                  .submitter as HTMLButtonElement | null
              )?.value || data.get("status"),
            vip_content: data.has("vip_content"),
            premium_content: data.has("premium_content"),
            listing_types: list("listing_types"),
            travel_minutes: number("travel_minutes"),
            boat_required: data.has("boat_required"),
            departure_port: data.get("departure_port") || null,
            journey_start: String(data.get("journey_start") || "City proper"),
            road_minutes: number("road_minutes"),
            boat_minutes: number("boat_minutes"),
            hike_minutes: number("hike_minutes"),
            travel_notes: data.get("travel_notes"),
            transport_minutes: Object.fromEntries(
              ["Motorcycle", "Car", "4x4", "Boat"].map((mode) => [
                mode,
                number(`transport_${mode}`),
              ]),
            ),
            accessibility: list("accessibility"),
            assets: list("assets"),
            featured: data.has("featured"),
            feature_order: Number(data.get("feature_order") || 0),
            description: data.get("description"),
            content: data.get("content"),
            excerpt: data.get("excerpt"),
            latitude: lat === "" ? null : Number(lat),
            longitude: lng === "" ? null : Number(lng),
            access_points: accessPoints.map((p) => ({
              ...p,
              latitude: p.latitude === "" ? null : Number(p.latitude),
              longitude: p.longitude === "" ? null : Number(p.longitude),
            })),
            traveler_types: travelerTypes,
            nearby_places: nearbyPlaces,
            weekday_crowd: data.get("weekday_crowd"),
            weekend_crowd: data.get("weekend_crowd"),
            area_ids: list("area_ids"),
            category_ids: list("category_ids"),
            cover_id: data.get("cover_id") || null,
            gallery,
            focal_points: Object.fromEntries(
              [...new Set([coverId, ...gallery])]
                .filter(Boolean)
                .map((id) => [id, focalPoints[id] || { x: 50, y: 50 }]),
            ),
          };
          try {
            if (
              recommendationsDirty &&
              !(await ask(
                "Save the Place and discard unsaved recommendation changes? Save recommendations first to keep them.",
              ))
            )
              return;
            if (
              body.status === "archived" &&
              !(await ask(
                `Archive ${String(body.title)}? Saved lists, reviews and trip history will be retained.`,
              ))
            )
              return;
            const response = await fetch(
              initial
                ? `/api/admin/places/${initial.id}/`
                : "/api/admin/places/",
              {
                method: initial ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              },
            );
            const result = await response.json();
            if (!response.ok)
              throw new Error(
                result.error +
                  (result.fields
                    ? " " +
                      result.fields
                        .map(
                          (x: { path: string[]; message: string }) =>
                            x.path.join(".") + ": " + x.message,
                        )
                        .join("; ")
                    : ""),
              );
            setDirty(false);
            onDirtyChange?.(false);
            notify(
              body.status === "publish"
                ? "Place published."
                : body.status === "archived"
                  ? "Place archived."
                  : "Place saved.",
            );
            onClose();
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Please try again.",
            );
          } finally {
            setBusy(false);
            onBusyChange?.(false);
          }
        }}
      >
        <h2 id="place-basics">Details & publishing</h2>
        <div className="admin-fields">
          <label>
            Title
            <input
              name="title"
              maxLength={300}
              defaultValue={String(initial?.title || "")}
              onChange={(e) => {
                if (!manualSlug.current)
                  setPlaceSlug(slugFromName(e.target.value).slice(0, 240));
              }}
              required
            />
          </label>
          <label>
            Slug
            <input
              name="slug"
              maxLength={240}
              pattern="[a-z0-9%_-]+"
              value={placeSlug}
              onChange={(e) => {
                manualSlug.current = true;
                setPlaceSlug(e.target.value);
              }}
              required
            />
          </label>
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
          <label>
            Travel time (minutes)
            <input
              type="number"
              name="travel_minutes"
              min={0}
              step="any"
              defaultValue={String(initial?.travel_minutes ?? "")}
            />
          </label>
          <label>
            Homepage order
            <input
              type="number"
              name="feature_order"
              defaultValue={String(initial?.feature_order || 0)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              name="featured"
              defaultChecked={Boolean(initial?.featured)}
            />
            Featured on homepage
          </label>
          <label>
            <input
              type="checkbox"
              name="vip_content"
              defaultChecked={Boolean(initial?.vip_content)}
            />
            Explorer+ restriction
          </label>
          <label>
            <input
              type="checkbox"
              name="premium_content"
              defaultChecked={Boolean(initial?.premium_content)}
            />
            Legacy premium flag (retained separately)
          </label>
        </div>
        <details className="studio-form-section">
          <summary>Getting there: road and boat</summary>
          <fieldset>
            <legend>Getting there by road and boat</legend>
            <p>
              Leave unknown durations blank. The legacy travel time above is
              preserved separately and is never assumed to be boat or hike time.
            </p>
            <label>
              <input
                type="checkbox"
                name="boat_required"
                defaultChecked={Boolean(details.boat_required)}
              />
              Verified boat access required
            </label>
            <div className="admin-fields">
              <label>
                Starting point
                <input
                  name="journey_start"
                  maxLength={200}
                  required
                  defaultValue={String(details.journey_start || "City proper")}
                />
              </label>
              <label>
                Departure port or access point
                <input
                  name="departure_port"
                  maxLength={200}
                  defaultValue={String(details.departure_port || "")}
                />
              </label>
              {[
                ["road_minutes", "City to port by road (minutes)"],
                ["boat_minutes", "Port to destination by boat (minutes)"],
                ["hike_minutes", "Verified hike time (minutes)"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    type="number"
                    min={0}
                    max={100000}
                    step="any"
                    defaultValue={String(details[key] ?? "")}
                  />
                </label>
              ))}
            </div>
            <label>
              Travel notes
              <textarea
                className="resize-none"
                name="travel_notes"
                rows={3}
                maxLength={5000}
                defaultValue={String(details.travel_notes || "")}
              />
            </label>
            <div className="admin-fields">
              {["Motorcycle", "Car", "4x4", "Boat"].map((mode) => (
                <label key={mode}>
                  {mode} access duration (minutes)
                  <input
                    name={`transport_${mode}`}
                    type="number"
                    min={0}
                    max={100000}
                    step="any"
                    defaultValue={String(
                      (
                        details.transport_minutes as
                          Record<string, number | null> | undefined
                      )?.[mode] ?? "",
                    )}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        </details>
        <h2>Description</h2>
        <RichTextEditor
          onDirty={markDirty}
          name="description"
          label="Description"
          initial={String(details.description || "")}
        />
        <details>
          <summary>Original post content and excerpt</summary>
          <label>
            Content
            <textarea
              className="resize-none"
              name="content"
              rows={8}
              defaultValue={String(details.content || "")}
            />
          </label>
          <label>
            Excerpt
            <textarea
              className="resize-none"
              name="excerpt"
              defaultValue={String(details.excerpt || "")}
            />
          </label>
        </details>
        <fieldset>
          <legend>Listing type</legend>
          {["destination", "lot"].map((v) => (
            <label key={v}>
              <input
                type="checkbox"
                name="listing_types"
                value={v}
                defaultChecked={(
                  (initial?.listing_types as string[]) || ["destination"]
                ).includes(v)}
              />
              {v === "lot" ? "Lot for sale" : "Destination"}
            </label>
          ))}
        </fieldset>
        <div className="admin-fields">
          <MultiChoice
            name="area_ids"
            label="Areas"
            choices={areas.map((a) => ({
              value: String(a.id),
              label: String(a.name),
            }))}
            initial={((initial?.place_areas || []) as Row[]).map((a) =>
              String(a.area_id),
            )}
            onChange={markDirty}
          />
          <MultiChoice
            name="category_ids"
            label="Categories"
            choices={categories.map((a) => ({
              value: String(a.id),
              label: String(a.name),
            }))}
            initial={((initial?.place_categories || []) as Row[]).map((a) =>
              String(a.category_id),
            )}
            onChange={markDirty}
          />
        </div>
        <AccessPointEditor
          points={accessPoints}
          onChange={(p) => {
            setAccessPoints(p);
            markDirty();
          }}
        />
        <TravelerTargeting
          value={travelerTypes}
          onChange={(value) => {
            setTravelerTypes(value);
            markDirty();
          }}
        />
        <NearbyPlaceEditor
          value={nearbyPlaces}
          onBusyChange={setNearbyBusy}
          onChange={(update) => {
            setNearbyPlaces(update);
            markDirty();
          }}
        />
        <details className="studio-form-section">
          <summary>Transport, destination assets & location</summary>
          <div className="admin-fields">
            <MultiChoice
              name="accessibility"
              label="Access types"
              choices={["Motorcycle", "Car", "4x4", "Boat", "Hike"].map(
                (v) => ({ value: v, label: v }),
              )}
              initial={(initial?.accessibility as string[]) || []}
              onChange={markDirty}
            />
            <MultiChoice
              name="assets"
              label="Facilities & features"
              choices={[
                "Sunrise view",
                "Sunset view",
                "Surfing spot",
                "Accommodation available",
                "Culture",
                "Activities",
                "Food",
              ].map((v) => ({ value: v, label: v }))}
              initial={(initial?.assets as string[]) || []}
              onChange={markDirty}
            />
          </div>
          <div className="admin-fields">
            {[
              ["weekday_crowd", "Weekday crowd"],
              ["weekend_crowd", "Weekend / holiday crowd"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <select name={key} defaultValue={String(details[key] || "")}>
                  <option value="">Not specified</option>
                  <option>Crowded</option>
                  <option>Uncrowded</option>
                </select>
              </label>
            ))}
            <label>
              Latitude
              <input
                type="number"
                min={-90}
                max={90}
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                min={-180}
                max={180}
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </label>
          </div>
          <CoordinatePicker
            latitude={lat}
            longitude={lng}
            onPick={(latitude, longitude) => {
              setLat(String(latitude));
              setLng(String(longitude));
              setDirty(true);
              onDirtyChange?.(true);
            }}
          />
        </details>
        <details id="place-photos" className="studio-form-section">
          <summary>Photos & gallery</summary>
          <label>
            Find uploaded media by legacy ID, UUID or title
            <input
              value={mediaSearch}
              onChange={(e) => setMediaSearch(e.target.value)}
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const r = await fetch(
                    "/api/admin/media/?search=" +
                      encodeURIComponent(mediaSearch),
                  );
                  const data = await r.json();
                  if (!r.ok) throw new Error(data.error);
                  setMedia(data.data || []);
                } catch (error) {
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : "Could not find media.",
                  );
                }
              }}
            >
              Find media
            </button>
          </label>
          <label>
            Public featured image
            <select
              name="cover_id"
              value={coverId}
              onChange={(event) => setCoverId(event.target.value)}
            >
              <option value="">No cover</option>
              {originalCover && !media.some((m) => m.id === originalCover) && (
                <option value={originalCover}>Current saved cover</option>
              )}
              {media
                .filter(
                  (m) => m.bucket === "destination-public" && mediaAvailable(m),
                )
                .map((m) => (
                  <option key={String(m.id)} value={String(m.id)}>
                    {String(m.alt || m.legacy_id || m.id)}
                  </option>
                ))}
            </select>
          </label>
          {coverId && (
            <PhotoFocalPoint
              disabled={busy}
              src={`/api/media/${coverId}/`}
              value={focalPoints[coverId]}
              onChange={(point) => focusPhoto(coverId, point)}
            />
          )}
          <fieldset>
            <legend>Gallery (ordered, up to eight photos)</legend>
            <label>
              Add image
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value && gallery.length < 8)
                    setGallery([...gallery, e.target.value]);
                }}
              >
                <option value="">Select an uploaded image</option>
                {media
                  .filter(
                    (m) => mediaAvailable(m) && m.bucket !== "profile-private",
                  )
                  .map((m) => (
                    <option key={String(m.id)} value={String(m.id)}>
                      {String(m.alt || m.legacy_id || m.id)}
                    </option>
                  ))}
              </select>
            </label>
            <ol>
              {gallery.map((id, i) => (
                <li key={id + "-" + i}>
                  <span>
                    {String(
                      media.find((m) => m.id === id)?.alt ||
                        `Saved photo ${i + 1}`,
                    )}
                  </span>{" "}
                  <PhotoFocalPoint
                    disabled={busy}
                    src={`/api/media/${id}/`}
                    value={focalPoints[id]}
                    onChange={(point) => focusPhoto(id, point)}
                  />
                  <button
                    type="button"
                    disabled={!i}
                    onClick={() => {
                      const next = [...gallery];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      setGallery(next);
                      setDirty(true);
                      onDirtyChange?.(true);
                    }}
                  >
                    Move up
                  </button>{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setGallery(gallery.filter((_, n) => n !== i));
                      setDirty(true);
                      onDirtyChange?.(true);
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          </fieldset>
        </details>
        <details className="studio-form-section">
          <summary>Search / SEO</summary>
          {[
            ["seo_title", "Search title", 160],
            ["seo_description", "Search description", 320],
            ["seo_canonical", "Canonical HTTPS URL (optional)", 500],
          ].map(([key, label, max]) => (
            <label key={key}>
              {label}
              <input
                name={String(key)}
                maxLength={Number(max)}
                defaultValue={String(
                  (details.seo as Row)?.[String(key).replace("seo_", "")] || "",
                )}
              />
            </label>
          ))}
        </details>
        <p role="alert">{message}</p>
        <div className="studio-savebar">
          <span role="status">
            {nearbyBusy
              ? "Finding Google photo…"
              : busy || recommendationsBusy
                ? "Saving…"
                : dirty || recommendationsDirty
                  ? "Unsaved changes"
                  : "Ready"}
          </span>
          <button
            type="submit"
            value="draft"
            disabled={busy || recommendationsBusy || nearbyBusy}
          >
            Save draft
          </button>
          <button
            type="submit"
            value="publish"
            disabled={busy || recommendationsBusy || nearbyBusy}
          >
            Publish
          </button>
          {initial && (
            <a
              href={`/admin/preview/${initial.id}/`}
              target="_blank"
              rel="noreferrer"
            >
              Preview saved Place
            </a>
          )}
          <button
            className="admin-primary"
            disabled={busy || recommendationsBusy || nearbyBusy}
          >
            {busy ? "Saving…" : "Save Place"}
          </button>
        </div>
      </ValidatedForm>
      {initial?.id ? (
        <RecommendationEditor
          placeId={String(initial.id)}
          disabled={busy}
          onDirtyChange={(value) => {
            setRecommendationsDirty(value);
            onDirtyChange?.(dirty || value);
          }}
          onBusyChange={(value) => {
            setRecommendationsBusy(value);
            onBusyChange?.(busy || value);
          }}
        />
      ) : (
        <p>Save this Place first to manage recommendations.</p>
      )}
    </>
  );
}
