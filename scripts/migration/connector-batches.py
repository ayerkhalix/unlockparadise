"""Transport the existing prepared manifest through size-bounded connector SQL calls.

No source parsing or alternative mappings. Every batch is transactional and can
be replayed; a partial run is not accepted until full field reconciliation.
"""
import json
from pathlib import Path
from prepare import literal, ARRAY_FIELDS

ORDER = ('areas','categories','places','place_details','media','media_files','place_areas','place_categories','place_media','taxonomy_media','place_redirects','app_settings')
CONFLICT = {'place_details':'place_id','place_areas':'place_id,area_id','place_categories':'place_id,category_id','place_media':'place_id,kind,position','taxonomy_media':None,'place_redirects':'slug','app_settings':'key'}

def batches(manifest, maximum=70000):
    output=[]
    for table in ORDER:
        rows=manifest.get(table,[])
        if not rows:continue
        keys=list(rows[0]);conflict=CONFLICT.get(table,'id')
        prefix='insert into public.'+table+' ('+','.join('"'+k+'"' for k in keys)+') values '
        update=','.join(('"status"=case when public.'+table+'.checksum=excluded.checksum then public.'+table+'.status else excluded.status end') if k=='status' and table in ('media','media_files') else '"'+k+'"=excluded."'+k+'"' for k in keys if conflict and k not in conflict.split(','))
        suffix=' on conflict'+((' ('+conflict+') do update set '+update) if conflict and update else (' ('+conflict+') do nothing' if conflict else ' do nothing'))+';'
        group=[];size=0
        for row in rows:
            values='('+','.join(('ARRAY['+','.join(literal(x) for x in row[k])+']::text[]') if k in ARRAY_FIELDS else literal(row[k]) for k in keys)+')'
            if group and size+len(values.encode())>maximum:
                output.append({'table':table,'rows':len(group),'query':'begin;set local standard_conforming_strings=on;'+prefix+','.join(group)+suffix+'commit;'})
                group=[];size=0
            group.append(values);size+=len(values.encode())
        if group:output.append({'table':table,'rows':len(group),'query':'begin;set local standard_conforming_strings=on;'+prefix+','.join(group)+suffix+'commit;'})
    return output

if __name__=='__main__':
    source=Path('artifacts/backend-private/content-manifest.json')
    data=batches(json.loads(source.read_text(encoding='utf-8')))
    target=Path('artifacts/backend-private/connector-batches.json')
    target.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'batches':len(data),'rows':sum(b['rows'] for b in data),'sql_bytes':sum(len(b['query'].encode()) for b in data)}))
