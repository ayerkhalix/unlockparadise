"""Import allowlisted export fields and sanitized public GET markup; never write to WordPress.

The full export is deliberately not copied into the app or public directory.
Only the server repository may read destinations.private.json.
"""
import concurrent.futures
import html
import json
import os
import pathlib
import re
import shutil
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIVE = ROOT / "reference/live"
NS = {"wp": "http://wordpress.org/export/1.2/", "content": "http://purl.org/rss/1.0/modules/content/"}
SITE = "https://unlockparadise.ph"

def php(value):
    """Read PHP serialized scalars/arrays, counting string lengths as UTF-8 bytes."""
    data = value.encode("utf-8"); pos = 0
    def parse():
        nonlocal pos
        t = chr(data[pos]); pos += 2
        if t == "N": return None
        if t == "s":
            end = data.index(b":", pos); size = int(data[pos:end]); pos = end + 2
            val = data[pos:pos+size].decode("utf-8"); pos += size + 2; return val
        if t == "a":
            end = data.index(b":", pos); count = int(data[pos:end]); pos = end + 2; val = {}
            for _ in range(count):
                key = parse(); val[key] = parse()
            pos += 1
            return list(val.values()) if list(val) == list(range(len(val))) else val
        end = data.index(b";", pos); val = data[pos:end].decode(); pos = end + 1
        return int(val) if t == "i" else float(val) if t == "d" else val == "1" if t == "b" else val
    try: return parse()
    except (ValueError, IndexError, UnicodeError): return value

def get(url, path):
    if path.exists(): return path.read_text(encoding="utf-8")
    request = urllib.request.Request(url, headers={"User-Agent": "UnlockParadise-Phase1-ReadOnly/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response: raw = response.read()
    path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(raw)
    return raw.decode("utf-8")

def sanitize(markup):
    markup = re.sub(r"<script\b[^>]*>[\s\S]*?</script>", "", markup, flags=re.I)
    markup = re.sub(r"<\?xml[^>]+\?>", "", markup)
    markup = re.sub(r'\s+on\w+\s*=\s*("[^"]*"|\x27[^\x27]*\x27)', "", markup, flags=re.I)
    markup = re.sub(r'<input\b[^>]*type=["\x27]hidden["\x27][^>]*>', "", markup, flags=re.I)
    markup = re.sub(r'\s+(?:data-submit-token|data-view-token|ajaxurl)="[^"]*"', "", markup)
    markup = re.sub(r'\s+srcset="[^"]*"', "", markup)
    markup = re.sub(r'<form\b([^>]*)>', lambda m: '<form' + re.sub(r'\s+(?:action|method)="[^"]*"', '', m[1]) + ' action="#integration-pending" method="get">', markup)
    if '<form' in markup and 'upd-toolbar' not in markup:
        # Pending forms have no payload, including if browser scripting is disabled.
        markup = re.sub(r'(<(?:input|textarea|select)\b[^>]*?)\s+name="[^"]*"', r'\1', markup)
        note = '<p class="phase1-pending" id="integration-pending" role="status">Account and form services are pending integration. No information is submitted in this preview.</p>'
        markup = re.sub(r'(<button\b[^>]*type="submit")', r'\1 disabled aria-disabled="true" title="Pending integration"', markup)
        markup = markup.replace('</form>', note + '</form>')
    # Replace only internal links. Asset URLs are rewritten in the asset pass.
    markup = markup.replace(SITE + '/?','/?')
    markup = re.sub(r'(href=["\x27])' + re.escape(SITE) + r'/(?!wp-content/)', r'\1/', markup)
    markup = markup.replace('redirect_to=' + SITE, 'redirect_to=')
    return markup

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    LIVE.mkdir(parents=True, exist_ok=True)
    data_dir = ROOT / "src/data"; data_dir.mkdir(parents=True, exist_ok=True)
    xml_path = pathlib.Path(os.environ.get("UPD_WORDPRESS_XML", str(pathlib.Path.home() / "Downloads/unlockparadise.WordPress.2026-10-15(1).xml")))
    acf_path = pathlib.Path(os.environ.get("UPD_ACF_JSON", str(pathlib.Path.home() / "Downloads/acf-export-2026-10-15(1).json")))
    tree = ET.parse(xml_path); items = tree.findall("channel/item")
    def txt(node, tag): return node.findtext(tag, default="", namespaces=NS) or ""
    def meta(node): return {txt(m, "wp:meta_key"): txt(m, "wp:meta_value") for m in node.findall("wp:postmeta", NS)}
    attachments = {}
    for item in items:
        if txt(item, "wp:post_type") != "attachment": continue
        m = meta(item); attachments[txt(item, "wp:post_id")] = {"url": txt(item, "wp:attachment_url"), "metadata": php(m.get("_wp_attachment_metadata", ""))}
    def image_for(attachment_id, size="large"):
        a = attachments.get(str(attachment_id), {}); url = a.get("url", ""); details = a.get("metadata", {})
        if isinstance(details, dict):
            small = details.get("sizes", {}).get(size, {})
            if isinstance(small, dict) and small.get("file"): url = url.rsplit("/",1)[0] + "/" + small["file"]
        return url
    destinations = []
    for item in items:
        if txt(item,"wp:post_type") != "place" or txt(item,"wp:status") != "publish": continue
        m = meta(item); terms = {c.get("domain"): c.get("nicename") for c in item.findall("category")}
        gallery = [image_for(m.get(f"photo_{n}", "")) for n in range(1,9)]; gallery = [u for u in gallery if u]
        lat = m.get("area_location_latitude", ""); lng = m.get("area_location_longitude", "")
        try: coordinates = [float(lng),float(lat)] if lat and lng else None
        except ValueError: coordinates = None
        def values(key):
            v = php(m.get(key,"")); return v if isinstance(v,list) else []
        reviews = []
        for comment in item.findall('wp:comment',NS):
            if txt(comment,'wp:comment_approved')!='1': continue
            review_meta={txt(c,'wp:meta_key'):txt(c,'wp:meta_value') for c in comment.findall('wp:commentmeta',NS)}
            reviews.append({'author':txt(comment,'wp:comment_author'),'body':sanitize(txt(comment,'wp:comment_content')),'date':txt(comment,'wp:comment_date'),'rating':int(review_meta.get('rating') or review_meta.get('upd_rating') or 0)})
        destinations.append({"id": int(txt(item,"wp:post_id")), "slug": txt(item,"wp:post_name"), "title": txt(item,"title"), "area": terms.get("area", ""), "category": terms.get("place_category", ""), "requiredTier": "explorer-plus" if m.get("vip_content", m.get("premium_content", "0"))=="1" else "explorer", "travelTime": int(float(m["travel_time"])) if m.get("travel_time") else None, "accessibility": values("accessible_by"), "assets": values("assets"), "weekdayCrowd": m.get("weekdays_crowd", ""), "weekendCrowd": m.get("weekends_crowd", ""), "introduction": sanitize(m.get("description", "")), "gallery": gallery, "coordinates": coordinates, "date": txt(item,"wp:post_date"), "featured": m.get("upd_featured")=="1", "featureOrder": int(m.get("upd_feature_order") or 0), 'reviews':reviews})
    (data_dir / "destinations.private.json").write_text(json.dumps(destinations, ensure_ascii=False,indent=2),encoding="utf-8")
    acf = json.loads(acf_path.read_text(encoding="utf-8"))
    (ROOT / "reference/acf-schema.json").write_text(json.dumps(acf,ensure_ascii=False,indent=2),encoding="utf-8")
    home = get(SITE+"/", LIVE / "home.html")
    areas = json.loads(re.search(r'var areas = (\[[^;]+\]);',home)[1])
    catmap = json.loads(re.search(r'var catMap = (\{[^;]+\});',home)[1])
    routes = [f"area/{a}/{c}" for a,cats in catmap.items() for c in cats] + [f"area/{a}" for a in catmap]
    routes += ["about","membership","contact","login","join","forgot-password","privacy-policy","terms","refunds","checkout","place/bayog-beach","place/100-cafe-moto"]
    routes += [f"place_category/{c}" for c in catmap['puerto-princesa']]
    routes += ['get-paid','merch','hello-world','category/uncategorized','form','form/simple-contact-form','reset-password']
    def fetch(route):
        try: return route, get(SITE+"/"+route+"/",LIVE / (route.replace("/","-")+".html"))
        except Exception as e: print("UNAVAILABLE",route,str(e)); return route, None
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: pages = dict(pool.map(fetch,routes))
    fragments = {}; bodyclasses = {}
    for route, source in pages.items():
        if source is None: continue
        start = source.find('<main class="upd-main"'); end = source.rfind('</main>') + 7
        if start < 0 or end < 7: continue
        markup = source[start:end]
        # Avoid invalid nested main elements in the original templates.
        markup = re.sub(r'<main(?! class="upd-main")', '<section', markup).replace('</main>', '</section>')
        markup = markup[:markup.rfind('</section>')] + '</main>'
        fragments[route] = sanitize(markup)
        bodyclasses[route] = re.search(r'<body[^>]*class="([^"]*)"',source)[1]
    fragments["hero"] = sanitize(re.search(r'<section class="upd-hero">[\s\S]*?</section>',home)[0])
    fragments["featured"] = sanitize(re.search(r'<section[^>]*class="[^"]*upd-featured[^>]*>[\s\S]*?</section>',home)[0])
    fragments["header"] = sanitize(home[home.find('<header class="upd-header"'):home.find('<main class="upd-main"')])
    fragments["footer"] = sanitize(home[home.find('<footer'):home.find('</footer>')+9])
    # Keep raw public gates as reusable templates; individual destinations are rendered by React.
    asset_urls = set()
    asset_urls.add(SITE+'/wp-content/uploads/2026/07/upd-favicon-teal.png')
    representatives = {'100-cafe-moto','arutayan-falls','aloha-organic-ranch','farm-lot','talaudyong-beach-ii','dondon-claudia-river','ang-nanay-filipino-food','barlas-island','mt-airy-pending-info','bayog-beach'}
    for place in destinations:
        if place['slug'] in representatives:
            # These teaser images are already exposed by the public guest gate.
            # Never copy the remaining member gallery into public/.
            asset_urls.update(place['gallery'][:2])
    for markup in fragments.values():
        asset_urls.update(re.findall(re.escape(SITE)+r'/wp-content/[^\s<>"\x27)]+\.(?:png|jpg|jpeg|webp|svg)',html.unescape(markup)))
    style_urls = set()
    for source in list(pages.values())+[home]:
        if source: style_urls.update(html.unescape(u) for u in re.findall(r'''href=["']([^"']+\.css(?:\?[^"']*)?)["']''',source))
    # Original theme assets and plugin presentation styles remain separate from app logic.
    styles = {}
    for url in sorted(style_urls):
        path = urllib.parse.urlparse(url).path
        if not (path.startswith('/wp-content/') or path.startswith('/wp-includes/css/dashicons')): continue
        try:
            css = get(url,LIVE/path.lstrip('/')); styles[path] = css
            for match in re.findall(r'url\(["\x27]?([^\s)"\x27]+)',css):
                if not match.startswith('data:'):
                    resolved = urllib.parse.urljoin(url,match)
                    if resolved.startswith(SITE): asset_urls.add(resolved.split('?')[0])
        except Exception as e: print('CSS UNAVAILABLE',url,str(e))
    assets = {}; failures = []
    def download(url):
        path = urllib.parse.urlparse(url).path
        target = ROOT/'public/original'/path.lstrip('/')
        try:
            if not target.exists():
                target.parent.mkdir(parents=True,exist_ok=True)
                target.write_bytes(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=45).read())
            return url, '/original'+path
        except Exception as e: return url, None
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for url,local in pool.map(download,sorted(asset_urls)):
            if local: assets[url] = local
            else: failures.append(url)
    def localize(text):
        for url,local in assets.items(): text=text.replace(url,local)
        return text
    for path,css in styles.items():
        # Relative font/image links still resolve because the original directory tree is retained.
        css=localize(css).replace('body.home','body:has(.upd-home)').replace('body:not(.home)','body:not(:has(.upd-home))').replace('body.upd-about-page','body:has(.upd-about)')
        target=ROOT/'public/original'/path.lstrip('/'); target.parent.mkdir(parents=True,exist_ok=True); target.write_text(css,encoding='utf-8')
    for key in fragments: fragments[key]=localize(fragments[key])
    (data_dir/'fragments.json').write_text(json.dumps(fragments,ensure_ascii=False,indent=2),encoding='utf-8')
    categories = []
    overlay = home[home.find('<div class="map-overlay"'):home.find('var areas =')]
    for slug,url,label in re.findall(r'<button class="category-btn" data-cat="([^"]+)"><img[^>]*src="([^"]+)"[^>]*><span class="category-label">([^<]+)</span>',overlay):
        categories.append({'slug':slug,'name':label,'image':assets.get(url,url)})
    (data_dir/'map.json').write_text(json.dumps({'areas':areas,'availability':catmap,'categories':categories},ensure_ascii=False,indent=2),encoding='utf-8')
    # The original filter is a DOM-only progressive enhancement: it never calls WordPress.
    src=LIVE/'wp-content/plugins/unlock-paradise-core/assets/js/area-filter.js'
    dest=ROOT/'public/original/area-filter.js'; shutil.copyfile(src,dest)
    vendor=ROOT/'public/original/vendor'; vendor.mkdir(exist_ok=True)
    for filename in ['swiper-bundle.min.js','swiper-bundle.min.css','glightbox.min.js','glightbox.min.css']:
        if (vendor/filename).exists(): continue
        if filename.startswith('swiper'):
            url='https://cdn.jsdelivr.net/npm/swiper@11/'+filename; cached=LIVE/'npm/swiper@11'/filename
        else:
            url=SITE+'/wp-content/themes/unlock-paradise/assets/glightbox/'+filename; cached=LIVE/'wp-content/themes/unlock-paradise/assets/glightbox'/filename
        get(url,cached); shutil.copyfile(cached,vendor/filename)
    stylesheets = ['/original'+p for p in styles if '/themes/unlock-paradise/assets/css/' in p or '/unlock-paradise-core/assets/css/' in p]
    ordered = ['tokens.css','base.css','membership.css','chrome.css','components.css','palawan-map.css','home.css','single-place.css','reviews.css','area-archive.css','about.css','membership-pages.css','coming-soon.css']
    stylesheets.sort(key=lambda p: ordered.index(p.split('/')[-1]) if p.split('/')[-1] in ordered else 100)
    (data_dir/'assets.json').write_text(json.dumps({'stylesheets':stylesheets,'assets':assets,'bodyClasses':bodyclasses},ensure_ascii=False,indent=2),encoding='utf-8')
    report={'publishedDestinations':len(destinations),'excludedTrashedDestinations':4,'attachments':len(attachments),'privateFieldAllowlist':list(destinations[0]),'publicRoutes':list(fragments),'downloadedAssets':len(assets),'failedAssets':failures,'missingPublicPages':[p for p,s in pages.items() if s is None]}
    (ROOT/'reference/import-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(f"Imported {len(destinations)} server-only destinations, {len(fragments)} public fragments, {len(assets)} original assets, {len(failures)} missing assets.")

if __name__ == '__main__': main()
