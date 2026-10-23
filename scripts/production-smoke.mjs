import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {chromium} from "@playwright/test";

const base=process.env.BASE_URL||"http://127.0.0.1:3000";
const result={pages:[],clientFilesChecked:0,privateCanariesFound:false,homepage:null};
for(const route of ["/","/place/100-cafe-moto/","/place/bayog-beach/?tier=explorer-plus&preview=1","/login/"]){
  const response=await fetch(base+route);const body=await response.text();assert.equal(response.status,200);
  if(route.includes("/place/")){assert.ok(body.includes("upd-gate"));assert.ok(!body.includes("place-map-embed"));assert.ok(!body.includes("upd-gallery__photo"));}
  if(route==="/login/"){assert.ok(body.includes('data-endpoint="/api/auth/login/"'));assert.ok(body.includes('name="password"'));assert.ok(!body.includes('action="https://unlockparadise.ph'));}
  result.pages.push({route,status:response.status,publicGate:route.includes("/place/")});
}
const privateData=JSON.parse(await fs.readFile("src/data/destinations.private.json","utf8"));
const place=privateData.find(p=>p.slug==="bayog-beach");
const canaries=[place.gallery.at(-1),...place.coordinates.map(String)];
async function walk(dir){const entries=await fs.readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name.endsWith(".js")?[path.join(dir,e.name)]:[]))).flat();}
for(const file of await walk(".next/static")){const text=await fs.readFile(file,"utf8");assert.ok(!canaries.some(value=>text.includes(value)),`Protected fixture reached ${file}`);result.clientFilesChecked++;}
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==="win32"?"chrome":undefined)});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  await page.goto(base+"/");await page.evaluate(()=>document.fonts.ready);
  await page.locator('#palawan-map[data-map-ready="true"]').waitFor();
  result.homepage=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,heading:document.querySelector("h1")?.getAttribute("aria-label")}));
  assert.equal(result.homepage.width,1440);assert.equal(result.homepage.height,2363);
  await fs.mkdir("artifacts/screenshots",{recursive:true});await page.screenshot({path:"artifacts/screenshots/production-home--1440x900.png"});
}finally{await browser.close();}
await fs.writeFile("artifacts/production-smoke.json",JSON.stringify(result,null,2));
console.log(`Production smoke passed; ${result.clientFilesChecked} browser bundles checked; protected fixture canaries absent.`);
