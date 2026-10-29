import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [masters, decoded, poster] = process.argv.slice(2);
if (!masters || !decoded || !poster) throw new Error('Usage: verify-companion-action-pack packed-frames decoded-frames poster.webp');
const manifest = JSON.parse(await fs.readFile(path.join(masters, 'manifest.json'), 'utf8'));
const file = (dir, n) => path.join(dir, `${String(n).padStart(4, '0')}.png`);
const read = async p => {
  const { data, info } = await sharp(p).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 640); assert.equal(info.height, 640); return data;
};
const masterAnchor = await read(file(masters, 0));
const decodedAnchor = await read(file(decoded, 0));
const image = await read(poster);
for (let p = 0; p < image.length; p += 4) {
  assert.equal(image[p + 3], decodedAnchor[p + 3]);
  if (image[p + 3]) for (let c = 0; c < 3; c++) assert.equal(image[p + c], decodedAnchor[p + c]);
}
function compare(a, b) {
  const sums = [0, 0, 0]; let pixels = 0, alpha = 0;
  for (let p = 0; p < a.length; p += 4) {
    alpha += Math.abs(a[p + 3] - b[p + 3]);
    if (a[p + 3] > 250 && b[p + 3] > 250) {
      pixels++; for (let c = 0; c < 3; c++) sums[c] += Math.abs(a[p + c] - b[p + c]);
    }
  }
  assert.ok(pixels > 20_000, 'Opaque character missing');
  return { rgb: sums.map(s => s / pixels), alpha: alpha / (a.length / 4) };
}
const results = [];
for (const segment of manifest.segments) {
  for (const n of [segment.startFrame, segment.endFrame, segment.guardEndFrame]) {
    assert.ok(masterAnchor.equals(await read(file(masters, n))), `${segment.id}: master pose changed`);
    const frame = await read(file(decoded, n));
    const match = compare(decodedAnchor, frame);
    assert.ok(match.rgb.every(n => n < 3), `${segment.id}: seam color mismatch ${JSON.stringify(match)}`);
    assert.ok(match.alpha < 1, `${segment.id}: alpha drift`);
    for (const p of [20 * 640 + 20, 620 * 640 + 620]) assert.equal(frame[p * 4 + 3], 0);
    results.push({ action: segment.id, frame: n, ...match });
  }
  const mid = Math.floor((segment.startFrame + segment.endFrame) / 2);
  const frame = await read(file(decoded, mid));
  const match = compare(await read(file(masters, mid)), frame);
  assert.ok(match.rgb.every(n => n < 4), `${segment.id}: decoded action color mismatch`);
  assert.ok(match.alpha < 1, `${segment.id}: decoded action alpha mismatch`);
}
console.log(JSON.stringify({ passed: true, actionCount: manifest.segments.length, frameCount: manifest.frameCount,
  maxSeamRGBError: Math.max(...results.flatMap(r => r.rgb)), maxSeamAlphaError: Math.max(...results.map(r => r.alpha)), results }, null, 2));
