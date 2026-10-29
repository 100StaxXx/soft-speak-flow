import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';

// Pack approved frame sequences into one alpha-video timeline. One second of
// neutral frames after every action protects against delayed timeupdate events.
// No generated motion is retimed, warped or reversed. Use an empty output dir.
const [recipePath, output] = process.argv.slice(2);
if (!recipePath || !output) throw new Error('Usage: pack-companion-actions recipe.json empty-output-directory');
const recipe = JSON.parse(await fs.readFile(recipePath, 'utf8'));
assert.equal(recipe.fps, 24);
await fs.mkdir(output, { recursive: true });
assert.equal((await fs.readdir(output)).length, 0, 'Output must be empty');
const anchor = await sharp(recipe.anchor).ensureAlpha().raw().toBuffer();
const ids = new Set(); const segments = []; let cursor = 0;
for (const action of recipe.actions) {
  assert.ok(!ids.has(action.id), 'Duplicate action'); ids.add(action.id);
  const names = (await fs.readdir(action.frames)).filter(n => /^\d{4}\.png$/.test(n)).sort();
  assert.ok([97, 121].includes(names.length), 'Unexpected source frame count');
  for (const name of [names[0], names.at(-1)]) {
    const data = await sharp(path.join(action.frames, name)).ensureAlpha().raw().toBuffer();
    assert.ok(data.equals(anchor), `${action.id}: neutral pose does not match approved anchor`);
  }
  const startFrame = cursor, endFrame = cursor + names.length - 1;
  for (const name of names) {
    await fs.link(path.join(action.frames, name), path.join(output, `${String(cursor++).padStart(4, '0')}.png`));
  }
  for (let n = 0; n < 24; n++) await fs.link(recipe.anchor, path.join(output, `${String(cursor++).padStart(4, '0')}.png`));
  segments.push({ id: action.id, startFrame, endFrame, guardEndFrame: cursor - 1 });
}
const manifest = { fps: 24, frameCount: cursor, duration: cursor / 24, segments };
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
console.log(JSON.stringify(manifest, null, 2));
