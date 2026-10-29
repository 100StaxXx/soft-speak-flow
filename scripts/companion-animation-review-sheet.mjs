import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Diagnostic contact sheet of actual decoded frames, not new/generated artwork.
const [directory]=process.argv.slice(2);
if(!directory) throw new Error('Usage: companion-animation-review-sheet LOCAL_JOB_DIRECTORY');
const timeline=JSON.parse(await fs.readFile(path.join(directory,'packed','manifest.json'),'utf8'));
const samples=[{id:'neutral',frame:0},...timeline.segments.map(s=>({id:s.id,frame:Math.floor((s.startFrame+s.endFrame)/2)}))];
const layers=[];
for(let i=0;i<samples.length;i++) for(let background=0;background<2;background++) {
  const cell=i*2+background,x=(cell%4)*256,y=Math.floor(cell/4)*288;
  const source=path.join(directory,'decoded-hevc',`${String(samples[i].frame).padStart(4,'0')}.png`);
  const frame=await sharp(source).resize(256,256).png().toBuffer();
  const bg=background?'#f4f0e8':'#10202c';
  const tile=await sharp({create:{width:256,height:288,channels:4,background:bg}})
    .composite([{input:frame,left:0,top:0},{input:Buffer.from(`<svg width="256" height="32"><text x="12" y="22" font-family="sans-serif" font-size="16" fill="${background?'#18202a':'#ffffff'}">${samples[i].id}</text></svg>`),left:0,top:256}]).png().toBuffer();
  layers.push({input:tile,left:x,top:y});
}
const file=path.join(directory,'visual-review.png');
await sharp({create:{width:1024,height:1152,channels:4,background:'#101820'}}).composite(layers).png().toFile(file);
console.log(file);
