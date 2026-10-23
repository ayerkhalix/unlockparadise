import {chromium} from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import {PNG} from "pngjs";
import pixelmatch from "pixelmatch";

const root=process.cwd();
const out=path.join(root,"artifacts/responsive");await fs.mkdir(out,{recursive:true});
const audit=JSON.parse(await fs.readFile("reference/recorder-audit.json","utf8"));
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==="win32"?"chrome":undefined)});
const results=[];
try{
  for(const viewport of audit.viewports){
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:viewport.mobile,hasTouch:viewport.mobile,deviceScaleFactor:1});
    await context.route("**/*",route=>!["GET","HEAD"].includes(route.request().method())?route.abort():route.continue());
    const pair=[];
    for(const [name,url] of [["local","http://127.0.0.1:3000/"],["original-live","https://unlockparadise.ph/"]]){
      const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
      await page.goto(url,{waitUntil:"load"});await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(1200);
      const metrics=await page.evaluate(()=>({bodyWidth:document.body.scrollWidth,documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,height:document.documentElement.scrollHeight,heroHeight:document.querySelector('.upd-hero')?.getBoundingClientRect().height,mapHeight:document.querySelector('#palawan-map')?.getBoundingClientRect().height}));
      const file=path.join(out,`${name}--${viewport.width}x${viewport.height}.png`);await page.screenshot({path:file});pair.push({file,metrics,errors});await page.close();
    }
    const a=PNG.sync.read(await fs.readFile(pair[0].file)),b=PNG.sync.read(await fs.readFile(pair[1].file));const diff=new PNG({width:a.width,height:a.height});
    const count=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:.1});
    await fs.writeFile(path.join(out,`diff--${viewport.width}x${viewport.height}.png`),PNG.sync.write(diff));
    results.push({viewport,local:pair[0],supplementalLiveOriginal:pair[1],mismatchPercent:Number((count/(a.width*a.height)*100).toFixed(4))});
    console.log(viewport.id,results.at(-1).mismatchPercent+"%",`local width ${pair[0].metrics.documentWidth}/${viewport.width}`);
    await context.close();
  }
}finally{await browser.close();}
await fs.writeFile(path.join(out,"results.json"),JSON.stringify({note:"Supplemental read-only live captures made during this implementation. These do not replace the historical recorder references.",results},null,2));
