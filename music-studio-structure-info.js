/* Read-only descriptors from explicit MIDI keys and markers; no musical inference. */
(function(root){
  'use strict';
  const MAX_TICK=0x0fffffff;
  const MAJOR=['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#'];
  const MINOR=['Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#','G#','D#','A#'];
  function tick(value){if(!Number.isSafeInteger(value)||value<0||value>MAX_TICK)throw new RangeError('invalid-metadata-tick');return value}
  function keySignatureInfo(item){
    if(!Number.isInteger(item?.sharps)||item.sharps < -7||item.sharps>7||typeof item.minor!=='boolean')throw new RangeError('invalid-key-signature');
    return{tonic:(item.minor?MINOR:MAJOR)[item.sharps+7],scaleFamily:item.minor?'Minor':'Major',scaleVariant:null,sharps:item.sharps,minor:item.minor,source:'midi-key-signature'};
  }
  function keyAtTick(data={},atTick=0){
    tick(atTick);
    if(data.keySignatureMap!=null&&!Array.isArray(data.keySignatureMap))throw new TypeError('invalid-key-map');
    const entries=(data.keySignatureMap??(data.keySignature?[data.keySignature]:[])).map(item=>({tick:tick(item?.tick),...keySignatureInfo(item)})).sort((a,b)=>a.tick-b.tick);
    const before=entries.filter(item=>item.tick<=atTick),latest=before[before.length-1];
    if(!latest)return{status:'unknown',reason:'no-explicit-key-at-tick',key:null};
    const candidates=before.filter(item=>item.tick===latest.tick),unique=[...new Map(candidates.map(item=>[item.sharps+':'+item.minor,item])).values()];
    if(unique.length>1)return{status:'conflict',tick:latest.tick,candidates:unique,key:null};
    return{status:'known',tick:latest.tick,key:{...unique[0]}};
  }
  function sectionCandidates(data={}){
    if(data.markers!=null&&!Array.isArray(data.markers))throw new TypeError('invalid-markers');
    const totalTick=data.totalTick==null?null:tick(data.totalTick);
    const markers=(data.markers??[]).map(item=>{const start=tick(item?.tick);if(typeof item.text!=='string')throw new TypeError('invalid-marker-text');if(totalTick!==null&&start>totalTick)throw new RangeError('marker-after-song-end');return{tick:start,text:item.text,...(item.track==null?{}:{track:item.track})}}).sort((a,b)=>a.tick-b.tick);
    const groups=[];
    for(const marker of markers){let group=groups[groups.length-1];if(group?.startTick!==marker.tick){group={startTick:marker.tick,labels:[],markers:[]};groups.push(group)}group.labels.push(marker.text);group.markers.push({...marker})}
    const terminalMarkers=groups.filter(group=>group.startTick===totalTick).flatMap(group=>group.markers),candidates=groups.filter(group=>group.startTick!==totalTick).map((group,index)=>{const next=groups[index+1];return{...group,endTick:next?.startTick??totalTick,source:'midi-markers',adopted:false}});
    return{status:markers.length?'candidates':'unknown',candidates,terminalMarkers,unlabelledPrefix:markers.length&&markers[0].tick>0?{startTick:0,endTick:markers[0].tick}:null};
  }
  root.MusicStudioStructureInfo=Object.freeze({keySignatureInfo,keyAtTick,sectionCandidates});
})(typeof window!=='undefined'?window:globalThis);
