// Pixel changes are evidence to review, not a claim that a redesign is identical.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
const root='artifacts/phase3-1';
const before=JSON.parse(await readFile(`${root}/before/results-all.json`,'utf8'));
const after=JSON.parse(await readFile(`${root}/after/results-all.json`,'utf8'));
await mkdir(`${root}/comparisons`,{recursive:true});
const selected=['_merch_','_merch_products_whats_it_gonna_be_tee_','featured-cards','_contact_','light-overview','light-place-editor','light-member-dialog','light-mfa','card-hover-tooltip','_account_','planner'];
const result=[];
for(const old of before.filter(r=>selected.includes(r.id)&&[390,1440].includes(r.width))){
 if(old.width===390&&['light-member-dialog','light-mfa'].includes(old.id))continue; // Baseline captured an earlier async state, not a like-for-like open form.
 const current=after.find(r=>r.role===old.role&&r.id===old.id&&r.width===old.width);if(!current)continue;
 const a=PNG.sync.read(await readFile(`${root}/before/${old.screenshot}`)),b=PNG.sync.read(await readFile(`${root}/after/${current.screenshot}`));
 if(a.width!==b.width||a.height!==b.height)throw Error('Viewport dimensions changed');
 const diff=new PNG({width:a.width,height:a.height});
 const changed=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:.1,includeAA:false});
 const name=`${old.role}-${old.id}-${old.width}`;
 await writeFile(`${root}/comparisons/${name}-diff.png`,PNG.sync.write(diff));
 result.push({role:old.role,id:old.id,width:old.width,different_pixels:changed,total_pixels:a.width*a.height,percent:Number((changed/(a.width*a.height)*100).toFixed(3)),before:`before/${old.screenshot}`,after:`after/${current.screenshot}`,interpretation:['planner','_account_'].includes(old.id)?'Preserved workflow; synthetic fixture state and temporary trip identifier may differ.':'Intentional shared component, typography, spacing or theme change; inspect paired captures.'});
}
await writeFile(`${root}/comparisons/results.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({pairs:result.length,comparisons:result.map(r=>({id:r.id,width:r.width,percent:r.percent}))},null,2));
