// Synthetic pixels only; proves the hosted Mac can encode and decode HEVC alpha.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cosmiq-codec-smoke-'));
try {
 const frames=path.join(dir,'frames');await fs.mkdir(frames);
 for(let i=0;i<12;i++)await sharp(Buffer.from(`<svg width="640" height="640"><circle cx="${300+i*2}" cy="320" r="110" fill="#35c4ea"/></svg>`)).png().toFile(path.join(frames,String(i).padStart(4,'0')+'.png'));
 const run=(script,args)=>execFileSync('swift',[script,...args],{timeout:120000,stdio:['ignore','pipe','pipe']});
 const video=path.join(dir,'test.mov'),decoded=path.join(dir,'decoded');
 run('scripts/encode-companion-alpha.swift',[frames,video]);
 run('scripts/inspect-companion-alpha.swift',[video,decoded,'0,6,11']);
 for(const i of [0,6,11]){const rgba=await sharp(path.join(decoded,String(i).padStart(4,'0')+'.png')).ensureAlpha().raw().toBuffer();assert.equal(rgba[3],0);assert.ok(rgba[(320*640+320)*4+3]>250);}
 console.log('Hosted HEVC alpha encoder and decoder passed synthetic smoke checks.');
}finally{await fs.rm(dir,{recursive:true,force:true});}
