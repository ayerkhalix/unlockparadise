import "server-only";
export function membershipMarkup(html: string, signedIn: boolean) {
  html = html
    .replace(/<span class="upd-plans__note">Save[^<]*<\/span>/g, "")
    .replace(/, save \d+%/g, "")
    .replace(
      /<p[^>]*>\s*Or <a href="\/join\/">create a free Explorer account<\/a>[\s\S]*?<\/p>/g,
      "",
    );
  let column = 0;
  html = html.replace(
    /(<ul class="upd-plans__features">)([\s\S]*?)(<\/ul>)/g,
    (_match, open, content, close) => {
      const premium = column++ === 2;
      const features = [
        "Day-by-day itinerary planner",
        "Visit times, durations and notes",
        "Your route on the map",
        "Download and print your itinerary",
      ];
      return (
        open +
        content +
        features
          .map(
            (label) =>
              `<li class="upd-plans__feature ${premium ? "is-on" : "is-off"}"><span aria-hidden="true">${premium ? "✓" : "×"}</span> ${label}</li>`,
          )
          .join("") +
        close
      );
    },
  );
  const checkout = html.replaceAll(
    'href="/join/?redirect_to=/checkout/"',
    'href="/checkout/"',
  );
  if (!signedIn) return checkout;
  return checkout
    .replaceAll('href="/join/?redirect_to=/membership/"', 'href="/account/"')
    .replaceAll('href="/join/"', 'href="/account/"')
    .replace(">Join free</a>", ">My account</a>")
    .replace(
      ">create a free Explorer account</a>",
      ">view your Explorer account</a>",
    );
}
export function authMarkup(html: string, key: string) {
  const route =
    key === "join"
      ? "join"
      : key === "forgot-password"
        ? "forgot-password"
        : "login";
  return html
    .replace(
      /<form\b([^>]*)>/g,
      (_, attrs: string) =>
        `<form novalidate${attrs.replace(/\s+(?:action|method)="[^"]*"/g, "")} action="/api/auth/${route}/" method="post" data-endpoint="/api/auth/${route}/">`,
    )
    .replace(
      /<input\b([^>]*type="(email|password|checkbox)"[^>]*)>/g,
      (_, attrs: string, type: string) =>
        `<input${attrs} name="${type === "checkbox" ? "terms" : type}">`,
    )
    .replace(/ disabled aria-disabled="true" title="Pending integration"/g, "")
    .replace(
      /<p class="phase1-pending"[\s\S]*?<\/p>/g,
      '<p class="upd-auth-message" role="status" aria-live="polite"></p>',
    );
}
export function contactMarkup(html: string) {
  return html
    .replace(
      /<select\b([^>]*)>/g,
      (_, attrs: string) =>
        `<select${attrs.replace(/\s+aria-hidden="true"/g, "")} name="topic" aria-label="What's this about?">`,
    )
    .replace(
      /<form\b([^>]*)>/g,
      (_, attrs: string) =>
        `<form novalidate${attrs.replace(/\s+(?:action|method)="[^"]*"/g, "")} action="/api/v1/contact/" method="post" data-endpoint="/api/v1/contact/">`,
    )
    .replace(/(<input\b[^>]*type="text")/g, '$1 name="name" required')
    .replace(/(<input\b[^>]*type="email")/g, '$1 name="email" required')
    .replace(
      /<textarea\b/g,
      '<textarea name="message" required maxlength="10000"',
    )
    .replace(/ disabled aria-disabled="true" title="Pending integration"/g, "")
    .replace(
      /<p class="phase1-pending"[\s\S]*?<\/p>/g,
      '<p class="upd-auth-message" role="status" aria-live="polite"></p>',
    );
}
