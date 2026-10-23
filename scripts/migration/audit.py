"""Emit only sanitized source inventory; no user rows or credential values."""
import argparse
import collections
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from wordpress import load_sql, index_meta

ROOT = Path(__file__).resolve().parents[2]
NS = {'wp': 'http://wordpress.org/export/1.2/'}

def audit(sql_path, xml_path):
    tables = load_sql(sql_path)
    posts = tables['wp_posts']; meta = index_meta(tables['wp_postmeta'], 'post_id')
    places = [p for p in posts if p['post_type'] == 'place' and p['post_status'] == 'publish']
    xml_items = ET.parse(xml_path).findall('channel/item')
    xml_places = {int(p.findtext('wp:post_id', namespaces=NS)) for p in xml_items
                  if p.findtext('wp:post_type', namespaces=NS) == 'place'
                  and p.findtext('wp:status', namespaces=NS) == 'publish'}
    extra = [p for p in places if p['ID'] not in xml_places]
    return {
        'tables': {name:len(rows) for name,rows in tables.items()},
        'published_places_sql':len(places), 'published_places_xml':len(xml_places),
        'attachments':sum(p['post_type']=='attachment' for p in posts),
        'taxonomies':dict(collections.Counter(t['taxonomy'] for t in tables['wp_term_taxonomy'])),
        'review_types':dict(collections.Counter(c['comment_type'] for c in tables['wp_comments'])),
        'sql_only_places':[{'legacy_id':p['ID'],'title':p['post_title'],'slug':p['post_name'],
                           'created':p['post_date'],'metadata_keys':sorted(meta.get(p['ID'],{}))} for p in extra],
        'xml_missing_in_sql':sorted(xml_places-{p['ID'] for p in places}),
        'place_metadata_keys':dict(collections.Counter(k for p in places for k in meta.get(p['ID'],{}))),
        'membership_metadata_keys':dict(collections.Counter(r['meta_key'] for r in tables['wp_usermeta']
                                      if r['meta_key'].startswith('upd_'))),
        'premium_flags':dict(collections.Counter(str((meta.get(p['ID'],{}).get('vip_content'),
                              meta.get(p['ID'],{}).get('premium_content'))) for p in places)),
    }

if __name__ == '__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--sql',default=str(ROOT/'reference/wordpress/u177262977_fo9WP.sql'))
    parser.add_argument('--xml',default=str(Path.home()/'Downloads/unlockparadise.WordPress.2026-10-15(1).xml'))
    parser.add_argument('--report',default=str(ROOT/'artifacts/backend-audit.json')); args=parser.parse_args()
    result=audit(args.sql,args.xml); target=Path(args.report); target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,indent=2),encoding='utf-8'); print(json.dumps(result,indent=2))
