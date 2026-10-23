import { FilterXSS } from "xss";
const filter = new FilterXSS({
  whiteList: {
    p: [],
    br: [],
    strong: [],
    b: [],
    em: [],
    i: [],
    ul: [],
    ol: [],
    li: [],
    blockquote: [],
    h2: [],
    h3: [],
    h4: [],
    a: ["href", "title", "rel"],
    span: [],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "iframe", "object", "embed"],
});
export function safeHtml(value: string) {
  return filter.process(value);
}
