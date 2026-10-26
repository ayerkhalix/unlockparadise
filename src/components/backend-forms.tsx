"use client";
import { useEffect } from "react";
import { validateFields } from "@/lib/form-validation";
import { membershipReturnTarget } from "@/lib/membership-navigation";
export function BackendForms() {
  useEffect(() => {
    const submit = async (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.dataset.endpoint) return;
      event.preventDefault();
      if (!validateFields(form)) return;
      const button = form.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      );
      const status = form.querySelector<HTMLElement>('[role="status"]');
      if (button?.disabled) return;
      const originalLabel = button?.textContent;
      if (button) button.disabled = true;
      if (button?.dataset.pendingLabel)
        button.textContent = button.dataset.pendingLabel;
      form.setAttribute("aria-busy", "true");
      if (status) status.textContent = "";
      const data: Record<string, unknown> = Object.fromEntries(
        new FormData(form),
      );
      if (form.dataset.recovery) data.recovery = true;
      if (form.dataset.endpoint.endsWith("/login/"))
        data.redirect_to =
          new URLSearchParams(location.search).get("redirect_to") ||
          "/account/";
      if (form.dataset.endpoint.endsWith("/checkout/"))
        data.idempotency_key = crypto.randomUUID();
      try {
        const response = await fetch(form.dataset.endpoint, {
          method: form.dataset.method || "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Please try again.");
        if (result.redirect_to) {
          location.assign(result.redirect_to);
          return;
        }
        if (result.checkout_url) {
          if (
            form.dataset.endpoint === "/api/payments/checkout/" &&
            typeof result.transaction_id === "string" &&
            /^[a-f0-9-]{36}$/i.test(result.transaction_id)
          ) {
            try {
              sessionStorage.setItem(
                `upd:payment-return:${result.transaction_id}`,
                JSON.stringify({
                  target: membershipReturnTarget(form.dataset.returnTarget),
                  owner: form.dataset.returnOwner,
                  expires: Date.now() + 3600000,
                }),
              );
            } catch {
              /* Payment still returns to the account. */
            }
          }
          location.assign(result.checkout_url);
          return;
        }
        if (status) status.textContent = result.message || "Saved.";
      } catch (error) {
        if (status)
          status.textContent =
            error instanceof Error ? error.message : "Please try again.";
      } finally {
        form.removeAttribute("aria-busy");
        if (button) {
          button.disabled = false;
          if (originalLabel) button.textContent = originalLabel;
        }
      }
    };
    document.addEventListener("submit", submit);
    return () => document.removeEventListener("submit", submit);
  }, []);
  return null;
}
