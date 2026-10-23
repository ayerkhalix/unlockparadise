"use client";
import { ValidatedForm } from "./ui/validated-form";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export function MfaForm() {
  const [factor, setFactor] = useState(""),
    [qr, setQr] = useState(""),
    [message, setMessage] = useState(""),
    [code, setCode] = useState("");
  const router = useRouter();
  async function call(body: unknown) {
    const r = await fetch("/api/auth/mfa/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error);
    return result;
  }
  useEffect(() => {
    let disposed = false;
    void call({ op: "list" })
      .then((data) => {
        if (!disposed)
          setFactor(
            data.factors.find(
              (f: { status: string }) => f.status === "verified",
            )?.id || "",
          );
      })
      .catch((e) => {
        if (!disposed) setMessage(e.message);
      });
    return () => {
      disposed = true;
    };
  }, []);
  return (
    <ValidatedForm
      data-backend="true"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await call({ op: "verify", factor_id: factor, code });
          router.push("/admin/");
          router.refresh();
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Please try again.",
          );
        }
      }}
    >
      {!factor && (
        <button
          type="button"
          onClick={async () => {
            try {
              const data = await call({ op: "enroll" });
              setFactor(data.id);
              setQr(data.qr_code);
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Please try again.");
            }
          }}
        >
          Set up authenticator
        </button>
      )}
      {qr && (
        <img
          className="admin-qr"
          src={qr}
          alt="Scan with your authenticator app"
        />
      )}
      {factor && (
        <>
          <label>
            Six digit code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          <button type="submit">Verify</button>
        </>
      )}
      <p role="status">{message}</p>
    </ValidatedForm>
  );
}
