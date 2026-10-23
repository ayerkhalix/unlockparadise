// Real local/staging visual inventory. Credentials and captures remain ignored.
import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { stagingIdentity } from './helpers/staging-auth.ts';
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const stage=process.env.AUDIT_STAGE||'before';
const output=`artifacts/phase3-1/${stage}`;
const widths=[375,390,768,1024,1440,1920];
const only=process.env.AUDIT_ROLE;
const selectedIds=process.env.AUDIT_IDS?.split(',');
const fragments=JSON.parse(await readFile('src/data/fragments.json','utf8'));
const browser=await chromium.launch({channel:process.platform==='win32'?'chrome':undefined});
await mkdir(output,{recursive:true});
const results=process.env.AUDIT_RESUME==='1'?JSON.parse(await readFile(`${output}/results-${only||'all'}.json`,'utf8').catch(()=>'[]')):[];
const publicRoutes=['/','/about/','/membership/','/contact/','/login/','/join/','/forgot-password/','/reset-password/','/privacy-policy/','/terms/','/refunds/',...Object.keys(fragments).filter(k=>/^(area\/[^/]+|place_category\/[^/]+)$/.test(k)).map(k=>`/${k}/`),'/area/ppc-north/beaches/','/place/bayog-beach/','/merch/','/merch/products/whats-it-gonna-be-tee/','/merch/cart/','/merch/checkout/'];
await writeFile(`${output}/route-inventory.json`,JSON.stringify({route_templates:['/','/[...path]/','/place/[slug]/','/itineraries/','/itineraries/new/','/itineraries/[id]/','/bucketlist/','/visited/','/merch/','/merch/products/[slug]/','/merch/cart/','/merch/checkout/','/admin/','/admin/mfa/','/admin/preview/[id]/'],retained_fragments:Object.keys(fragments).filter(k=>!['header','footer','hero','featured'].includes(k)),public_sample:publicRoutes,excluded:'Legacy export aliases and individual duplicates of the same destination/archive template are inventoried, not each visually audited.'},null,2));
async function settled(page){
 await page.waitForFunction(()=>document.documentElement.dataset.updReady==='true');
 if(await page.locator('.studio').count()) await page.waitForFunction(()=>![...document.querySelectorAll('.studio-load')].some(e=>e.textContent.includes('Loading records')));
 await page.evaluate(()=>document.fonts.ready);
 if(page.url().includes('/admin/mfa/'))await page.getByLabel('Six digit code',{exact:true}).waitFor();
}
async function capture(page,role,id,route,prepare){
 if(selectedIds&&!selectedIds.includes(id))return;
 if(widths.every(width=>results.some(r=>r.role===role&&r.id===id&&r.width===width)))return;
 const errors=[];const listener=e=>errors.push(e.message);page.on('pageerror',listener);
 let response;
 if(route){try{response=await page.goto(base+route);}catch(error){if(!String(error).includes('ERR_ABORTED'))throw error;response=await page.goto(base+route);}await settled(page);}
 await page.evaluate(()=>document.querySelectorAll('img[loading="lazy"]').forEach(image=>image.loading='eager'));
 for(const width of widths){
  await page.setViewportSize({width,height:width<768?844:900});
  if(process.env.AUDIT_FRESH_WIDTH==='1'&&route){await page.goto(base+route);await settled(page);await page.evaluate(()=>document.querySelectorAll('img[loading="lazy"]').forEach(i=>i.loading='eager'));}
  await page.evaluate(()=>scrollTo(0,0));
  if(prepare) await prepare(page,width);
  await page.waitForTimeout(120);
  await page.waitForFunction(()=>[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0;}).every(i=>i.complete),undefined,{timeout:20000}).catch(()=>{});
  const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,scroll_width:document.documentElement.scrollWidth,broken_visible_images:[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.top<innerHeight&&r.bottom>0&&i.complete&&!i.naturalWidth;}).map(i=>i.getAttribute('src')),unnamed_buttons:[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width&&!b.getAttribute('aria-label')&&!b.getAttribute('aria-labelledby')&&!b.textContent.trim()&&!b.querySelector('img[alt]')).map(b=>b.outerHTML.slice(0,180)),cards:[...document.querySelectorAll('.upd-card,.upd-featured-card,.p2-product-card,.p2-stop')].slice(0,12).map(el=>({class:el.className,width:el.getBoundingClientRect().width,padding:getComputedStyle(el).padding}))}));
  const violations=[390,1440].includes(width)?(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})):[];
  const name=`${role}-${id}-${width}`;
  await page.screenshot({path:`${output}/${name}.png`,fullPage:false,animations:'disabled'});
  if([390,1440].includes(width)&&route) await page.screenshot({path:`${output}/${name}-full.png`,fullPage:true,animations:'disabled'});
  results.push({role,id,route:route||page.url().replace(base,''),width,status:response?.status()||200,...geometry,violations,errors:[...errors],screenshot:`${name}.png`});
 }
 page.off('pageerror',listener);
 await writeFile(`${output}/results-${only||'all'}.json`,JSON.stringify(results,null,2));
 console.log(`${role} ${id}: ${results.slice(-6).filter(r=>r.overflow||r.broken_visible_images.length||r.unnamed_buttons.length||r.violations.length||r.errors.length).length} flagged widths`);
}
try{
 for(const role of ['public','premium','admin'].filter(r=>!only||r===only)){
  const context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Manila'});
  if(role!=='public')await stagingIdentity(context,role);
  const page=await context.newPage();let trip;
  try{
   if(role==='public'){
    for(const route of publicRoutes)await capture(page,role,route.replace(/[^a-z0-9]/gi,'_')||'home',route);
    await page.goto(base+'/merch/products/whats-it-gonna-be-tee/');await settled(page);
    await page.getByRole('radio',{name:'M',exact:true}).check();
    await page.getByRole('button',{name:stage==='before'?'Add to cart':'Add to bag',exact:true}).click();
    await capture(page,role,'shopping-bag-filled','/merch/cart/');
    await capture(page,role,'featured-cards','/',async p=>{await p.locator('#featured').scrollIntoViewIfNeeded();});
    if(stage!=='before')await capture(page,role,'catalog-grid','/merch/',async p=>{await p.locator('.p2-product-grid').scrollIntoViewIfNeeded();});
   }else if(role==='premium'){
    const made=await context.request.post(base+'/api/v1/itineraries/',{headers:{Origin:base},data:{title:'[TEST] Phase 3.1 visual audit',notes:'Temporary synthetic audit trip',day_count:3,start_date:null,end_date:null}});
    if(!made.ok())throw Error('Synthetic audit trip failed');trip=(await made.json()).data;
    const found=await context.request.get(base+'/api/v1/planning-places/?search=mandyukot');const place=(await found.json()).data[0];
    if(place){const added=await context.request.patch(base+`/api/v1/itineraries/${trip.id}/`,{headers:{Origin:base},data:{version:trip.version,action:'add',payload:{day_id:trip.itinerary_days[0].id,place_id:place.id}}});if(!added.ok())throw Error('Audit trip stop failed');trip=(await added.json()).data;}
    for(const route of ['/account/','/portfolio/','/visited/','/bucketlist/',`/itineraries/?trip=${trip.id}`,'/place/mandyukot-beach/','/place/100-cafe-moto/','/place/magarwak-mountain/'])await capture(page,role,route.startsWith('/itineraries')?'planner':route.replace(/[^a-z0-9]/gi,'_'),route);
    await capture(page,role,'planner-place-selector',`/itineraries/?trip=${trip.id}`,async p=>{await p.getByLabel('Search destinations',{exact:true}).scrollIntoViewIfNeeded();await p.getByLabel('Search destinations',{exact:true}).focus();});
    await capture(page,role,'card-hover-tooltip','/place_category/beaches/',async p=>{const card=p.locator('.upd-card').first();await card.scrollIntoViewIfNeeded();await card.hover();const action=card.locator('[data-member-op]').first();await action.focus();await p.waitForTimeout(400);});
    await page.goto(base+'/');await settled(page);await page.getByRole('button',{name:/^Open Bucketlist/}).click();
    await capture(page,role,'bucketlist-drawer',null);
    await page.keyboard.press('Escape');
    await page.goto(base+'/account/');await settled(page);
    await capture(page,role,'account-menu',null,async p=>{const toggle=p.locator('.upd-header__toggle');if(await toggle.isVisible()&&!await p.locator('.p2-modal').count())await toggle.click();if(!await toggle.isVisible()&&await p.locator('.p2-modal').count())await p.keyboard.press('Escape');const menu=p.locator('.p2-account').filter({visible:true});await menu.evaluate(el=>el.open=true);});
   }else{
    const themes=stage==='before'?['light']:['dark','light'];
    for(const theme of themes){
     if(stage!=='before')await context.addCookies([{name:'upd-admin-theme',value:theme,url:base,sameSite:'Lax'}]);
     for(const section of ['overview','places','merchandise','orders','analytics','members','reviews','settings'])await capture(page,role,`${theme}-${section}`,`/admin/?section=${section}`);
     await page.goto(base+'/admin/?section=places');await settled(page);await page.getByRole('button',{name:/^Edit /}).first().click();
     await page.getByRole('heading',{name:'Edit Place',exact:true}).waitFor();
     await page.locator('.studio-content details').evaluateAll(es=>es.forEach(e=>e.open=true));
     await capture(page,role,`${theme}-place-editor`,null);
     await page.goto(base+'/admin/?section=merchandise');await settled(page);await page.getByRole('button',{name:/^Edit /}).first().click();
     await page.getByRole('heading',{name:'Edit product',exact:true}).waitFor();
     await page.locator('.studio-content details').evaluateAll(es=>es.forEach(e=>e.open=true));
     await capture(page,role,`${theme}-product-editor`,null);
     await page.goto(base+'/admin/?section=members');await settled(page);await page.getByRole('button',{name:/^Manage Staging/}).first().click();
     await page.locator('dialog[open]').waitFor();
     await capture(page,role,`${theme}-member-dialog`,null);
     await page.keyboard.press('Escape');
     await capture(page,role,`${theme}-native-select`,'/admin/?section=places',async p=>{await p.keyboard.press('Escape');await p.getByLabel('Statuses',{exact:true}).focus();await p.keyboard.press('Alt+ArrowDown');});
     await page.keyboard.press('Escape');
    }
    const mfaContext=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Manila'});
    try{await stagingIdentity(mfaContext,'admin',false);const mfaPage=await mfaContext.newPage();for(const theme of themes){if(stage!=='before')await mfaContext.addCookies([{name:'upd-admin-theme',value:theme,url:base,sameSite:'Lax'}]);await capture(mfaPage,role,`${theme}-mfa`,'/admin/mfa/');}}finally{await mfaContext.close();}
   }
  }finally{
   if(trip){const current=await context.request.get(base+`/api/v1/itineraries/${trip.id}/`);if(current.ok()){const data=(await current.json()).data;const deleted=await context.request.delete(base+`/api/v1/itineraries/${trip.id}/`,{headers:{Origin:base},data:{version:data.version}});if(!deleted.ok())throw Error('Synthetic audit trip cleanup failed');}}
   await context.close();
  }
 }
}finally{await browser.close();}
console.log(JSON.stringify({stage,checks:results.length,flagged:results.filter(r=>r.overflow||r.broken_visible_images.length||r.unnamed_buttons.length||r.violations.length||r.errors.length).length}));
