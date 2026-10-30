import test from 'node:test';
import assert from 'node:assert/strict';
import { alphaBounds, unionBounds, frameDifference, countFor, ACTIONS } from './companion-animation-processing.mjs';
import { trustedSource, validateInputs } from './companion-animation-worker.mjs';

function image(rects, width=100,height=80) {
  const data=Buffer.alloc(width*height*4);
  for(const [left,top,right,bottom] of rects) for(let y=top;y<=bottom;y++) for(let x=left;x<=right;x++) {
    const p=(y*width+x)*4;data[p]=50;data[p+1]=100;data[p+2]=200;data[p+3]=255;
  }
  return data;
}
test('one fixed framing accommodates both a tall body and extended wings',()=>{
  const rest=alphaBounds(image([[40,10,60,70]]),100,80), wings=alphaBounds(image([[10,25,90,55]]),100,80);
  const result=unionBounds([rest,wings]);
  assert.deepEqual(result.crop,{left:10,top:10,width:81,height:61});
  assert.equal(result.crop.width+result.padding.left+result.padding.right,result.crop.height+result.padding.top+result.padding.bottom);
  assert.ok(result.padding.left>=4);
});
test('natural depth motion and edge contact do not need visual approval',()=>{
  assert.equal(alphaBounds(image([]),100,80),null);
  for(const rects of [[[0,0,99,79]],[[0,20,60,60]],[[45,35,46,36]]]) assert.ok(alphaBounds(image(rects),100,80));
  assert.throws(()=>unionBounds([null]),/quality_no_frames/);
});
test('normal alpha holes are preserved in measurements',()=>{
  const data=image([[20,20,40,60],[60,20,80,60]]);
  assert.equal(alphaBounds(data,100,80).opaque,21*41*2);
});
test('motion metric detects changed silhouette without changing masters',()=>{
  const a=image([[20,20,40,60]]), b=image([[25,20,45,60]]);
  assert.deepEqual(frameDifference(a,a),{alpha:0,rgb:0});
  assert.ok(frameDifference(a,b).alpha>0);
});
test('seven generated actions retain their original timing',()=>{
  assert.equal(ACTIONS.map(countFor).reduce((a,b)=>a+b,0)+24*7,919);
});
const origin='https://example.supabase.co', user='85140d6f-680e-4d3d-a36d-017dc49997e0',id='022229f5-e105-425a-8c19-d68c032d890d';
const url=`${origin}/storage/v1/object/public/companion-animation-videos/${user}/wellbeing/${id}.mp4`;
test('downloads are restricted to the exact generated object and owner',()=>{
  assert.equal(trustedSource(url,origin,user,id),url);
  for(const bad of [url.replace('https:','http:'),url.replace(origin,'https://evil.example'),url+'?token=secret',url.replace(user,'someone-else'),url.replace('/wellbeing/','/foreground/')]) {
    assert.throws(()=>trustedSource(bad,origin,user,id),/unsafe_source_url/);
  }
});
test('duplicate and incomplete categories cannot be processed',()=>{
  const job={pipeline_version:'alpha-v1',user_id:user,inputs:ACTIONS.map(category=>({category,id,video_url:url}))};
  assert.equal(validateInputs(job,origin).length,7);
  job.inputs[1].category=job.inputs[0].category;
  assert.throws(()=>validateInputs(job,origin),/invalid_source_set/);
  job.inputs.pop();assert.throws(()=>validateInputs(job,origin),/invalid_job/);
});
