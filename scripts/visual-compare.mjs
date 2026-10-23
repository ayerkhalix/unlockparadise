import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const root=process.cwd();
const recorder=process.env.UPD_RECORDER||path.join(process.env.USERPROFILE||process.env.HOME,"Desktop","unlock paradise automation","website-recorder");
const profile=process.env.VISUAL_PROFILE||"public";
const base=process.env.VISUAL_URL||(profile==="public"?"http://127.0.0.1:3000":"http://127.0.0.1:3001");
const only=process.env.VISUAL_ONLY;
const widths=process.env.VISUAL_VIEWPORTS?.split(",").map(Number);
const exact=process.env.VISUAL_EXACT_PATH;
const manifest=JSON.parse(await fs.readFile(path.join(recorder,"reports/screenshot-manifest.json"),"utf8")).data;
const entries=manifest.filter(x=>x.profile===profile&&x.kind==="reference"&&(!only||x.url.includes(only))&&(!widths||widths.includes(x.viewport.width))&&(!exact||new URL(x.url).pathname===exact));
const output=path.join(root,"artifacts/comparisons",profile);
await fs.mkdir(output,{recursive:true});
await fs.mkdir(path.join(root,"artifacts/screenshots",profile),{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==="win32"?"chrome":undefined)});
const results=[];

function padded(png,width,height){const out=new PNG({width,height});PNG.bitblt(png,out,0,0,png.width,png.height,0,0);return out;}
async function compare(referenceFile,actualFile,id){
  const ref=PNG.sync.read(await fs.readFile(referenceFile)),actual=PNG.sync.read(await fs.readFile(actualFile));
  const width=Math.max(ref.width,actual.width),height=Math.max(ref.height,actual.height);
  const a=padded(ref,width,height),b=padded(actual,width,height),diff=new PNG({width,height});
  const count=pixelmatch(a.data,b.data,diff.data,width,height,{threshold:.1,includeAA:false});
  const diffFile=path.join(output,`${id}--diff.png`);
  await fs.writeFile(diffFile,PNG.sync.write(diff));
  const blend=new PNG({width,height});
  for(let i=0;i<a.data.length;i+=4){for(let c=0;c<3;c++)blend.data[i+c]=Math.round((a.data[i+c]+b.data[i+c])/2);blend.data[i+3]=255;}
  await fs.writeFile(path.join(output,`${id}--overlay.png`),PNG.sync.write(blend));
  const metrics={reference:{width:ref.width,height:ref.height},actual:{width:actual.width,height:actual.height},differentPixels:count,totalPixels:width*height,mismatchPercent:Number((count/(width*height)*100).toFixed(4)),diff:diffFile};
  // Compare the static sand band and footer separately, without concealing the full-image result.
  if(id.startsWith("home-")&&ref.width===actual.width&&ref.height===actual.height){
    let start=-1,end=-1;
    for(let y=0;y<ref.height;y++){const i=y*ref.width*4;if(ref.data[i]===233&&ref.data[i+1]===226&&ref.data[i+2]===212){if(start<0)start=y;end=y+1;}}
    if(start>=0){
      metrics.staticRegions={};
      for(const [name,y,h]of[["featured",start,end-start],["footer",end,ref.height-end]]){
        const ca=new PNG({width:ref.width,height:h}),cb=new PNG({width:actual.width,height:h});
        PNG.bitblt(ref,ca,0,y,ref.width,h,0,0);PNG.bitblt(actual,cb,0,y,actual.width,h,0,0);
        metrics.staticRegions[name]=Number((pixelmatch(ca.data,cb.data,null,ref.width,h,{threshold:.1})/(ref.width*h)*100).toFixed(4));
      }
    }
  }
  return metrics;
}

async function prepare(page){
  await page.evaluate(()=>document.fonts.ready);
  // Same lazy-scroll readiness algorithm as the read-only recorder.
  for(let step=0;step<90;step++){
    const state=await page.evaluate(()=>{window.scrollBy(0,Math.max(250,innerHeight*.8));return{bottom:scrollY+innerHeight>=document.documentElement.scrollHeight-3,height:document.documentElement.scrollHeight};});
    await page.waitForTimeout(120);
    if(state.bottom){await page.waitForTimeout(350);if(await page.evaluate(()=>document.documentElement.scrollHeight)<=state.height)break;}
  }
  await page.evaluate(async()=>{
    await Promise.race([Promise.all(Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener("load",resolve,{once:true});img.addEventListener("error",resolve,{once:true});}))),new Promise(resolve=>setTimeout(resolve,8000))]);
    window.scrollTo(0,0);
  });
  await page.waitForTimeout(350);
}

try{
  for(const entry of entries){
    const {width,height,mobile}=entry.viewport;
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,timezoneId:"Asia/Manila"});
    await context.route("**/*",route=>!["GET","HEAD"].includes(route.request().method())&&route.request().url().startsWith("https://")?route.abort():route.continue());
    const page=await context.newPage();
    const route=new URL(entry.url).pathname;
    const id=`${route==="/"?"home":route.replaceAll("/","-").replace(/^-|-$/g,"")}--${width}x${height}`;
    const errors=[];page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error"&&/same key|hydration|uncaught|react error/i.test(message.text()))errors.push(message.text());});
    await page.goto(base+route,{waitUntil:"load"});
    await prepare(page);
    const readiness=await page.evaluate(()=>({scrollY,fontStatus:document.fonts.status,bodyHeight:document.documentElement.scrollHeight,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2,brokenImages:Array.from(document.images).filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)}));
    const actualFile=path.join(root,"artifacts/screenshots",profile,`${id}.png`);
    await page.screenshot({path:actualFile,fullPage:true,animations:"allow"});
    const metrics=await compare(path.join(recorder,entry.file),actualFile,id);
    results.push({id,url:entry.url,profile,viewport:entry.viewport,source:entry.file,actualFile,readiness,errors,...metrics});
    await fs.writeFile(path.join(output,"latest-run-progress.json"),JSON.stringify(results,null,2));
    console.log(`${results.length}/${entries.length} ${id}: ${metrics.mismatchPercent}%`);
    await context.close();
  }
  // An opening viewport comparison uses the recorder's initial frame, free of full-page capture effects.
  if(profile==="public"&&(!only||"https://unlockparadise.ph/".includes(only))&&(!exact||exact==="/")){
    for(const entry of manifest.filter(x=>x.profile==="public"&&x.kind==="animation-initial"&&x.url==="https://unlockparadise.ph/")){
      const {width,height,mobile}=entry.viewport;
      const page=await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
      await page.goto(base+"/");await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1200);
      const id=`home-initial--${width}x${height}`,actualFile=path.join(root,"artifacts/screenshots",profile,id+".png");
      await page.screenshot({path:actualFile});
      results.push({id,url:entry.url,profile,source:entry.file,actualFile,...await compare(path.join(recorder,entry.file),actualFile,id)});
      const loaded=manifest.find(x=>x.profile==="public"&&x.kind==="animation-intermediate"&&x.url===entry.url&&x.viewport.width===width);
      if(loaded){const loadedId=`home-loaded--${width}x${height}`;results.push({id:loadedId,url:entry.url,profile,source:loaded.file,actualFile,...await compare(path.join(recorder,loaded.file),actualFile,loadedId)});}
      await page.close();
    }
  }
}finally{await browser.close();}
const prior=(only||exact||widths)?await fs.readFile(path.join(output,"results.json"),"utf8").then(JSON.parse).catch(()=>[]):[];
const combined=[...prior.filter(p=>!results.some(r=>r.id===p.id)),...results];
await fs.writeFile(path.join(output,"results.json"),JSON.stringify(combined,null,2));
const lines=[`# ${profile} visual comparison`,``, `Full-image pixel differences include original smooth-scroll, animation, map tile and capture artifacts. They are measurements, not claims of exact fidelity. Threshold: 0.1; antialias-only pixels excluded. Dimension differences are padded and counted.`,``,`| Page / viewport | Reference size | Local size | Pixel mismatch |`,`| --- | --- | --- | ---: |`,...combined.map(r=>`| ${r.id} | ${r.reference.width}×${r.reference.height} | ${r.actual.width}×${r.actual.height} | ${r.mismatchPercent}% |`),``,`See results.json for paths, errors, overflow, image readiness and separate homepage static-region measurements.`];
await fs.writeFile(path.join(output,"REPORT.md"),lines.join("\n")+"\n");
await fs.writeFile(path.join(output,"index.html"),`<!doctype html><meta charset="utf-8"><title>Unlock Paradise visual comparisons</title><style>body{font:14px system-ui;background:#11202a;color:#e8e8e8;padding:24px}article{margin-bottom:40px}a{color:#86d8c8}.images{display:flex;gap:12px;align-items:flex-start}.images img{width:32%;height:auto}h2{font-size:18px}</style><h1>${profile} visual comparisons</h1><p>Original references remain read-only. Local capture, diff and overlay are shown side by side. Raw mismatch includes capture-state and live map differences.</p>${combined.map(r=>`<article><h2>${r.id}: ${r.mismatchPercent}%</h2><div class="images"><img src="${path.relative(output,r.actualFile).replaceAll("\\","/")}" alt="Local screenshot"><img src="${r.id}--diff.png" alt="Pixel difference"><img src="${r.id}--overlay.png" alt="50 percent original and local overlay"></div></article>`).join("")}`);
console.log(`Saved ${combined.length} comparisons to ${output}`);
