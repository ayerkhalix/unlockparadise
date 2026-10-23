import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readConsentChoice,
  saveConsentChoice,
} from "../../src/lib/privacy-consent";
import { captureInterest } from "../../src/lib/analytics-client";

test("analytics needs explicit consent, honors browser privacy signals and fails off on failed revocation", () => {
  const names = [
    "window",
    "localStorage",
    "sessionStorage",
    "navigator",
    "location",
    "fetch",
  ] as const;
  const originals = new Map(
    names.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  const data = new Map<string, string>();
  const navigator = {
    webdriver: false,
    doNotTrack: "0",
    globalPrivacyControl: false,
  };
  let calls = 0,
    writesBlocked = false;
  const values = {
    window: {},
    navigator,
    location: { pathname: "/merch/" },
    localStorage: {
      getItem: (key: string) => data.get(key) || null,
      setItem: (key: string, value: string) => {
        if (writesBlocked) throw new Error("blocked");
        data.set(key, value);
      },
    },
    sessionStorage: {
      getItem: () => "synthetic-session",
      setItem: () => {},
      removeItem: () => {},
    },
    fetch: () => {
      calls++;
      return Promise.resolve(new Response("{}"));
    },
  };
  for (const name of names)
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: values[name],
    });
  try {
    assert.equal(readConsentChoice(), "unanswered");
    captureInterest("product_viewed", { product_id: 1 });
    assert.equal(calls, 0);
    assert.equal(saveConsentChoice(true), true);
    navigator.globalPrivacyControl = true;
    captureInterest("product_viewed", { product_id: 1 });
    navigator.globalPrivacyControl = false;
    navigator.doNotTrack = "1";
    captureInterest("product_viewed", { product_id: 1 });
    assert.equal(calls, 0);
    navigator.doNotTrack = "0";
    captureInterest("product_viewed", { product_id: 1 });
    assert.equal(calls, 1);
    writesBlocked = true;
    assert.equal(saveConsentChoice(false), false);
    assert.equal(data.get("upd-analytics-consent"), "allowed");
    assert.equal(readConsentChoice(), "off");
    captureInterest("product_viewed", { product_id: 1 });
    assert.equal(calls, 1);
  } finally {
    for (const name of names) {
      const descriptor = originals.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
