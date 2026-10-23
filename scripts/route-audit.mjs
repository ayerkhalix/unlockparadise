import fs from "node:fs/promises";
const base=process.env.BASE_URL||"http://127.0.0.1:3000";
const destinations=JSON.parse(await fs.readFile("src/data/destinations.private.json","utf8"));
const fragments=JSON.parse(await fs.readFile("src/data/fragments.json","utf8"));
const inventory=JSON.parse(await fs.readFile("reference/route-inventory.json","utf8"));
const routes=["/",...Object.keys(fragments).filter(k=>!['header','footer','hero','featured'].includes(k)).map(k=>`/${k}/`),...destinations.map(p=>`/place/${p.slug}/`),...inventory.map(route=>new URL(route.url).pathname)];
const unique=[...new Set(routes)];const results=[];let index=0;
async function worker(){while(index<unique.length){const route=unique[index++];const response=await fetch(base+route);const body=await response.text();results.push({route,status:response.status,redirected:response.redirected,finalPath:new URL(response.url).pathname,hasMain:body.includes('id="upd-main"')});}}
await Promise.all(Array.from({length:5},worker));
await fs.mkdir("artifacts",{recursive:true});
await fs.writeFile("artifacts/route-audit.json",JSON.stringify({checked:unique.length,failures:results.filter(r=>r.status!==200||!r.hasMain),routes:results},null,2));
const failures=results.filter(r=>r.status!==200||!r.hasMain);console.log(`${unique.length} routes checked. ${failures.length} failures.`);if(failures.length){console.log(failures);process.exitCode=1;}
