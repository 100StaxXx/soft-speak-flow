#!/usr/bin/env node
// Reviews existing bytes only. Never submits a generation or increases a budget.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {createClient} from '@supabase/supabase-js';
import {verifyTemporal} from './verify-companion-temporal.mjs';
const exec=promisify(execFile);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function publicMediaURL(job,origin) {
 const u=new URL(job.video_url);
 const prefix=`/storage/v1/object/public/companion-animation-videos/${job.user_id}/`;
 if(u.protocol!=='https:'||u.origin!==origin||u.username||u.password||u.search||u.hash||!u.pathname.startsWith(prefix)||!(job.source_kind==='package'?u.pathname.endsWith('.webm'):u.pathname.endsWith('.mp4'))||/%|\\/.test(u.pathname))throw Error('unsafe_media_source');
 return u.href;
}
export function validateProbe(probe,expected) {
 const stream=probe.streams?.[0],duration=Number(probe.format?.duration);
 if(!stream||!Number.isFinite(duration)||duration<1||duration>40||stream.width<64||stream.height<64||stream.width>2048||stream.height>2048)throw Error('quality_media_format');
 if(expected!=null&&Math.abs(duration-Number(expected))>0.6)throw Error('quality_media_duration');
 const [n,d]=String(stream.avg_frame_rate).split('/').map(Number),fps=n/d;
 if(!Number.isFinite(fps)||fps<10||fps>60)throw Error('quality_media_framerate');
 return {duration,width:stream.width,height:stream.height,fps};
}
export async function inspectMedia(file,dir,{expected=null,loop=false,alpha=false,signal=AbortSignal.timeout(120000)}={}) {
 const run=(command,args)=>exec(command,args,{signal,timeout:120000,maxBuffer:1024*1024});
 const probe=JSON.parse((await run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,avg_frame_rate:format=duration','-of','json',file])).stdout);
 const metadata=validateProbe(probe,expected);
 const bytes=await fs.readFile(file),sha256=digest(bytes);
 const temporal=await verifyTemporal(file,{loop,alpha,signal});
 const report={passed:temporal.passed,sha256,metadata,temporal};
 if(!report.passed)return {report};
 // Include the first and final decoded frames, rather than timestamps after EOF.
 const indices=Array.from({length:12},(_,i)=>Math.round(i*(temporal.frameCount-1)/11));
 const selection=[...new Set(indices)].map(n=>`eq(n\\,${n})`).join('+');
 await run('ffmpeg',['-v','error','-n',...(alpha?['-c:v','libvpx-vp9']:[]),'-i',file,'-vf',`select=${selection},scale=384:256:force_original_aspect_ratio=decrease,pad=384:256:(ow-iw)/2:(oh-ih)/2:color=0x18202c`,'-fps_mode','vfr',path.join(dir,'sample-%02d.png')]);
 const names=(await fs.readdir(dir)).filter(n=>/^sample-\d+\.png$/.test(n)).sort();
 if(names.length!==new Set(indices).size)throw Error('quality_missing_samples');
 const tiles=[];
 for(const [i,name] of names.entries()) {
  const label=Buffer.from(`<svg width="384" height="28"><text x="10" y="20" fill="white" font-size="16">Frame ${indices[i]} / ${temporal.frameCount-1}</text></svg>`);
  const tile=await sharp({create:{width:384,height:284,channels:3,background:'#18202c'}}).composite([{input:await fs.readFile(path.join(dir,name)),left:0,top:0},{input:label,left:0,top:256}]).png().toBuffer();
  tiles.push({input:tile,left:(i%3)*384,top:Math.floor(i/3)*284});
 }
 const sheet=await sharp({create:{width:1152,height:Math.ceil(names.length/3)*284,channels:3,background:'#18202c'}}).composite(tiles).jpeg({quality:90}).toBuffer();
 return {report,sheet};
}
async function boundedDownload(response,signal) {
 if(!response.ok)throw Error('source_download_failed');
 let size=0;const chunks=[];
 for await(const chunk of response.body){if(signal.aborted)throw Error('worker_timeout');size+=chunk.length;if(size>64*1024*1024)throw Error('source_too_large');chunks.push(chunk);}
 return Buffer.concat(chunks);
}
export async function reviewOnce(db,origin,key) {
 const rpc=async(name,args={})=>{const {data,error}=await db.rpc(name,args).abortSignal(AbortSignal.timeout(20000));if(error)throw Error('worker_database_failed');return data;};
 const [job]=await rpc('claim_companion_media_review');if(!job)return false;
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cosmiq-media-review-'));
 const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),8*60_000);
 let busy=false;
 const heartbeat=setInterval(async()=>{if(busy)return;busy=true;try{if(!await rpc('heartbeat_companion_media_review',{p_id:job.id,p_lease:job.lease_token}))controller.abort();}catch{controller.abort();}finally{busy=false;}},30000);
 const finish=async(report,error=null)=>{
  const response=await fetch(`${origin}/functions/v1/companion-media-review`,{method:'POST',headers:{authorization:`Bearer ${key}`,apikey:key,'content-type':'application/json'},signal:AbortSignal.timeout(60000),body:JSON.stringify({action:'finish',id:job.id,lease:job.lease_token,report,error})});
  if(!response.ok)throw Error('worker_finish_failed');
 };
 let completedReport={passed:false};
 try{
  let url;
  if(job.video_bucket){
   if(job.video_bucket!=='companion-cinema-private'||!job.video_path?.startsWith(job.user_id+'/')||/\.\.|%|\\/.test(job.video_path))throw Error('unsafe_media_source');
   const {data,error}=await db.storage.from(job.video_bucket).createSignedUrl(job.video_path,120);if(error)throw Error('source_download_failed');url=data.signedUrl;
  }else url=publicMediaURL(job,origin);
  const bytes=await boundedDownload(await fetch(url,{redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])}),controller.signal);
  const file=path.join(dir,'source.mp4');await fs.writeFile(file,bytes,{flag:'wx'});
  const {report,sheet}=await inspectMedia(file,dir,{expected:job.expected_seconds,loop:job.loop_required,alpha:job.source_kind==='package',signal:controller.signal});
  completedReport=report;
  if(!report.passed){await finish(report,'quality_temporal_continuity');console.log('Media held for temporal review.');return true;}
  const storagePath=`${job.user_id}/quality/${job.id}/${report.sha256}.jpg`;
  const {error:ledger}=await db.from('user_storage_assets').upsert({user_id:job.user_id,bucket_id:'companion-cinema-private',storage_path:storagePath,source_kind:'companion_media_review',source_record_table:'companion_media_reviews',source_record_id:job.id},{onConflict:'bucket_id,storage_path'});
  if(ledger)throw Error('asset_registration_failed');
  const {error:upload}=await db.storage.from('companion-cinema-private').upload(storagePath,sheet,{contentType:'image/jpeg',upsert:false});if(upload&&String(upload.statusCode)!=='409')throw Error('asset_upload_failed');
  const response=await fetch(`${origin}/functions/v1/companion-media-review`,{method:'POST',headers:{authorization:`Bearer ${key}`,apikey:key,'content-type':'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)]),body:JSON.stringify({action:'visual',id:job.id,lease:job.lease_token,sha256:report.sha256})});
  if(!response.ok)throw Error('quality_visual_review_unavailable');
  const {assessment}=await response.json();
  await finish(report,assessment?.passed===true?null:'quality_visual_review_required');
  console.log(assessment?.passed===true?'Media passed numerical and visual review.':'Media held for visual review.');
  return true;
 }catch(error){
  const code=/^(quality_|unsafe_|source_|worker_|asset_)[a-z0-9_]+$/.test(error.message)?error.message:'worker_review_failed';
  await finish(completedReport,code).catch(()=>{});throw Error(code);
 }finally{clearInterval(heartbeat);clearTimeout(deadline);await fs.rm(dir,{recursive:true,force:true});}
}
async function main(){
 if(!process.argv.includes('--once')){console.log('Dry run. Use --once with the enabled worker configuration.');return;}
 if(process.env.COMPANION_MEDIA_WORKER_ENABLED!=='1')throw Error('worker_disabled');
 const origin=new URL(process.env.SUPABASE_URL).origin,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(origin)||!key)throw Error('worker_configuration');
 const db=createClient(origin,key,{auth:{persistSession:false,autoRefreshToken:false}});
 if(!await reviewOnce(db,origin,key))console.log('No eligible media.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(/^[a-z0-9_]+$/.test(error.message)?error.message:'worker_failed');process.exitCode=1;});
