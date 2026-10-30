#!/usr/bin/env node
// macOS finishing worker. Deliberately has NO video-generation/provider client.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { verifyTemporal } from './verify-companion-temporal.mjs';
import { ACTIONS, countFor, finishAnimationSet } from './companion-animation-processing.mjs';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function trustedSource(url, origin, userId, jobId) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.origin !== origin || parsed.search || parsed.hash || parsed.username || parsed.password
    || parsed.pathname !== `/storage/v1/object/public/companion-animation-videos/${userId}/wellbeing/${jobId}.mp4`) throw new Error('unsafe_source_url');
  return parsed.href;
}
export function validateInputs(job, origin) {
  if (job.pipeline_version !== 'alpha-v1' || !Array.isArray(job.inputs) || job.inputs.length !== 7) throw new Error('invalid_job');
  return ACTIONS.map(id => {
    const entries = job.inputs.filter(item => item.category === id);
    if (entries.length !== 1 || !/^[a-f0-9-]{36}$/.test(entries[0].id)) throw new Error('invalid_source_set');
    return { ...entries[0], video_url: trustedSource(entries[0].video_url, origin, job.user_id, entries[0].id) };
  });
}
async function download(url, output, signal) {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]), redirect: 'error' });
  if (!response.ok || !/^(video\/|application\/octet-stream)/.test(response.headers.get('content-type') ?? '')) throw new Error('source_download_failed');
  const limit = 32 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > limit) throw new Error('source_too_large');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > limit) throw new Error('source_too_large'); chunks.push(chunk); }
  await fs.writeFile(output, Buffer.concat(chunks), { flag: 'wx' });
}
// Only fixed stage names and allowlisted failure categories enter hosted logs.
// Child-process errors can contain private media paths and environment details.
export function processingFailureCode(error, stage) {
  const safeStage = /^[a-z_]+$/.test(stage) ? stage : 'processing';
  const stderr = typeof error?.stderr === 'string' ? error.stderr : '';
  let reason = 'failed';
  if (error?.name === 'AbortError') reason = 'aborted';
  else if (error?.killed) reason = 'timeout';
  else if (/No foreground in frame/.test(stderr)) reason = 'no_foreground';
  else if (/No space left on device|ENOSPC/.test(stderr)) reason = 'disk_full';
  else if (/Cannot decode video|Incomplete decode/.test(stderr)) reason = 'decode_failed';
  else if (/Decoder did not return requested frame/.test(stderr)) reason = 'frame_mismatch';
  else if (/HEVC alpha encoder unavailable/.test(stderr)) reason = 'codec_unavailable';
  else if (/Encoder stalled/.test(stderr)) reason = 'encoder_stalled';
  return `worker_${safeStage}_${reason}`;
}
async function run(command, args, signal, timeout = 15 * 60_000) {
  const stages = {
    'extract-companion-video-foreground.swift': 'extract_foreground',
    'pack-companion-actions.mjs': 'pack_actions',
    'encode-companion-alpha.swift': 'encode_hevc',
    'inspect-companion-alpha.swift': 'decode_hevc',
    'verify-companion-action-pack.mjs': 'verify_action_pack',
    'companion-animation-review-sheet.mjs': 'review_sheet',
  };
  const stage = stages[path.basename(args[0])] ?? (command === 'ffprobe' ? 'probe_source' : command === 'ffmpeg' ? 'ffmpeg' : 'processing');
  console.log(`Starting ${stage}`);
  try {
    const result = await exec(command, args, { cwd: root, signal, timeout, maxBuffer: 4 * 1024 * 1024 });
    console.log(`Completed ${stage}`);
    return result;
  } catch (error) {
    throw new Error(processingFailureCode(error, stage));
  }
}

export async function processLocalSet(actions, output, signal = AbortSignal.timeout(45 * 60_000)) {
  console.log('Starting finish_frames');
  const finished = await finishAnimationSet(actions, path.join(output, 'finished'));
  console.log('Completed finish_frames');
  const recipe = path.join(output, 'recipe.json');
  await fs.writeFile(recipe, JSON.stringify(finished.recipe), { flag: 'wx' });
  const packed = path.join(output, 'packed');
  await run(process.execPath, ['scripts/pack-companion-actions.mjs', recipe, packed], signal);
  const timeline = JSON.parse(await fs.readFile(path.join(packed, 'manifest.json'), 'utf8'));
  const mov = path.join(output, 'actions.mov'), webm = path.join(output, 'actions.webm'), poster = path.join(output, 'poster.webp');
  await run('swift', ['scripts/encode-companion-alpha.swift', packed, mov], signal);
  await run('ffmpeg', ['-v','error','-n','-framerate','24','-i',path.join(packed,'%04d.png'),
    '-vf','scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuva420p','-an','-c:v','libvpx-vp9','-b:v','0','-crf','18','-auto-alt-ref','0',
    '-color_primaries','bt709','-color_trc','iec61966-2-1','-colorspace','bt709','-color_range','tv',webm], signal);
  const indices = timeline.segments.flatMap(s => [s.startFrame,Math.floor((s.startFrame+s.endFrame)/2),s.endFrame,s.guardEndFrame]);
  const decoded = path.join(output, 'decoded-hevc');
  await run('swift', ['scripts/inspect-companion-alpha.swift',mov,decoded,indices.join(',')], signal);
  await sharp(path.join(decoded,'0000.png')).webp({ lossless: true }).toFile(poster);
  const qa = await run(process.execPath, ['scripts/verify-companion-action-pack.mjs',packed,decoded,poster], signal);
  const hevcReport = JSON.parse(qa.stdout);
  await run(process.execPath, ['scripts/companion-animation-review-sheet.mjs',output], signal);
  // Exercise an alpha-capable VP9 decoder too. Browser runtime independently
  // rejects opaque decode on devices without alpha support.
  const decodedWebm = path.join(output, 'decoded-webm'); await fs.mkdir(decodedWebm);
  const selection = indices.map(n => `eq(n\\,${n})`).join('+');
  await run('ffmpeg',['-v','error','-n','-c:v','libvpx-vp9','-i',webm,'-vf',`select=${selection}`,'-fps_mode','vfr',path.join(decodedWebm,'%04d.png')],signal);
  const samples = (await fs.readdir(decodedWebm)).sort();
  if (samples.length !== indices.length) throw new Error('quality_webm_samples');
  // ffmpeg starts at 1; rename to the original timeline frame indices without collisions.
  const normalized = path.join(output, 'decoded-webm-indexed'); await fs.mkdir(normalized);
  for (let n=0;n<indices.length;n++) await fs.link(path.join(decodedWebm,samples[n]),path.join(normalized,`${String(indices[n]).padStart(4,'0')}.png`));
  const webmPoster = path.join(output,'webm-poster.webp');
  await sharp(path.join(normalized,'0000.png')).webp({lossless:true}).toFile(webmPoster);
  const vp9 = await run(process.execPath,['scripts/verify-companion-action-pack.mjs',packed,normalized,webmPoster],signal);
  const temporal = await verifyTemporal(webm, { alpha: true, loop: true });
  if (!temporal.passed) throw new Error('quality_temporal_continuity');
  return { timeline, files: { hevc: mov, webm, poster }, report: {
    passed: true, pipelineVersion:'alpha-v1', requiresVisualReview:true,
    ...finished.report, temporal, hevc:hevcReport, webm:JSON.parse(vp9.stdout),
  } };
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes('--once') && !args.includes('--local-recipe')) {
    console.log('Dry run: no connection or paid work. Use --local-recipe recipe.json for an offline finish, or --once with explicit worker configuration.');
    console.log('Required: macOS, Swift, ffmpeg with libvpx, 4 GB free disk; see docs/2026-09-27-animation-production-pipeline.md.');
    return;
  }
  if (process.platform !== 'darwin') throw new Error('macos_worker_required');
  const disk = await fs.statfs(os.tmpdir());
  if (disk.bavail * disk.bsize < 4 * 1024 ** 3) throw new Error('worker_needs_4gb_free');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'cosmiq-animation-job-'));
  console.log(`Local artifacts: ${dir}`);
  if (args.includes('--local-recipe')) {
    const recipe = JSON.parse(await fs.readFile(args[args.indexOf('--local-recipe')+1],'utf8'));
    const result = await processLocalSet(recipe.actions,dir);
    await fs.writeFile(path.join(dir,'result.json'),JSON.stringify(result,null,2),{flag:'wx'});
    console.log('Offline quality checks passed. Visual review still required. No uploads or publication.'); return;
  }
  if (process.env.COMPANION_ANIMATION_WORKER_ENABLED !== '1') throw new Error('worker_not_enabled');
  const origin = new URL(process.env.SUPABASE_URL).origin;
  if (!origin.endsWith('.supabase.co') || !origin.startsWith('https://')) throw new Error('invalid_storage_origin');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('worker_credentials_missing');
  const db = createClient(origin,process.env.SUPABASE_SERVICE_ROLE_KEY,{ auth:{persistSession:false,autoRefreshToken:false} });
  const rpc = async (name,params) => { const {data,error}=await db.rpc(name,params).abortSignal(AbortSignal.timeout(20_000)); if(error) throw new Error('worker_database_request_failed'); return data; };
  const [job] = await rpc('claim_companion_animation_package',{});
  if (!job) { await fs.rm(dir,{recursive:true,force:true}); console.log('No eligible work.'); return; }
  console.log(`Processing package ${job.id}. No generation will be requested.`);
  const controller = new AbortController();
  const deadline = setTimeout(()=>controller.abort(),45*60_000);
  let heartbeating=false;
  const heartbeat = setInterval(async()=>{
    if(heartbeating) return; heartbeating=true;
    try { if(!await rpc('heartbeat_companion_animation_package',{p_id:job.id,p_lease:job.lease_token})) controller.abort(); }
    catch { controller.abort(); } finally { heartbeating=false; }
  },30_000);
  try {
    const inputs = validateInputs(job,origin), actions=[];
    for (const input of inputs) {
      if(controller.signal.aborted) throw new Error('worker_lease_lost');
      console.log(`Preparing action ${input.category}`);
      const clip=path.join(dir,`${input.category}.mp4`), masks=path.join(dir,`masks-${input.category}`);
      await download(input.video_url,clip,controller.signal);
      const probe=JSON.parse((await run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames','-of','json',clip],controller.signal)).stdout).streams[0];
      if(!probe || probe.r_frame_rate!=='24/1' || Number(probe.nb_frames)!==countFor(input.category)
        || probe.width>2048 || probe.height>2048) throw new Error('quality_source_format');
      await run('swift',['scripts/extract-companion-video-foreground.swift',clip,masks],controller.signal);
      actions.push({id:input.category,frames:masks});
    }
    const result=await processLocalSet(actions,dir,controller.signal);
    const assets={};
    for(const [format,file] of Object.entries(result.files)) {
      if(controller.signal.aborted) throw new Error('worker_lease_lost');
      const bytes=await fs.readFile(file), sha256=hash(bytes), ext=path.extname(file);
      if(bytes.length>64*1024*1024) throw new Error('quality_output_too_large');
      const storagePath=`${job.user_id}/foreground/${job.id}/${sha256}${ext}`;
      // Register before upload, so even a crash/orphan remains in account-deletion cleanup.
      const ledger=await db.from('user_storage_assets').upsert({user_id:job.user_id,bucket_id:'companion-animation-videos',
        storage_path:storagePath,source_kind:'companion_animation_package',source_record_table:'companion_animation_packages',source_record_id:job.id},
        {onConflict:'bucket_id,storage_path'});
      if(ledger.error) throw new Error('asset_registration_failed');
      const contentType={hevc:'video/quicktime',webm:'video/webm',poster:'image/webp'}[format];
      const uploaded=await db.storage.from('companion-animation-videos').upload(storagePath,bytes,{contentType,cacheControl:'31536000',upsert:false});
      if(uploaded.error && String(uploaded.error.statusCode)!=='409') throw new Error('asset_upload_failed');
      assets[format]={url:`${origin}/storage/v1/object/public/companion-animation-videos/${storagePath}`,sha256,bytes:bytes.length};
    }
    const manifest={schemaVersion:1,pipelineVersion:'alpha-v1',id:job.id,sourceImageUrl:job.source_image_url,stage:job.stage,
      width:640,height:640,fps:24,frameCount:result.timeline.frameCount,actions:result.timeline.segments,assets};
    const saved=await rpc('finish_companion_animation_package',{p_id:job.id,p_lease:job.lease_token,p_manifest:manifest,p_report:result.report,p_error:null});
    if(!saved) throw new Error('worker_lease_or_appearance_changed');
    await fs.writeFile(path.join(dir,'review.json'),JSON.stringify({manifest,report:result.report},null,2),{flag:'wx'});
    console.log(`Package ${job.id} awaits visual review. It is NOT published.`);
    // Retain the playable review files/report/contact sheet, not thousands of
    // intermediate frames. Every target was created inside this fresh job dir.
    for (const name of ['finished','packed','decoded-hevc','decoded-webm','decoded-webm-indexed',...ACTIONS.map(id=>`masks-${id}`)]) {
      await fs.rm(path.join(dir,name),{recursive:true,force:true});
    }
  } catch(error) {
    const known=/^(quality_|unsafe_|invalid_|source_|worker_|asset_)/.test(error.message) && /^[a-z0-9_]+$/.test(error.message);
    const code=known?error.message:'worker_processing_failed';
    await rpc('finish_companion_animation_package',{p_id:job.id,p_lease:job.lease_token,p_manifest:null,p_report:{passed:false},p_error:code}).catch(()=>{});
    // Avoid printing database credentials, signed URLs, or child-process environment.
    throw new Error(code);
  } finally { clearInterval(heartbeat);clearTimeout(deadline); if(process.env.CI==='true')await fs.rm(dir,{recursive:true,force:true}); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(/^[a-z0-9_]+$/.test(error.message)?error.message:'worker_failed; inspect retained local artifacts');process.exitCode=1;});
}
