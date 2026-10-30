import assert from 'node:assert/strict';

export function compareActionFrame(a, b, label) {
  assert.equal(a.length, b.length, `${label}: frame geometry changed`);
  assert.equal(a.length % 4, 0, `${label}: expected RGBA`);
  const sums = [0, 0, 0]; let pixels = 0, alpha = 0, referenceOpaque = 0;
  for (let p = 0; p < a.length; p += 4) {
    alpha += Math.abs(a[p + 3] - b[p + 3]);
    if (a[p + 3] > 250) referenceOpaque++;
    if (a[p + 3] > 250 && b[p + 3] > 250) {
      pixels++; for (let c = 0; c < 3; c++) sums[c] += Math.abs(a[p + c] - b[p + c]);
    }
  }
  // This verifies encoding fidelity, not how close the character stands to the
  // camera. Compare with the SAME source frame; normal depth motion can occupy
  // far fewer pixels than the neutral pose. Source coverage/clipping and visual
  // review remain separate gates in the processing/publishing pipeline.
  assert.ok(referenceOpaque > 0 && pixels / referenceOpaque >= 0.95,
    `${label}: Opaque character missing (${pixels}/${referenceOpaque} source pixels retained)`);
  return { rgb: sums.map(s => s / pixels), alpha: alpha / (a.length / 4) };
}
