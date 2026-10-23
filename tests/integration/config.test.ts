import { test } from "node:test";
import assert from "node:assert/strict";
import { backendConfigured } from "../../src/lib/supabase/config";
test("production and explicit Supabase mode cannot silently use fixtures", () => {
  const keys = ["NODE_ENV", "UPD_DATA_MODE", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    for (const key of keys) delete process.env[key];
    process.env.UPD_DATA_MODE = "supabase";
    assert.throws(backendConfigured, /BACKEND_UNCONFIGURED/);
    process.env.UPD_DATA_MODE = "fixtures";
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.throws(backendConfigured, /Production requires/);
    Object.assign(process.env, { NODE_ENV: "development" });
    assert.equal(backendConfigured(), false);
    process.env.UPD_DATA_MODE = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    assert.throws(backendConfigured, /BACKEND_UNCONFIGURED/);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-publishable-value";
    assert.equal(backendConfigured(), true);
  } finally { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } }
});
