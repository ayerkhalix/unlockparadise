import { test } from "node:test";
import assert from "node:assert/strict";
import {
  membershipReturnTarget,
  upgradeHref,
} from "../../src/lib/membership-navigation";
import { membershipMarkup } from "../../src/lib/auth/markup";

test("upgrade navigation follows actual tiers and allows only safe browsing returns", () => {
  const target = "/itineraries/?trip=example&view=schedule";
  assert.equal(
    upgradeHref("explorer", target),
    `/checkout/?return_to=${encodeURIComponent(target)}`,
  );
  assert.equal(
    upgradeHref("public", target),
    `/membership/?return_to=${encodeURIComponent(target)}`,
  );
  assert.equal(upgradeHref("explorer-plus", target), "/membership/");
  assert.equal(
    membershipReturnTarget("/place/example-place/"),
    "/place/example-place/",
  );
  for (const unsafe of [
    "https://evil.test/",
    "//evil.test/",
    "/\\evil.test",
    "javascript:alert(1)",
    "/login/",
    "/checkout/",
    "/admin/",
    "/place/../login/",
    "/place/a%2fb/",
  ])
    assert.equal(membershipReturnTarget(unsafe), "/account/");
  const markup = membershipMarkup(
    '<a href="/join/?redirect_to=/checkout/">Get Explorer+</a>',
    "explorer",
    target,
  );
  assert.ok(
    markup.includes(`/checkout/?return_to=${encodeURIComponent(target)}`),
  );
  assert.ok(!markup.includes("/membership/"));
});
