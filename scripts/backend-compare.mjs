import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
const browser=await chromium.launch({channel:process.platform==='win32'?'chrome':undefined});
const out='artifacts/comparisons/backend';await mkdir(out,{recursive:true});const results=[];
for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
 for(const route of ['/','/about/','/login/','/area/ppc-north/beaches/','/place/100-cafe-moto/']){
  await page.goto('http://127.0.0.1:3000'+route,{waitUntil:'load',timeout:60000});await page.locator('#upd-main').waitFor();await page.waitForTimeout(1200);await page.evaluate(()=>document.fonts.ready);
  if(route.startsWith('/area/')) await page.locator('input[type=range]').first().waitFor({state:'attached',timeout:15000}).catch(()=>{});
  // The saved About baseline intentionally predates its below-fold lazy images.
  // Keep that capture contract; original-recorder comparisons test loaded images.
  if(route !== '/about/') for(let step=0;step<80;step++) { const bottom=await page.evaluate(()=>{scrollBy({top:innerHeight*.8,behavior:'instant'});return scrollY+innerHeight>=document.documentElement.scrollHeight-3;});await page.waitForTimeout(120);if(bottom)break; }
  await page.evaluate(async()=>{await Promise.race([Promise.all(Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}))),new Promise(resolve=>setTimeout(resolve,10000))]);scrollTo({top:0,behavior:'instant'});});await page.waitForTimeout(1200);
  const name=(route.replaceAll('/','-')||'home')+'-'+width;
  const image=await page.screenshot({path:`${out}/${name}.png`,fullPage:true,animations:'disabled',mask:[page.locator('#palawan-map')]});
  const original=PNG.sync.read(await readFile(`artifacts/backend-baseline/${name}.png`)),actual=PNG.sync.read(image);
  const w=Math.max(original.width,actual.width),h=Math.max(original.height,actual.height),a=new PNG({width:w,height:h}),b=new PNG({width:w,height:h}),diff=new PNG({width:w,height:h});
  PNG.bitblt(original,a,0,0,original.width,original.height,0,0);PNG.bitblt(actual,b,0,0,actual.width,actual.height,0,0);
  const count=pixelmatch(a.data,b.data,diff.data,w,h,{threshold:0.1});const percent=count/(w*h)*100;
  await writeFile(`${out}/${name}-diff.png`,PNG.sync.write(diff));results.push({route,width,originalHeight:original.height,height:actual.height,mismatchPercent:Number(percent.toFixed(4)),expectedFormChange:route==='/login/'});
 }
 await page.close();
}
await browser.close();await writeFile('artifacts/backend-visual-report.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
if(results.some(r=>!r.expectedFormChange&&(r.mismatchPercent>0.5||r.originalHeight!==r.height)))process.exitCode=1;
