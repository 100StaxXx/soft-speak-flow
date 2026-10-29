import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

export async function shrinkOpaqueMask(mask, width, height, radius) {
  // libvips morphology treats BLACK as the foreground. Its "dilate" is the
  // minimum filter needed to shrink an opaque-WHITE alpha mask. Test polarity.
  return sharp(mask, { raw: { width, height, channels: 1 } }).dilate(radius).toColourspace('b-w').raw().toBuffer();
}

/** Fill only small, enclosed matte pinholes. Outer negative space stays untouched.
 * Asset-specific limits must be visually approved before reuse for another pet. */
export function fillMattePinholes(rgba, width, height, maxArea = 1600) {
  const seen = new Uint8Array(width * height);
  const holes = [];
  for (let p = 0; p < seen.length; p++) {
    if (seen[p] || rgba[p * 4 + 3] >= 128) continue;
    const region = [p]; seen[p] = 1; let touchesBorder = false;
    for (let i = 0; i < region.length; i++) {
      const q = region[i], x = q % width, y = Math.floor(q / width);
      if (!x || !y || x === width - 1 || y === height - 1) touchesBorder = true;
      for (const n of [x ? q - 1 : -1, x + 1 < width ? q + 1 : -1, y ? q - width : -1, y + 1 < height ? q + width : -1]) {
        if (n < 0 || seen[n] || rgba[n * 4 + 3] >= 128) continue;
        seen[n] = 1; region.push(n);
      }
    }
    if (!touchesBorder && region.length <= maxArea) {
      for (const q of region) rgba[q * 4 + 3] = 255;
      holes.push(...region);
    }
  }
  return holes;
}

/** Propagate uncontaminated interior colors into the narrow edge band instead
 * of leaving snow-colored RGB under the partially transparent feather pixels. */
export function extendInteriorColor(rgba, interior, width, height, repaired = []) {
  const count = width * height, owner = new Int32Array(count).fill(-1);
  const queue = new Int32Array(count); let head = 0, tail = 0;
  const repairedSet = new Set(repaired);
  for (let p = 0; p < count; p++) if (interior[p] >= 250 && !repairedSet.has(p)) {
    owner[p] = p; queue[tail++] = p;
  }
  if (!tail) throw new Error('No opaque interior for edge correction');
  // Nearest interior donor is stable in source coordinates; no per-frame crop.
  while (head < tail) {
    const p = queue[head++], x = p % width, y = Math.floor(p / width);
    for (const n of [x ? p - 1 : -1, x + 1 < width ? p + 1 : -1, y ? p - width : -1, y + 1 < height ? p + width : -1]) {
      if (n < 0 || owner[n] >= 0) continue;
      owner[n] = owner[p]; queue[tail++] = n;
    }
  }
  for (let p = 0; p < count; p++) if (interior[p] < 250 || repairedSet.has(p)) {
    const source = owner[p] * 4;
    for (let c = 0; c < 3; c++) rgba[p * 4 + c] = rgba[source + c];
  }
}

export function blendRestFrame(frame, anchor, amount) {
  // Premultiplied blend avoids white/dark fringes. Only permitted during the
  // already-settled tail of this approved clip, never over the actual action.
  for (let p = 0; p < frame.length; p += 4) {
    const a = frame[p + 3] / 255, b = anchor[p + 3] / 255;
    const out = a * (1 - amount) + b * amount;
    for (let c = 0; c < 3; c++) frame[p + c] = out ? Math.round((frame[p + c] * a * (1 - amount) + anchor[p + c] * b * amount) / out) : 0;
    frame[p + 3] = Math.round(out * 255);
  }
}

async function main(input, output, anchorPath) {
  if (!input || !output) throw new Error('Usage: finish-companion-foreground masked-frames empty-output-directory [approved-anchor.png]');
  await fs.mkdir(output, { recursive: true });
  if ((await fs.readdir(output)).length) throw new Error('Output must be empty; existing frames are never overwritten');
  const names = (await fs.readdir(input)).filter(n => /^\d{4}\.png$/.test(n)).sort();
  if (![97, 121].includes(names.length)) throw new Error('Frostwing finishing expects 97 or 121 source frames');
  let anchor = anchorPath ? await sharp(anchorPath).ensureAlpha().raw().toBuffer() : null;
  if (anchor && anchor.length !== 640 * 640 * 4) throw new Error('Expected 640-square approved anchor');
  const repairs = []; const last = names.length - 1;
  for (const [index, name] of names.entries()) {
    const { data, info } = await sharp(path.join(input, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 1172 || info.height !== 784) throw new Error('Unexpected source geometry');
    const holes = fillMattePinholes(data, info.width, info.height);
    repairs.push(holes.length);
    const raw = { width: info.width, height: info.height, channels: 4 };
    const mask = await sharp(data, { raw }).extractChannel(3).raw().toBuffer();
    const maskRaw = { width: info.width, height: info.height, channels: 1 };
    const interior = await shrinkOpaqueMask(mask, info.width, info.height, 3);
    extendInteriorColor(data, interior, info.width, info.height, holes);
    const shrunken = await shrinkOpaqueMask(mask, info.width, info.height, 1);
    const alpha = await sharp(shrunken, { raw: maskRaw }).blur(0.35).toColourspace('b-w').raw().toBuffer();
    for (let p = 0; p < alpha.length; p++) data[p * 4 + 3] = alpha[p];
    // Separate operations because sharp applies resize before extend regardless
    // of chaining order. Do not silently crop bytes from an oversized raw image.
    const square = await sharp(data, { raw }).extract({ left: 114, top: 0, width: 944, height: 784 })
      .extend({ top: 80, bottom: 80, left: 0, right: 0, background: '#00000000' }).png().toBuffer();
    const rgba = await sharp(square).resize(640, 640).raw().toBuffer();
    if (rgba.length !== 640 * 640 * 4) throw new Error('Finished geometry is not 640-square RGBA');
    if (!anchor) anchor = Buffer.from(rgba);
    // All seven source videos use the same supplied neutral pose. Use the
    // approved cleaned anchor for their shared endpoint, never change framing.
    if (!index) rgba.set(anchor);
    else if (anchorPath && index < 4) blendRestFrame(rgba, anchor, 1 - index / 4);
    // The original is already back at rest here; the last 0.5 sec removes tiny
    // generated endpoint drift, ending on the exact approved first frame.
    if (index === last) rgba.set(anchor);
    else if (index >= last - 11) {
      const t = (index - (last - 11)) / 11;
      blendRestFrame(rgba, anchor, t * t * (3 - 2 * t));
    }
    await sharp(rgba, { raw: { width: 640, height: 640, channels: 4 } }).png().toFile(path.join(output, name));
    if (index % 24 === 0) console.log(`Finished frame ${index}`);
  }
  console.log(JSON.stringify({ frames: names.length, repairedMaskPixelsPerFrame: repairs }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv[2], process.argv[3], process.argv[4]);
