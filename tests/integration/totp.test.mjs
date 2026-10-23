import { test } from "node:test";
import assert from "node:assert/strict";
import { totp } from "../staging/totp.mjs";
test("synthetic MFA code generation matches the RFC 6238 SHA-1 test vector", () => {
  assert.equal(totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59000), "287082");
});
