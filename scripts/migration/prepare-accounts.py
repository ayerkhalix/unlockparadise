"""Private identity and ownership staging. No auth calls, no password fields."""
import argparse,json
from datetime import datetime,timezone
from pathlib import Path
from wordpress import load_sql,index_meta,php
from prepare import uid,ROOT,date
parser=argparse.ArgumentParser();parser.add_argument('--sql',default=str(ROOT/'reference/wordpress/u177262977_fo9WP.sql'))
parser.add_argument('--write',action='store_true');args=parser.parse_args()
tables=load_sql(args.sql);meta=index_meta(tables['wp_usermeta'],'user_id');identities=[];ownership=[];memberships=[]
for user in tables['wp_users']:
    legacy=user['ID'];m=meta.get(legacy,{})
    identities.append({'legacy_id':legacy,'email':user['user_email'],'display_name':user['display_name'][:40] or 'Explorer',
      'terms_accepted_at':datetime.fromtimestamp(int(m['upd_terms_accepted']),timezone.utc).isoformat() if str(m.get('upd_terms_accepted') or '').isdigit() else None})
    entries=php(m.get('upd_bucketlist') or '')
    if isinstance(entries,dict):
        for place,entry in entries.items():
            if isinstance(entry,dict):ownership.append({'legacy_user_id':legacy,'legacy_place_id':int(place),'saved_at':entry.get('saved_at'),'visited_at':entry.get('visited_at')})
    roles=php(m.get('wp_capabilities') or '')
    memberships.append({'legacy_user_id':legacy,'roles':roles,'subscription':{k[8:]:v for k,v in m.items() if k.startswith('upd_sub_')}})
reviews=[];reviewmeta=index_meta(tables['wp_commentmeta'],'comment_id')
for review in tables['wp_comments']:
    if review['comment_type']!='upd_review':continue
    m=reviewmeta.get(review['comment_ID'],{})
    reviews.append({'legacy_id':review['comment_ID'],'legacy_user_id':review['user_id'],'legacy_place_id':review['comment_post_ID'],
      'author_name':review['comment_author'],'rating':int(m.get('upd_rating') or 0),'title':m.get('upd_review_title') or '',
      'body':review['comment_content'],'status':'approved' if str(review['comment_approved'])=='1' else 'pending','created_at':date(review['comment_date_gmt']),
      'likes':php(m.get('upd_review_likes') or '')})
if args.write:
    out=ROOT/'artifacts/backend-private';out.mkdir(parents=True,exist_ok=True)
    for name,records in [('identities',identities),('member-places',ownership),('legacy-memberships',memberships),('reviews',reviews)]:
        (out/(name+'.json')).write_text(json.dumps(records,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'mode':'private-plan-only','identities':len(identities),'member_places':len(ownership),'reviews':len(reviews),'memberships_for_review':len(memberships),'password_hashes_exported':0,'applied':False}))
