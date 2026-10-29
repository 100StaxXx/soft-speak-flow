import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { shrinkOpaqueMask, extendInteriorColor, blendRestFrame } from './finish-companion-foreground.mjs';

export const ACTIONS = ['idle_greet', 'idle_look', 'body', 'idle_breathe', 'mind', 'idle_rest', 'soul'];
export const countFor = id => ['body', 'mind', 'soul'].includes(id) ? 121 : 97;

export function alphaBounds(data, width, height) {
  let left = width, top = height, right = -1, bottom = -1, opaque = 0, border = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] < 128) continue;
    opaque++; left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
    if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) border++;
  }
  if (opaque < width * height * 0.01 || opaque > width * height * 0.85) throw new Error('quality_mask_coverage');
  if (border > 4) throw new Error('quality_clipped_subject');
  return { left, top, right, bottom, opaque };
}

export function unionBounds(bounds) {
  if (!bounds.length) throw new Error('quality_no_frames');
  const left = Math.min(...bounds.map(b => b.left)), top = Math.min(...bounds.map(b => b.top));
  const right = Math.max(...bounds.map(b => b.right)), bottom = Math.max(...bounds.map(b => b.bottom));
  const width = right - left + 1, height = bottom - top + 1;
  const side = Math.ceil(Math.max(width, height) * 1.12);
  const x = Math.floor((side - width) / 2), y = Math.floor((side - height) / 2);
  return { crop: { left, top, width, height }, padding: { left: x, top: y, right: side - width - x, bottom: side - height - y } };
}

export function frameDifference(a, b) {
  let alpha = 0, rgb = 0, visible = 0;
  for (let p = 0; p < a.length; p += 4) {
    alpha += Math.abs(a[p + 3] - b[p + 3]);
    if (a[p + 3] > 250 && b[p + 3] > 250) {
      visible++;
      for (let c = 0; c < 3; c++) rgb += Math.abs(a[p + c] - b[p + c]);
    }
  }
  return { alpha: alpha / (a.length / 4), rgb: visible ? rgb / (visible * 3) : 255 };
}

/** Conservative generalized finish. One transform for the entire seven-action
 * set; never re-center/re-size individual frames, warp anatomy, or fill natural holes. */
export async function finishAnimationSet(actions, output) {
  if (JSON.stringify(actions.map(a => a.id)) !== JSON.stringify(ACTIONS)) throw new Error('quality_incomplete_actions');
  await fs.mkdir(output, { recursive: true });
  if ((await fs.readdir(output)).length) throw new Error('Output must be empty');
  const bounds = []; let geometry;
  for (const action of actions) {
    action.names = (await fs.readdir(action.frames)).filter(n => /^\d{4}\.png$/.test(n)).sort();
    if (action.names.length !== countFor(action.id) || action.names.some((name, n) => name !== `${String(n).padStart(4, '0')}.png`)) throw new Error('quality_frame_count');
    for (const name of action.names) {
      const { data, info } = await sharp(path.join(action.frames, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (info.width > 2048 || info.height > 2048) throw new Error('quality_source_too_large');
      const size = `${info.width}x${info.height}`;
      if (geometry && geometry !== size) throw new Error('quality_geometry_changed');
      geometry = size;
      bounds.push(alphaBounds(data, info.width, info.height));
    }
  }
  const framing = unionBounds(bounds);
  let anchor;
  const report = { framing, sourceGeometry: geometry, actions: [] };
  const outputs = [];
  for (const action of actions) {
    const dir = path.join(output, action.id); await fs.mkdir(dir);
    const metrics = { id: action.id, maxMotion: 0, start: null, end: null };
    for (const [index, name] of action.names.entries()) {
      const { data, info } = await sharp(path.join(action.frames, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const raw = { width: info.width, height: info.height, channels: 4 };
      const mask = await sharp(data, { raw }).extractChannel(3).raw().toBuffer();
      const interior = await shrinkOpaqueMask(mask, info.width, info.height, 3);
      extendInteriorColor(data, interior, info.width, info.height);
      const alpha = await shrinkOpaqueMask(mask, info.width, info.height, 1);
      for (let p = 0; p < alpha.length; p++) data[p * 4 + 3] = alpha[p];
      const square = await sharp(data, { raw }).extract(framing.crop)
        .extend({ ...framing.padding, background: '#00000000' }).png().toBuffer();
      const rgba = await sharp(square).resize(640, 640).toColourspace('srgb').ensureAlpha().raw().toBuffer();
      if (!anchor) anchor = Buffer.from(rgba);
      const difference = frameDifference(anchor, rgba);
      if (index > 3 && index < action.names.length - 12) metrics.maxMotion = Math.max(metrics.maxMotion, difference.alpha + difference.rgb);
      if (index === 0 || index === action.names.length - 1) {
        metrics[index === 0 ? 'start' : 'end'] = difference;
        // Reject large pose/color drift rather than hiding it with a long dissolve.
        if (difference.alpha > 15 || difference.rgb > 25) throw new Error('quality_endpoint_drift');
      }
      if (!index || index === action.names.length - 1) rgba.set(anchor);
      else if (index < 4) blendRestFrame(rgba, anchor, 1 - index / 4);
      else if (index >= action.names.length - 12) {
        const t = (index - (action.names.length - 12)) / 11;
        blendRestFrame(rgba, anchor, t * t * (3 - 2 * t));
      }
      await sharp(rgba, { raw: { width: 640, height: 640, channels: 4 } }).png().toFile(path.join(dir, name));
    }
    if (metrics.maxMotion < 0.3) throw new Error('quality_no_action_motion');
    report.actions.push(metrics); outputs.push({ id: action.id, frames: dir });
  }
  const anchorPath = path.join(output, 'anchor.png');
  await sharp(anchor, { raw: { width: 640, height: 640, channels: 4 } }).png().toFile(anchorPath);
  return { recipe: { fps: 24, anchor: anchorPath, actions: outputs }, report };
}
