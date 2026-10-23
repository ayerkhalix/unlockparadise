"use client";
import { useRef, useState } from "react";
import { safeHtml } from "@/lib/html";
import { useDecision } from "./ui/decision";
import { notify } from "@/lib/client-api";
import { paragraphs } from "@/lib/paragraphs";
export function RichTextEditor({
  name,
  label,
  initial,
}: {
  name: string;
  label: string;
  initial: string;
}) {
  const { ask, dialog } = useDecision();
  const [value, setValue] = useState(initial),
    [preview, setPreview] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrap = async (tag: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart,
      end = el.selectionEnd;
    const selected = value.slice(start, end);
    let open = `<${tag}>`;
    const close = `</${tag}>`;
    if (tag === "a") {
      const href = await ask("Source URL (https://…)", "");
      if (!href) return;
      try {
        if (!["https:", "http:"].includes(new URL(href).protocol))
          throw new Error();
      } catch {
        notify("Enter a complete http:// or https:// source URL.", true);
        return;
      }
      open = `<a href="${href.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}">`;
    }
    setValue(
      value.slice(0, start) + open + selected + close + value.slice(end),
    );
    el.focus();
  };
  return (
    <div className="p2-rich-editor">
      {dialog}
      <div
        className="p2-actions"
        role="group"
        aria-label={`${label} formatting`}
      >
        <button type="button" onClick={() => wrap("strong")}>
          Bold
        </button>
        <button type="button" onClick={() => wrap("h3")}>
          Heading
        </button>
        <button type="button" onClick={() => wrap("a")}>
          Source link
        </button>
        <button
          type="button"
          aria-pressed={preview}
          onClick={() => setPreview(!preview)}
        >
          {preview ? "Hide preview" : "Preview formatting"}
        </button>
      </div>
      <label>
        {label}
        <textarea
          className="resize-none"
          ref={ref}
          name={name}
          value={value}
          rows={8}
          onChange={(e) => setValue(e.target.value)}
          maxLength={100000}
        />
      </label>
      <p className="p2-muted">
        Select text to format. Keep factual content and credits intact. Unsafe
        HTML is removed on save.
      </p>
      {preview && (
        <div
          className="p2-guide-copy p2-rich-preview"
          dangerouslySetInnerHTML={{ __html: safeHtml(paragraphs(value)) }}
        />
      )}
    </div>
  );
}
