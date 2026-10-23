/** Reproduce the paragraph formatting WordPress applies to ACF WYSIWYG values. */
export function paragraphs(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized.includes("<"))
    return normalized
      .split(/\n\s*\n/)
      .map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`)
      .join("\n");
  return normalized.replace(
    /(^|<div\b[^>]*>)\s*((?:(?!<(?:p|div|ul|ol|h[1-6]|blockquote|figure)\b)[\s\S])+?)(?=\s*(?:<(?:ul|ol|div|p|h[1-6]|blockquote|figure)\b|<\/div>|$))/g,
    (_, before, inline) => `${before}<p>${inline.trim()}</p>`,
  );
}
