/* Stereo loopback file analysis. L is a simultaneous direct reference, R is
   the returned signal. This does not estimate browser or microphone latency. */
(function(root){
 'use strict';
 async function analyze(pcm,{guard=()=>{},yieldTask=()=>new Promise(r=>setTimeout(r,0))}={}){
  const rate=pcm?.sampleRate,channels=pcm?.channels;
  if(!Number.isInteger(rate)||rate<8000||rate>192000||!Array.isArray(channels)||channels.length!==2)throw Error('loopback-stereo-required');
  const [left,right]=channels,n=left.length;
  if(n!==right.length||n<rate*.15||n>rate*10)throw Error('loopback-duration-invalid');
  let peak=0,anchor=0;
  for(let i=0;i<n;i++){
   if(!Number.isFinite(left[i])||!Number.isFinite(right[i])||Math.abs(left[i])>=.9999||Math.abs(right[i])>=.9999)throw Error('loopback-nonfinite-or-clipped');
   if(Math.abs(left[i])>peak){peak=Math.abs(left[i]);anchor=i}
  }
  if(peak<.01)throw Error('loopback-reference-silent');
  const step=Math.max(1,Math.floor(rate/2000)),window=Math.round(rate*.064),start=Math.max(0,Math.min(n-window,anchor-Math.floor(window/2))),maxLag=Math.round(rate*2);
  const smooth=source=>{const out=new Float64Array(n);let sum=0;for(let i=0;i<n;i++){sum+=source[i];if(i>=step)sum-=source[i-step];out[i]=sum/Math.min(i+1,step)}return out},lowLeft=smooth(left),lowRight=smooth(right);
  function correlation(lag,stride){
   if(start+lag<0||start+window+lag>n)return 0;
   let a=0,b=0,aa=0,bb=0,ab=0,count=0;
   for(let k=0;k<window;k+=stride){const x=(stride===1?left:lowLeft)[start+k],y=(stride===1?right:lowRight)[start+k+lag];a+=x;b+=y;aa+=x*x;bb+=y*y;ab+=x*y;count++}
   const energyA=aa-a*a/count,energyB=bb-b*b/count;
   if(energyA<count*1e-8||energyB<count*1e-8)return 0;
   return (ab-a*b/count)/Math.sqrt(energyA*energyB);
  }
  const scores=[];let best={score:0,lag:0,signed:0};
  for(let lag=Math.max(-maxLag,-start);lag<=Math.min(maxLag,n-start-window);lag+=step){
   const signed=correlation(lag,step),score=Math.abs(signed);scores.push({lag,score});if(score>best.score)best={lag,score,signed};
   if(scores.length%128===0){await yieldTask();guard()}
  }
  const coarse=best.lag,coarseScore=best.score;best={score:0,lag:coarse,signed:0};
  for(let lag=coarse-step;lag<=coarse+step;lag++){const signed=correlation(lag,1),score=Math.abs(signed);if(score>best.score)best={lag,score,signed}}
  guard();
  if(best.score<.85)throw Error('loopback-low-confidence');
  if(scores.some(s=>Math.abs(s.lag-best.lag)>rate*.02&&s.score>=coarseScore*.98))throw Error('loopback-ambiguous-signal');
  if(Math.abs(best.lag)>=maxLag-step)throw Error('loopback-delay-out-of-range');
  return{format:'nova-stereo-loopback-measurement-v1',latencyMs:Math.round(best.lag/rate*1e6)/1000,lagFrames:best.lag,sampleRate:rate,frames:n,correlation:best.score,inverted:best.signed<0};
 }
 const api={analyze};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.MusicStudioLoopback=api;
})(typeof window!=='undefined'?window:globalThis);
