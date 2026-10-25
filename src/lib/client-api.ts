"use client";
export class RequestFailure extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
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
  }).catch((error) => {
    if (signal?.aborted) throw error;
    throw new RequestFailure(
      "Could not connect. Check your connection and try again.",
      0,
    );
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The service is unavailable. Please try again.");
  }
  if (!response.ok)
    throw new RequestFailure(
      data.error +
        (data.fields
          ? " " +
            data.fields.map((f: { message: string }) => f.message).join(" ")
          : ""),
      response.status,
    );
  return data;
}
export type NoticeAction = { label: string; run: () => void | Promise<void> };
export function notify(message: string, error = false, action?: NoticeAction) {
  window.dispatchEvent(
    new CustomEvent("upd:notice", { detail: { message, error, action } }),
  );
}
export function notifyUndo(message: string, run: NoticeAction["run"]) {
  notify(message, false, { label: "Undo", run });
}
