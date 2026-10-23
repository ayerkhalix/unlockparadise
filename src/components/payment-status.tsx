"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Reload the account and shared header after verified membership activation. */
import { useCallback, useEffect, useState } from "react";
import { requestJSON } from "@/lib/client-api";

type Props = {
  transactionId: string;
  initialStatus: string;
  canCheck: boolean;
  autoCheck: boolean;
};
type Result = { status: string; message: string };

export function PaymentStatus({
  transactionId,
  initialStatus,
  canCheck,
  autoCheck,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(
    autoCheck && canCheck && initialStatus !== "paid",
  );
  const [message, setMessage] = useState("");
  const [seconds, setSeconds] = useState<number | null>(
    autoCheck && initialStatus === "paid" ? 5 : null,
  );
  const applyResult = useCallback((result: Result) => {
    setStatus(result.status);
    setMessage(result.message);
    // Only the authenticated verification endpoint can start this countdown.
    if (result.status === "paid") setSeconds(5);
  }, []);

  useEffect(() => {
    if (!autoCheck || !canCheck || initialStatus === "paid") return;
    const controller = new AbortController();
    requestJSON<Result>(
      "/api/payments/reconcile/",
      "POST",
      { transaction_id: transactionId },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) applyResult(result);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not check payment. Please try again.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [transactionId, autoCheck, canCheck, initialStatus, applyResult]);

  useEffect(() => {
    if (seconds === null) return;
    const timer = window.setTimeout(() => {
      if (seconds <= 1) window.location.assign("/account/");
      else setSeconds(seconds - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  async function checkPayment() {
    setBusy(true);
    setMessage("");
    try {
      applyResult(
        await requestJSON<Result>("/api/payments/reconcile/", "POST", {
          transaction_id: transactionId,
        }),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not check payment. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="p2-payment-status"
      aria-label="Latest test payment"
      aria-busy={busy}
    >
      <h2>Latest test payment</h2>
      <p role="status" aria-live="polite">
        {message ||
          (status === "paid"
            ? "Payment confirmed. See your account for membership status."
            : status === "expired"
              ? "This checkout has closed."
              : status === "failed"
                ? "Checkout could not be created. You can try again."
                : status === "creating"
                  ? "Your checkout is being checked. Please wait before starting another."
                  : "Complete payment on Xendit, then check its status here.")}
      </p>
      {seconds !== null && (
        <p aria-live="off">Returning to your account in {seconds} seconds.</p>
      )}
      {canCheck && ["pending", "creating"].includes(status) && (
        <button
          type="button"
          className="upd-btn upd-btn--primary"
          disabled={busy}
          onClick={checkPayment}
        >
          {busy ? "Checking payment…" : "Check payment status"}
        </button>
      )}
      {status === "paid" && (
        <p>
          <a href="/account/">View membership</a>
        </p>
      )}
      {seconds !== null && (
        <button
          type="button"
          className="upd-btn upd-btn--ghost"
          onClick={() => setSeconds(null)}
        >
          Stay on this page
        </button>
      )}
    </section>
  );
}
