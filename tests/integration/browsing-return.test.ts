import { test } from "node:test";
import assert from "node:assert/strict";
import { safeBrowseReturn } from "../../src/lib/browsing-return";

test("destination returns accept local browse state and reject external/auth paths", () => {
  for (const path of [
    "/",
    "/?map_area=ppc-north#palawan-map",
    "/area/puerto-princesa/rivers/?sort=name&access=Car",
    "/itineraries/explore/?trip=example&category=Local%20Visits&shown=48",
    "/account/#account-settings",
    "/portfolio/",
  ])
    assert.equal(safeBrowseReturn(path), path);
  for (const path of [
    null,
    "",
    "https://evil.test/",
    "//evil.test/",
    "/\\evil.test/",
    "javascript:alert(1)",
    "/login/?redirect_to=//evil.test",
    "/checkout/",
    "/admin/",
    "/place/private-name/",
    "/area/../../auth/",
    "/area/%2e%2e/login/",
    "/area/\nfoo/",
  ])
    assert.equal(safeBrowseReturn(path), null);
});
