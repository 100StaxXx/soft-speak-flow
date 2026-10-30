import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareActionFrame } from './companion-action-frame-quality.mjs';
const make = (opaque) => {
  const data = Buffer.alloc(640 * 640 * 4);
  for (let p = 0; p < opaque; p++) data.set([180, 100, 40, 255], p * 4);
  return data;
};
test('preserves faithful motion into the distance instead of imposing a constant character size', () => {
  const source = make(11346);
  const result = compareActionFrame(source, Buffer.from(source), 'distant pose');
  assert.deepEqual(result.rgb, [0, 0, 0]);
  assert.equal(result.alpha, 0);
});
test('rejects a blank decode against a visible source', () => {
  assert.throws(() => compareActionFrame(make(11346), make(0), 'missing'), /Opaque character missing/);
});
test('rejects a blank source even if the decode is equally blank', () => {
  assert.throws(() => compareActionFrame(make(0), make(0), 'blank'), /Opaque character missing/);
});
test('rejects lost body coverage relative to the matching source frame', () => {
  assert.throws(() => compareActionFrame(make(100000), make(80000), 'missing body'), /Opaque character missing/);
});
test('still measures color and alpha corruption', () => {
  const source = make(30000); const output = Buffer.from(source);
  for (let p = 0; p < 30000; p++) output[p * 4] += 10;
  output[output.length - 1] = 255;
  const result = compareActionFrame(source, output, 'corruption');
  assert.equal(result.rgb[0], 10);
  assert.ok(result.alpha > 0);
});
