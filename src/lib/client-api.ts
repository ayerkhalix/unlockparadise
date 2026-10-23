"use client";
export async function requestJSON<T>(
  url: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method,
    signal,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The service is unavailable. Please try again.");
  }
  if (!response.ok)
    throw new Error(
      data.error +
        (data.fields
          ? " " +
            data.fields.map((f: { message: string }) => f.message).join(" ")
          : ""),
    );
  return data;
}
export function notify(message: string, error = false) {
  window.dispatchEvent(
    new CustomEvent("upd:notice", { detail: { message, error } }),
  );
}
