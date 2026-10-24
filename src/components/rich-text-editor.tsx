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
  onDirty,
}: {
  name: string;
  label: string;
  initial: string;
  onDirty?: () => void;
}) {
  const { ask, dialog } = useDecision();
  const [value, setValue] = useState(initial),
    [source, setSource] = useState(false);
  const editor = useRef<HTMLDivElement>(null),
    selection = useRef<Range | null>(null);
  const remember = () => {
    const selected = window.getSelection();
    if (selected?.rangeCount && editor.current?.contains(selected.anchorNode))
      selection.current = selected.getRangeAt(0).cloneRange();
  };
  const changed = () => {
    const html = editor.current?.innerHTML || "";
    if (html.length > 100000) {
      notify(
        "Description is too long. Keep it under 100,000 characters.",
        true,
      );
      return;
    }
    setValue(html);
    onDirty?.();
  };
  const format = async (command: string, argument?: string) => {
    if (command === "createLink") {
      const href = await ask("Source URL (https://…)", "");
      if (!href) return;
      try {
        if (!["https:", "http:"].includes(new URL(href).protocol))
          throw new Error();
      } catch {
        notify("Enter a complete http:// or https:// source URL.", true);
        return;
      }
      argument = href;
    }
    editor.current?.focus();
    if (
      selection.current &&
      editor.current?.contains(selection.current.commonAncestorContainer)
    ) {
      const selected = window.getSelection();
      selected?.removeAllRanges();
      selected?.addRange(selection.current);
    }
    // Browser editing keeps keyboard shortcuts and the native undo history together.
    document.execCommand(command, false, argument);
    changed();
    remember();
  };
  return (
    <div className="p2-rich-editor">
      {dialog}
      <div
        className="p2-actions rich-editor-toolbar"
        role="group"
        aria-label={`${label} formatting`}
      >
        {[
          ["Bold", "bold"],
          ["Heading", "formatBlock", "h3"],
          ["Paragraph", "formatBlock", "p"],
          ["Bullet list", "insertUnorderedList"],
          ["Numbered list", "insertOrderedList"],
          ["Source link", "createLink"],
          ["Undo", "undo"],
          ["Redo", "redo"],
        ].map(([text, command, argument]) => (
          <button
            key={command + text}
            type="button"
            disabled={source}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void format(command, argument)}
          >
            {text}
          </button>
        ))}
      </div>
      <label id={`${name}-editor-label`}>{label}</label>
      {!source ? (
        <div
          key="visual"
          ref={(node) => {
            editor.current = node;
            if (node && !node.dataset.initialized) {
              node.innerHTML = safeHtml(paragraphs(value));
              node.dataset.initialized = "true";
            }
          }}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={`${name}-editor-label`}
          className="visual-rich-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={changed}
          onKeyUp={remember}
          onMouseUp={remember}
          onPaste={(e) => {
            e.preventDefault();
            document.execCommand(
              "insertText",
              false,
              e.clipboardData.getData("text/plain"),
            );
            changed();
          }}
        />
      ) : (
        <textarea
          className="resize-none"
          aria-labelledby={`${name}-editor-label`}
          value={value}
          rows={9}
          maxLength={100000}
          onChange={(e) => {
            setValue(e.target.value);
            onDirty?.();
          }}
        />
      )}
      <input type="hidden" name={name} value={value} />
      <p className="p2-muted">
        Type your description and select text to format it. Existing links and
        formatting are preserved.
      </p>
      <button
        className="p2-back"
        type="button"
        aria-pressed={source}
        onClick={() => setSource(!source)}
      >
        {source ? "Return to visual editor" : "HTML source (advanced)"}
      </button>
    </div>
  );
}
