import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:process.platform==='win32'?'chrome':undefined});
const out='artifacts/backend-baseline'; await mkdir(out,{recursive:true});
for(const width of [1440,390]) {
 const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
 for(const route of ['/','/about/','/login/','/area/ppc-north/beaches/','/place/100-cafe-moto/']) {
  await page.goto('http://127.0.0.1:3000'+route,{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('#upd-main').waitFor();
  await page.waitForTimeout(1200);
  await page.evaluate(()=>document.fonts.ready);
  const name=(route.replaceAll('/','-')||'home')+'-'+width;
  await page.screenshot({path:`${out}/${name}.png`,fullPage:true,animations:'disabled',mask:[page.locator('#palawan-map')]});
  await writeFile(`${out}/${name}.html`,await page.content());
 }
 await page.close();
}
await browser.close(); console.log('Saved 10 local reference captures.');
