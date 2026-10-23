/** Static public markup, sanitized at import time. No WordPress scripts execute here. */
export function OriginalMarkup({ html }: { html: string }) {
  return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />;
}
