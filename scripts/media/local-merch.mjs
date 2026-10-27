import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const input='public/merch/images',output='public/merch/optimized';
await mkdir(output,{recursive:true});
const manifest={};let originalBytes=0,cardBytes=0,files=0;
for(const name of await readdir(input)){
 if(!/\.(png|jpe?g|webp)$/i.test(name))continue;
 const source=await readFile(`${input}/${name}`);const meta=await sharp(source).metadata();
 if(!meta.width||(meta.pages||1)>1)continue;
 const rotated=(meta.orientation||0)>=5;const width=rotated?meta.height:meta.width;
 const sizes=[...new Set([256,384,640,1080,1920,Math.min(width,1920)].filter(w=>w<=width))].sort((a,b)=>a-b);
 const key=createHash('sha256').update(source).update('lossless-webp-v1').digest('hex').slice(0,16);
 const images={};
 for(const size of sizes){
  const data=await sharp(source).rotate().withIccProfile('srgb').resize({width:size,withoutEnlargement:true}).webp({lossless:true,effort:4}).toBuffer();
  const file=`${key}-${size}.webp`;await writeFile(`${output}/${file}`,data);images[size]=`/merch/optimized/${file}`;files++;
  if(size===640||(size===sizes.at(-1)&&width<640))cardBytes+=data.length;
 }
 manifest[`/merch/images/${name}`]=images;originalBytes+=source.length;
}
await writeFile('src/data/merch-images.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({sources:Object.keys(manifest).length,files,originalBytes,cardBytes}));
