"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { ValidatedForm } from "./ui/validated-form";
import { useDecision } from "./ui/decision";
import { adminRequest as request } from "./admin/shared";
import { StudioTable } from "./admin/shared";
import { list } from "./admin/shared";
import { uploadAdminImage } from "@/lib/admin-image-upload";
type Row = Record<string, unknown>;
export function MediaUpload({
  onSaved,
  publicOnly = false,
}: {
  onSaved: () => void;
  publicOnly?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const transfer = useRef<AbortController | null>(null);
  useEffect(() => () => transfer.current?.abort(), []);
  return (
    <ValidatedForm
      data-backend="true"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = e.currentTarget;
        const file = new FormData(form).get("file");
        if (!(file instanceof File) || file.size > 20 * 1024 * 1024) {
          setMessage("Use an image up to 20 MB.");
          return;
        }
        setBusy(true);
        setMessage("");
        transfer.current = new AbortController();
        try {
          const values = new FormData(form);
          await uploadAdminImage(
            file,
            String(values.get("visibility") || "private"),
            String(values.get("alt") || ""),
            setMessage,
            transfer.current.signal,
          );
          form.reset();
          setMessage("Uploaded and verified.");
          onSaved();
        } catch (error) {
          setMessage(
            error instanceof Error && error.name === "AbortError"
              ? "Upload stopped. Any saved original is kept; select the file again to retry."
              : error instanceof Error
                ? error.message
                : "Upload failed.",
          );
        } finally {
          setBusy(false);
          transfer.current = null;
        }
      }}
    >
      <h2>Upload an image</h2>
      <p>
        JPG, PNG or WebP · maximum 20 MB. Your original is preserved privately;
        website sizes are prepared automatically.
      </p>
      <div className="admin-fields">
        <label>
          Image
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            required
            disabled={busy}
          />
        </label>
        <label>
          Visibility
          <select
            name="visibility"
            defaultValue={publicOnly ? "public" : "private"}
            disabled={publicOnly || busy}
          >
            <option value="private">Member gallery (private)</option>
            <option value="public">Public cover / category image</option>
          </select>
          {publicOnly && (
            <input type="hidden" name="visibility" value="public" />
          )}
        </label>
        <label>
          Alternative text
          <input name="alt" maxLength={1000} disabled={busy} />
        </label>
      </div>
      <button type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Upload image"}
      </button>
      {busy && message !== "Preparing image sizes…" && (
        <button type="button" onClick={() => transfer.current?.abort()}>
          Cancel upload
        </button>
      )}
      <p role="status">{message}</p>
    </ValidatedForm>
  );
}
export function TaxonomyManager() {
  const { ask, dialog } = useDecision();
  const [kind, setKind] = useState("areas"),
    [rows, setRows] = useState<Row[]>([]),
    [message, setMessage] = useState("");
  const load = useCallback(
    () => request("taxonomy").then((result) => setRows(list(result[kind]))),
    [kind],
  );
  useEffect(() => {
    void load().catch((error) => setMessage(error.message));
  }, [load]);
  return (
    <details>
      {dialog}
      <summary>Manage areas and categories</summary>
      <select
        aria-label="Taxonomy type"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
      >
        <option value="areas">Areas</option>
        <option value="categories">Categories</option>
      </select>
      <StudioTable
        caption="Areas and categories"
        columns={[
          { label: "Name", render: (r) => String(r.name) },
          { label: "Slug", render: (r) => String(r.slug) },
          { label: "Description", render: (r) => String(r.description) },
          {
            label: "Actions",
            render: (row) => (
              <div className="admin-actions">
                <button
                  onClick={async () => {
                    const name = await ask("Name", String(row.name));
                    if (!name) return;
                    try {
                      await request(kind + "/" + row.id, "PATCH", {
                        name,
                        description: String(row.description),
                      });
                      await load();
                    } catch (e) {
                      setMessage(
                        e instanceof Error ? e.message : "Could not save.",
                      );
                    }
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (
                      !(await ask(
                        "Delete this taxonomy? Referenced terms cannot be deleted.",
                      ))
                    )
                      return;
                    try {
                      await request(kind + "/" + row.id, "DELETE");
                      await load();
                    } catch (e) {
                      setMessage(
                        e instanceof Error ? e.message : "Could not delete.",
                      );
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            ),
          },
        ]}
        rows={rows}
      />
      <ValidatedForm
        data-backend="true"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          try {
            await request(kind, "POST", Object.fromEntries(new FormData(form)));
            form.reset();
            await load();
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Please try again.",
            );
          }
        }}
      >
        <label>
          Name
          <input name="name" required />
        </label>
        <label>
          Slug
          <input name="slug" pattern="[a-z0-9-]+" required />
        </label>
        <label>
          Description
          <textarea className="resize-none" name="description" />
        </label>
        <button type="submit">
          Create {kind === "areas" ? "area" : "category"}
        </button>
      </ValidatedForm>
      <p role="status">{message}</p>
    </details>
  );
}
