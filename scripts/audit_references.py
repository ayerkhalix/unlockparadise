"""Read the recorder without modifying it; save a compact, reproducible audit here."""
import collections
import hashlib
import json
import os
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
RECORDER = pathlib.Path(os.environ.get("UPD_RECORDER", str(pathlib.Path.home() / "Desktop/unlock paradise automation/website-recorder")))

def run():
    reports = RECORDER / "reports"
    parsed = {p.relative_to(reports).as_posix(): json.loads(p.read_text(encoding="utf-8")) for p in reports.rglob("*.json")}
    markdown = {p.name: p.read_text(encoding="utf-8") for p in reports.rglob("*.md")}
    manifest = parsed["screenshot-manifest.json"]["data"]
    routes = parsed["route-inventory.json"]["data"]
    motion = parsed["motion/motion-audit.json"]
    selected = [x for x in manifest if x["kind"] in ("reference", "baseline", "animation-initial")]
    result = {
        "recorder": str(RECORDER),
        "sourceReports": list(parsed) + list(markdown),
        "sourceHashes": {str(p.relative_to(reports)): hashlib.sha256(p.read_bytes()).hexdigest() for p in reports.rglob("*") if p.is_file() and p.suffix in (".md", ".json")},
        "routes": len(routes),
        "screenshots": len(manifest),
        "missingFiles": [x["file"] for x in manifest if not (RECORDER / x["file"]).is_file()],
        "viewports": list({x["viewport"]["id"]: x["viewport"] for x in manifest}.values()),
        "profiles": parsed["route-inventory.json"]["profiles"],
        "motionStatus": dict(collections.Counter(x["status"] for x in motion["clips"])),
        "motionDiagnostics": motion["diagnostics"],
        "recordedRoutes": [{"profile": x["profile"], "url": x["url"], "status": x["status"]} for x in parsed["page-metadata.json"]["data"]],
        "references": selected,
    }
    (ROOT / "reference").mkdir(exist_ok=True)
    (ROOT / "reference/recorder-audit.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    # Preserve the complete route/interaction inventories in a private audit file,
    # without copying sessions, cookies, account details or destination bodies.
    (ROOT / "reference/route-inventory.json").write_text(json.dumps(routes, indent=2), encoding="utf-8")
    text = "# Reference audit\n\n"
    text += f"Recorder (read-only): `{RECORDER}`. All {len(parsed)} JSON reports and {len(markdown)} Markdown reports were parsed.\n\n"
    text += f"{len(routes)} discovered routes; 15 visually inspected routes across three profiles; {len(manifest)} screenshots; 270 full-page reference images. The source census read 383 published destinations, with 32 structural configurations and ten representative destination captures.\n\n"
    text += "Homepage has 1440×900 desktop and 390×844 mobile references. Destination representatives additionally have 1920×1080, 1366×768, 1024×768, 768×1024, 430×932 and 375×812 references. There is no original tablet homepage reference; supplemental live read-only captures must be labelled separately.\n\n"
    text += "## Recording gaps\n\n"
    text += "All three main runs are partial/page-capped. Area/category feeds, legal pages, join/forgot-password, account, bucketlist and most individual destinations lack recorder visual inspections. No full-site visual coverage is claimed. Public destination gates and Explorer's Bayog Beach upgrade gate are observed access variants.\n\n"
    text += f"Missing screenshot files: {len(result['missingFiles'])}. Motion clip status: {result['motionStatus']}. The animation report records 1,843 frames, 30 keyframes and 423 state/transition rules. The regular interaction audit has 63 recorded, 209 skipped, zero failed interactions.\n\n"
    text += "Production writes, purchases, review submission/deletion/likes and clipboard operations were intentionally not recorded. Some mobile hovers were offscreen/intercepted. Mapbox telemetry POSTs were blocked by the recorder. The map's layers occasionally logged an undefined target error.\n\n"
    text += "The access matrix misclassifies some Explorer upgrade gates as visible: Arutayan Falls and Talaudyong II have an inspected status and upgradePrompt:false, but their recorded headings contain ‘Unlock more of paradise’. Inspect the actual screenshots and exported tier flags; do not treat this classifier as authorization.\n\n"
    text += "## Source design\n\n"
    text += "Self-hosted Outfit 400/500/600 headings; Open Sans 400/500 body; Quicksand 500 header wordmark. Navy #11202a, chrome #0b1620, mint #7bc4a8, teal #86d8c8/#1f9e8a, sand #e9e2d4 and premium gold #d4a344. Keep the exact original CSS, font binaries, photos and SVG paths.\n\n"
    text += "Header is fixed, with its glass state after 80px scroll. Hero is 78vh desktop / 88svh phone; the satellite map is 90lvh with a −30px overlap. Native Mapbox GL 3.4.0, satellite-v9, bounds [[117.75,8.35],[119.55,11.30]], four exact published area coordinates; 1,500ms selection flight, overlay after 800ms; 1,200ms return after 200ms. Mobile category sheet has six tiles per page and dismisses after a 90px downward swipe.\n\n"
    text += "## Capture-state caveat\n\n"
    text += "The initial homepage frame has a hidden category overlay and a header at the top. The full-page lazy-scroll reference contains a partially restored smooth-scroll position, a glass header inside the hero, and visible inactive overlay tiles. Those are distinct capture states. Compare the initial frame for the opening hero and the full-page image for lower sections; retain unmasked full-image diffs and report the discrepancy. Do not add a broken overlay to the normal application merely to reduce a pixel score.\n"
    (ROOT / "reference/AUDIT.md").write_text(text, encoding="utf-8")
    print(f"Read {len(parsed)} JSON reports and {len(markdown)} Markdown reports. Saved reference/AUDIT.md and manifests.")

if __name__ == "__main__":
    run()
