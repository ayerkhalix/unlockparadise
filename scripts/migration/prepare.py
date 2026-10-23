"""Offline, deterministic content/media migration. Defaults to dry-run.

Sensitive manifests and generated SQL live in the ignored backend-private
directory. Source files are never written. No customer accounts are imported.
"""
import argparse
import collections
import hashlib
import json
import mimetypes
from pathlib import Path, PurePosixPath
import re
import uuid
import xml.etree.ElementTree as ET
from wordpress import load_sql, index_meta, php

ROOT=Path(__file__).resolve().parents[2]
NAMESPACE=uuid.UUID('fed52c81-d542-4976-a21b-2cf6bfdc9bce')
NS={'wp':'http://wordpress.org/export/1.2/'}
def uid(kind,legacy): return str(uuid.uuid5(NAMESPACE,f'{kind}:{legacy}'))
def sequence(v):
    v=php(v or '')
    return v if isinstance(v,list) else []
def date(v):
    return v.replace(' ','T')+'Z' if v and not v.startswith('0000-') else None
def flag(v): return str(v or '')=='1'
def num(v): return float(v) if v not in (None,'') else None
def literal(v):
    if v is None:return 'NULL'
    if isinstance(v,bool):return 'true' if v else 'false'
    if isinstance(v,(int,float)):return str(v)
    if isinstance(v,(dict,list)):return "'"+json.dumps(v,ensure_ascii=False).replace("'","''")+"'::jsonb"
    return "'"+str(v).replace("'","''")+"'"
ARRAY_FIELDS={'listing_types','accessibility','assets'}
def sql_row(table,row,conflict):
    columns=','.join('"'+k+'"' for k in row)
    values=','.join(('ARRAY['+','.join(literal(x) for x in v)+']::text[]') if k in ARRAY_FIELDS else literal(v) for k,v in row.items())
    update=','.join(('"status"=case when public.'+table+'.checksum=excluded.checksum then public.'+table+'.status else excluded.status end') if k=='status' and table in ('media','media_files') else '"'+k+'"=excluded."'+k+'"' for k in row if k not in conflict.split(','))
    return f'insert into public.{table} ({columns}) values ({values}) on conflict ({conflict}) do '+('update set '+update if update else 'nothing')+';'

def prepare(sql_path,xml_path,uploads):
    tables=load_sql(sql_path); posts=tables['wp_posts']; postmeta=index_meta(tables['wp_postmeta'],'post_id')
    termmeta=index_meta(tables['wp_termmeta'],'term_id'); terms={t['term_id']:t for t in tables['wp_terms']}
    xml_ids={int(p.findtext('wp:post_id',namespaces=NS)) for p in ET.parse(xml_path).findall('channel/item')
       if p.findtext('wp:post_type',namespaces=NS)=='place' and p.findtext('wp:status',namespaces=NS)=='publish'}
    published=[p for p in posts if p['post_type']=='place' and p['post_status']=='publish']
    extra={p['ID'] for p in published}-xml_ids
    if len(xml_ids)!=383 or extra!={5693} or not xml_ids.issubset({p['ID'] for p in published}):
        raise ValueError('Baseline changed; stop and reconcile XML/SQL before importing')
    test=next(p for p in published if p['ID']==5693)
    if test['post_name']!='title' or test['post_title']!='title': raise ValueError('Exclusion evidence changed')
    places=[p for p in published if p['ID'] in xml_ids]
    rows=collections.defaultdict(list); taxonomy_map={}; public_media=set(); links=[]; missing=[]; unsupported=[]; invalid_coordinates=[]
    for taxonomy in tables['wp_term_taxonomy']:
        kind=taxonomy['taxonomy']
        if kind not in ('area','place_category'):continue
        term=terms[taxonomy['term_id']]; table='areas' if kind=='area' else 'categories'; term_id=term['term_id']
        meta=termmeta.get(term_id,{})
        # All term metadata are content fields; ACF underscore pointers are infrastructure.
        fields={k:php(v) for k,v in meta.items() if not k.startswith('_')}
        cat_order=['beaches','islands','rivers','waterfalls','mountain-hikes','others','restaurants','coffee']
        record={'id':uid(table,term_id),'legacy_id':term_id,'slug':term['slug'],'name':term['name'],
                'description':taxonomy['description'] or '', 'metadata':fields,'display_order':cat_order.index(term['slug']) if term['slug'] in cat_order else 0}
        if table=='areas':
            record.update(visible=not flag(meta.get('area_hide_pin')),latitude=num(meta.get('area_location_latitude')),longitude=num(meta.get('area_location_longitude')))
        rows[table].append(record); taxonomy_map[taxonomy['term_taxonomy_id']]=(table,term_id)
        for key,value in fields.items():
            if any(s in key for s in ('image','photo','thumb','hero')) and str(value).isdigit():
                media_id=int(value);public_media.add(media_id)
                rows['taxonomy_media'].append({'media_id':uid('media',media_id),'area_id':record['id'] if table=='areas' else None,'category_id':record['id'] if table=='categories' else None})
    mapped={'travel_time','accessible_by','assets','listing_type','vip_content','premium_content','description','weekdays_crowd','weekends_crowd','area_location_latitude','area_location_longitude','area','category','upd_featured','upd_feature_order','_thumbnail_id'}|{f'photo_{n}' for n in range(1,9)}
    skipped_keys=collections.Counter()
    for p in places:
        legacy=p['ID'];m=postmeta.get(legacy,{});pid=uid('places',legacy)
        listing=sequence(m.get('listing_type')) or ['destination']
        if not set(listing)<={'destination','lot'}:raise ValueError(f'Unknown listing type on source ID {legacy}')
        rows['places'].append({'id':pid,'legacy_id':legacy,'slug':p['post_name'],'title':p['post_title'],
          'status':'publish','vip_content':flag(m.get('vip_content')),'premium_content':flag(m.get('premium_content')),
          'listing_types':listing,'travel_minutes':num(m.get('travel_time')),'accessibility':sequence(m.get('accessible_by')),
          'assets':sequence(m.get('assets')),'featured':flag(m.get('upd_featured')),'feature_order':int(m.get('upd_feature_order') or 0),
          'published_at':date(p['post_date_gmt']),'created_at':date(p['post_date_gmt']),'updated_at':date(p['post_modified_gmt'])})
        lat=num(m.get('area_location_latitude'));lng=num(m.get('area_location_longitude'))
        coordinate_source={}
        if (lat is None)!=(lng is None) or (lat is not None and not(-90<=lat<=90 and -180<=lng<=180)):
            invalid_coordinates.append({'legacy_id':legacy,'reason':'incomplete_or_out_of_range; raw values retained in legacy_fields'})
            coordinate_source={'area_location_latitude':m.get('area_location_latitude'),'area_location_longitude':m.get('area_location_longitude')}
            lat=None;lng=None
        remaining=dict(coordinate_source)
        for key,value in m.items():
            if key in mapped:continue
            if key.startswith(('_edit_','_oembed','surerank_seo_checks')) or key.startswith('_') and key[1:] in m:
                skipped_keys[key]+=1;continue
            remaining[key]=php(value)
        rows['place_details'].append({'place_id':pid,'content':p['post_content'] or '', 'description':m.get('description') or '',
          'excerpt':p['post_excerpt'] or '', 'latitude':lat,'longitude':lng,'weekday_crowd':m.get('weekdays_crowd') or '',
          'weekend_crowd':m.get('weekends_crowd') or '', 'seo':{k:v for k,v in remaining.items() if 'seo' in k or 'surerank' in k},'legacy_fields':remaining})
        photos=[int(m[f'photo_{n}']) for n in range(1,9) if str(m.get(f'photo_{n}') or '').isdigit() and int(m[f'photo_{n}'])>0]
        cover=int(m.get('_thumbnail_id') or (photos[0] if photos else 0))
        if cover:
            public_media.add(cover); links.append({'place_id':pid,'media_id':uid('media',cover),'kind':'cover','position':0})
        # WordPress gate deliberately shows photo_1 as its second public teaser.
        if photos:public_media.add(photos[0])
        for position,photo in enumerate(photos):links.append({'place_id':pid,'media_id':uid('media',photo),'kind':'gallery','position':position})
    ids={p['ID'] for p in places}
    existing_slugs={p['post_name'] for p in places};seen_aliases=set()
    for old in tables['wp_postmeta']:
        if old['post_id'] in ids and old['meta_key']=='_wp_old_slug' and old['meta_value'] and old['meta_value'] not in existing_slugs:
            if old['meta_value'] in seen_aliases:raise ValueError('Duplicate legacy slug requires review')
            seen_aliases.add(old['meta_value']);rows['place_redirects'].append({'slug':old['meta_value'],'place_id':uid('places',old['post_id'])})
    settings=[p for p in posts if p['post_type']=='upd_place_settings']
    settings_id=next((int(o['option_value']) for o in tables['wp_options'] if o['option_name']=='upd_place_settings_post_id' and str(o['option_value']).isdigit()),None)
    if settings_id:settings=[p for p in settings if p['ID']==settings_id]
    if len(settings)>1:raise ValueError('Multiple settings records without a verified active option require reconciliation')
    if settings:
        fields={k:php(v) for k,v in postmeta.get(settings[0]['ID'],{}).items() if k.startswith('place_')}
        rows['app_settings'].append({'key':'place_display','value':fields})
        rows['app_settings'].append({'key':'asset_descriptions','value':{k:v for k,v in fields.items() if k.startswith(('place_asset_desc_','place_access_desc_'))}})
    for relation in tables['wp_term_relationships']:
        if relation['object_id'] not in ids or relation['term_taxonomy_id'] not in taxonomy_map:continue
        table,term_id=taxonomy_map[relation['term_taxonomy_id']]; column='area_id' if table=='areas' else 'category_id'
        rows['place_'+table].append({'place_id':uid('places',relation['object_id']),column:uid(table,term_id)})
    root=Path(uploads).resolve(); media_ids=set(); checksum_counts=collections.Counter(); mime_corrections=0
    allowed={'image/jpeg','image/png','image/webp','image/avif','image/gif','image/svg+xml'}
    public_fragments=(ROOT/'src/data/fragments.json').read_text(encoding='utf-8')+(ROOT/'src/app/layout.tsx').read_text(encoding='utf-8')
    for attachment in (p for p in posts if p['post_type']=='attachment'):
        legacy=attachment['ID']; m=postmeta.get(legacy,{}); source=m.get('_wp_attached_file')
        metadata=php(m.get('_wp_attachment_metadata') or '')
        declared_mime=attachment['post_mime_type']
        mime=mimetypes.guess_type(source or '')[0] or declared_mime or 'application/octet-stream'
        if not source or PurePosixPath(source).is_absolute() or '..' in PurePosixPath(source).parts or '\\' in source:
            missing.append({'legacy_id':legacy,'reason':'missing_or_unsafe_attachment_path'});continue
        path=(root/source).resolve()
        if not path.is_relative_to(root):raise ValueError('Source path escapes uploads')
        exists=path.is_file(); digest=hashlib.sha256(path.read_bytes()).hexdigest() if exists else None
        if mime!=declared_mime:mime_corrections+=1
        if not exists:missing.append({'legacy_id':legacy,'reason':'source_file_missing'})
        if mime not in allowed:unsupported.append({'legacy_id':legacy,'mime_type':mime})
        checksum_counts[digest]+=1 if digest else 0
        exposed_paths=[source]
        if isinstance(metadata,dict):exposed_paths.extend(str(PurePosixPath(source).parent/v['file']) for v in (metadata.get('sizes') or {}).values() if isinstance(v,dict) and v.get('file'))
        if any('/original/wp-content/uploads/'+p in public_fragments for p in exposed_paths):public_media.add(legacy)
        bucket='destination-public' if legacy in public_media else 'destination-private'
        ext=PurePosixPath(source).suffix.lower()
        object_path=f'wordpress/{legacy}/{digest or "missing"}{ext}'
        rows['media'].append({'id':uid('media',legacy),'legacy_id':legacy,'bucket':bucket,'object_path':object_path,'original_path':source,
          'mime_type':mime,'byte_size':path.stat().st_size if exists else 0,'checksum':digest,
          'width':metadata.get('width') if isinstance(metadata,dict) else None,'height':metadata.get('height') if isinstance(metadata,dict) else None,
          'alt':m.get('_wp_attachment_image_alt') or '', 'status':'legacy' if exists and mime in allowed else 'missing',
          'metadata':{'wordpress':metadata,'title':attachment['post_title'],'wordpress_declared_mime':declared_mime}})
        media_ids.add(uid('media',legacy))
        variants=[]
        if isinstance(metadata,dict):
            for size,details in (metadata.get('sizes') or {}).items():
                if isinstance(details,dict) and details.get('file'):
                    variants.append((size,str(PurePosixPath(source).parent/details['file']),bucket,details.get('mime-type')))
            if metadata.get('original_image'):
                variants.append(('original',str(PurePosixPath(source).parent/metadata['original_image']),'media-archive',None))
        for variant,relative,target_bucket,variant_mime in variants:
            variant_path=(root/relative).resolve()
            if not variant_path.is_relative_to(root):raise ValueError('Variant path escapes uploads')
            found=variant_path.is_file()
            if not found:missing.append({'legacy_id':legacy,'variant':variant,'reason':'variant_file_missing'})
            rows['media_files'].append({'id':uid('media_files',str(legacy)+':'+variant),'media_id':uid('media',legacy),'variant':variant,
                'bucket':target_bucket,'object_path':f'wordpress/{legacy}/{variant}/'+PurePosixPath(relative).name,'original_path':relative,
                'mime_type':variant_mime or mimetypes.guess_type(relative)[0] or 'application/octet-stream',
                'byte_size':variant_path.stat().st_size if found else 0,'checksum':hashlib.sha256(variant_path.read_bytes()).hexdigest() if found else None,'status':'pending' if found else 'missing'})
    for link in links:
        if link['media_id'] not in media_ids:raise ValueError('Referenced attachment has no migration row')
    rows['place_media']=links
    for link in rows['taxonomy_media']:
        if link['media_id'] not in media_ids:raise ValueError('Taxonomy references missing attachment')
    # Reviews and identities require explicit approval; stage their source IDs only.
    review_ids=[r['comment_ID'] for r in tables['wp_comments'] if r['comment_type']=='upd_review']
    source_hash=hashlib.sha256(Path(sql_path).read_bytes()).hexdigest()
    report={'mode':'dry-run','source_sha256':source_hash,'source_counts':{'tables':len(tables),'users':len(tables['wp_users']),'attachments':3431,'reviews':len(review_ids)},
      'prepared_counts':{table:len(items) for table,items in rows.items()},
      'excluded_places':[{'legacy_id':5693,'reason':'Only SQL published Place absent from complete 383-place XML; placeholder title/slug title; developer confirmed one test record.'}],
      'missing_files':missing,'unsupported_media':unsupported,'invalid_coordinates':invalid_coordinates,'corrected_mime_declarations':mime_corrections,'duplicate_content_groups':sum(n>1 for n in checksum_counts.values()),
      'infrastructure_metadata_excluded':dict(skipped_keys),'deferred':['21 identities and account-owned data require approved mapping','7 reviews retain source identity dependencies; not published before account approval'],
      'imported':False,'storage_objects_verified':0}
    return dict(rows),report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--sql',default=str(ROOT/'reference/wordpress/u177262977_fo9WP.sql'))
    parser.add_argument('--xml',default=str(Path.home()/'Downloads/unlockparadise.WordPress.2026-10-15(1).xml'))
    parser.add_argument('--uploads',default=str(ROOT/'reference/wp-content/uploads'))
    parser.add_argument('--output',default=str(ROOT/'artifacts/backend-private'));parser.add_argument('--write',action='store_true')
    args=parser.parse_args();rows,report=prepare(args.sql,args.xml,args.uploads)
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    (ROOT/'artifacts/migration-reconciliation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    if args.write:
        (out/'content-manifest.json').write_text(json.dumps(rows,ensure_ascii=False),encoding='utf-8')
        conflict={'place_redirects':'slug','app_settings':'key','place_details':'place_id','place_areas':'place_id,area_id','place_categories':'place_id,category_id','place_media':'place_id,kind,position','taxonomy_media':None}
        statements=['begin;','set local standard_conforming_strings=on;',"set local request.jwt.claim.sub='';", "set local request.jwt.claims='{}';"]
        # Reconcile join sets in one transaction rather than retaining stale associations.
        for table in ('place_areas','place_categories','place_media'):
            statements.append(f'delete from public.{table} where place_id in ('+','.join(literal(p['id']) for p in rows['places'])+');')
        statements.append('delete from public.taxonomy_media where area_id in ('+','.join(literal(p['id']) for p in rows['areas'])+') or category_id in ('+','.join(literal(p['id']) for p in rows['categories'])+');')
        for table in ('areas','categories','places','place_details','media','media_files','place_areas','place_categories','place_media','taxonomy_media','place_redirects','app_settings'):
            for row in rows.get(table,[]):
                if table=='taxonomy_media':
                    statements.append('insert into public.taxonomy_media ('+','.join(row)+') values ('+','.join(literal(v) for v in row.values())+') on conflict do nothing;')
                else: statements.append(sql_row(table,row,conflict.get(table,'id')))
        statements.append('commit;');(out/'content-import.sql').write_text('\n'.join(statements),encoding='utf-8',newline='\n')
    print(json.dumps({'prepared_counts':report['prepared_counts'],'missing_files':len(report['missing_files']),'unsupported_media':len(report['unsupported_media']),'excluded_legacy_id':5693,'imported':False,'manifest_written':args.write},indent=2))
