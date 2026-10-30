import test from 'node:test';
import assert from 'node:assert/strict';
import { processingFailureCode } from './companion-animation-worker.mjs';
test('worker diagnostics identify native failures without exposing child process output', () => {
  assert.equal(processingFailureCode({stderr:'idle_look midpoint 169: Opaque character missing'}, 'verify_action_pack'), 'quality_character_visibility');
  assert.equal(processingFailureCode({stderr:'Foreground compute device unavailable'}, 'extract_foreground'), 'worker_extract_foreground_compute_unavailable');
  const secret = 'https://private.example/token-secret';
  assert.equal(processingFailureCode({stderr: `fatal error: No foreground in frame 55 ${secret}`}, 'extract_foreground'), 'worker_extract_foreground_no_foreground');
  assert.equal(processingFailureCode({killed:true, stderr:secret}, 'extract_foreground'), 'worker_extract_foreground_timeout');
  assert.equal(processingFailureCode({name:'AbortError', stderr:secret}, 'decode_hevc'), 'worker_decode_hevc_aborted');
  assert.equal(processingFailureCode({stderr:`No space left on device ${secret}`}, 'ffmpeg'), 'worker_ffmpeg_disk_full');
  assert.equal(processingFailureCode({stderr:secret, message:secret}, secret), 'worker_processing_failed');
});
