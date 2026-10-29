import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SIZE = 64, BYTES = SIZE * SIZE * 4;
export function summarizeFrame(rgba) {
  let luma = 0, black = 0, coverage = 0;
  const luminance = new Float32Array(rgba.length / 4);
  for (let p = 0; p < luminance.length; p++) {
    const a = rgba[p * 4 + 3] / 255;
    const y = (0.2126 * rgba[p * 4] + 0.7152 * rgba[p * 4 + 1] + 0.0722 * rgba[p * 4 + 2]) * a + 18 * (1 - a);
    luminance[p] = y; luma += y;
    if (y < 4) black++;
    if (a > 0.5) coverage++;
  }
  return { luminance, luma: luma / luminance.length, black: black / luminance.length, coverage: coverage / luminance.length };
}
export function frameChange(a, b) {
  let difference = 0, changed = 0;
  for (let p = 0; p < a.luminance.length; p++) {
    const delta = Math.abs(a.luminance[p] - b.luminance[p]);
    difference += delta; if (delta > 40) changed++;
  }
  return { difference: difference / a.luminance.length, changed: changed / a.luminance.length };
}
export function inspectFrames(frames, { alpha = false, loop = false } = {}) {
  if (frames.length < 3) throw new Error('quality_insufficient_temporal_frames');
  const issues = []; let maxFrameChange = 0;
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (alpha ? frame.coverage < 0.01 : frame.black > 0.98) issues.push({ frame: i, reason: alpha ? 'empty_foreground' : 'black_frame' });
    if (alpha && frame.coverage > 0.85) issues.push({ frame: i, reason: 'opaque_background' });
    if (i) {
      const change = frameChange(frames[i - 1], frame);
      maxFrameChange = Math.max(maxFrameChange, change.difference);
      if (change.difference > 65 && change.changed > 0.75) issues.push({ frame: i, reason: 'abrupt_scene_change' });
      if (alpha && frame.coverage < frames[i - 1].coverage * 0.35) issues.push({ frame: i, reason: 'foreground_dropout' });
    }
    if (i && i < frames.length - 1) {
      const before = frames[i - 1], after = frames[i + 1];
      const excursion = Math.min(Math.abs(frame.luma - before.luma), Math.abs(frame.luma - after.luma));
      if (excursion > 30 && Math.abs(before.luma - after.luma) < 10
        && frameChange(before, frame).changed > 0.6) issues.push({ frame: i, reason: 'isolated_flash' });
    }
  }
  const seam = frameChange(frames.at(-1), frames[0]);
  if (loop && seam.difference > 12) issues.push({ frame: 0, reason: 'loop_seam' });
  return { version: 1, passed: issues.length === 0, frameCount: frames.length, maxFrameChange, loopSeam: seam.difference, issues };
}
/** Stream tiny decoded frames; never write hundreds of full-resolution PNGs. */
export async function verifyTemporal(file, options = {}) {
  const args = ['-v', 'error', ...(options.alpha ? ['-c:v', 'libvpx-vp9'] : []), '-i', file,
    '-vf', `scale=${SIZE}:${SIZE}`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'];
  const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'], signal: options.signal });
  let pending = Buffer.alloc(0), stderr = '';
  const frames = [];
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-1000); });
  const done = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error('quality_temporal_decode_failed: ' + stderr))); });
  // Attach rejection immediately even if decoding fails while stdout is read.
  void done.catch(() => {});
  for await (const chunk of child.stdout) {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= BYTES) {
      frames.push(summarizeFrame(pending.subarray(0, BYTES))); pending = pending.subarray(BYTES);
      if (frames.length > 10000) { child.kill(); throw new Error('quality_temporal_video_too_long'); }
    }
  }
  await done;
  if (pending.length) throw new Error('quality_temporal_partial_frame');
  return inspectFrames(frames, options);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await verifyTemporal(process.argv[2], {alpha: process.argv.includes('--alpha'), loop: process.argv.includes('--loop')});
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
