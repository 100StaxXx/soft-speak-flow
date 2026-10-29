import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFrame, inspectFrames } from './verify-companion-temporal.mjs';
const frame = (value, alpha=255) => summarizeFrame(Buffer.from(Array.from({length:64}, () => [value,value,value,alpha]).flat()));
test('gentle motion and slow fades are accepted', () => {
  assert.equal(inspectFrames([40,45,50,55,60].map(v=>frame(v))).passed,true);
});
test('a single white flash is flagged even without a black frame', () => {
  assert.ok(inspectFrames([40,40,240,40,40].map(v=>frame(v))).issues.some(i=>i.reason==='isolated_flash'));
});
test('black frames and sudden scene cuts cannot pass', () => {
  assert.ok(inspectFrames([frame(50),frame(0),frame(60)]).issues.some(i=>i.reason==='black_frame'));
  assert.ok(inspectFrames([frame(40),frame(220),frame(220)]).issues.some(i=>i.reason==='abrupt_scene_change'));
});
test('transparent subject dropout is caught', () => {
  assert.ok(inspectFrames([frame(80),frame(80,0),frame(80)],{alpha:true}).issues.some(i=>i.reason==='foreground_dropout'));
});
test('a smooth clip with mismatched endpoints fails the loop check', () => {
  assert.equal(inspectFrames([40,50,60,70].map(v=>frame(v)),{loop:true}).passed,false);
  assert.equal(inspectFrames([40,45,40].map(v=>frame(v)),{loop:true}).passed,true);
});

test('an opaque frame in an alpha movie is rejected', () => {
  assert.ok(inspectFrames([frame(80),frame(90),frame(80)],{alpha:true}).issues.some(i=>i.reason==='opaque_background'));
});
