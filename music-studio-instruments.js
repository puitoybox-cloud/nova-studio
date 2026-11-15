/* Project-local multisample instruments. No downloads, network, or model substitution. */
(function(root){
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  function number(value,min,max,fallback,integer=false){const v=value===undefined?fallback:value;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||integer&&!Number.isInteger(v))throw Error('invalid-instrument-number');return v}
  function label(value,fallback){const text=value===undefined?fallback:value;if(typeof text!=='string'||!text.trim()||text.length>80)throw Error('invalid-instrument-name');return text.trim()}
  function normalize(binding){
    if(!binding||typeof binding!=='object'||Array.isArray(binding))throw Error('invalid-instrument-binding');
    if(binding.version===undefined){if(typeof binding.assetId!=='string'||!binding.assetId)throw Error('invalid-instrument-asset');return{assetId:binding.assetId,rootPitch:number(binding.rootPitch,0,127,undefined,true)}}
    if(binding.version!==2||!Array.isArray(binding.regions)||!binding.regions.length||binding.regions.length>32)throw Error('invalid-instrument-regions');
    const ids=new Set(),regions=binding.regions.map((input,index)=>{
      if(!input||typeof input!=='object'||typeof input.assetId!=='string'||!input.assetId)throw Error('invalid-instrument-region');
      const r={id:label(input.id,`zone-${index+1}`),assetId:input.assetId,rootPitch:number(input.rootPitch,0,127,60,true),keyLow:number(input.keyLow,0,127,0,true),keyHigh:number(input.keyHigh,0,127,127,true),velocityLow:number(input.velocityLow,1,127,1,true),velocityHigh:number(input.velocityHigh,1,127,127,true),gainDb:number(input.gainDb,-24,12,0),tuneCents:number(input.tuneCents,-100,100,0),startSeconds:number(input.startSeconds,0,10,0),endSeconds:input.endSeconds===undefined||input.endSeconds===null?null:number(input.endSeconds,0,10,undefined),attackMs:number(input.attackMs,0,1000,3),releaseMs:number(input.releaseMs,1,2000,15),oneShot:input.oneShot===true};
      if(ids.has(r.id)||r.keyLow>r.keyHigh||r.velocityLow>r.velocityHigh||r.endSeconds!==null&&r.endSeconds<=r.startSeconds||input.oneShot!==undefined&&typeof input.oneShot!=='boolean')throw Error('invalid-instrument-region-range');ids.add(r.id);return r;
    });return{version:2,name:label(binding.name,'Custom（カスタム）'),regions};
  }
  function expand(binding){const b=normalize(binding);return b.version===2?b:{version:2,name:'Custom（カスタム）',regions:[{id:'zone-1',assetId:b.assetId,rootPitch:b.rootPitch,keyLow:0,keyHigh:127,velocityLow:1,velocityHigh:127,gainDb:0,tuneCents:0,startSeconds:0,endSeconds:null,attackMs:3,releaseMs:15,oneShot:false}]}}
  function select(binding,pitch,velocity){const b=expand(binding);return b.regions.filter(r=>pitch>=r.keyLow&&pitch<=r.keyHigh&&velocity>=r.velocityLow&&velocity<=r.velocityHigh).sort((a,b)=>Math.abs(pitch-a.rootPitch)-Math.abs(pitch-b.rootPitch))[0]||null}
  function fitNotes(binding,notes){const patch=expand(binding);return notes.map(note=>{let best=null;for(const region of patch.regions){for(let pitch=((note.pitch%12)+12)%12;pitch<=127;pitch+=12){if(pitch<region.keyLow||pitch>region.keyHigh)continue;const velocity=Math.max(region.velocityLow,Math.min(region.velocityHigh,note.velocity)),cost=Math.abs(pitch-note.pitch)*128+Math.abs(velocity-note.velocity);if(!best||cost<best.cost)best={pitch,velocity,cost}}}if(!best)throw Error('instrument-has-no-compatible-octave');return{...copy(note),pitch:best.pitch,velocity:best.velocity}})}
  // Partition keys by root, independently for each velocity layer. No source PCM changes.
  function autoMap(binding){
    const patch=expand(binding),groups=new Map();
    for(const r of patch.regions){const key=`${r.velocityLow}:${r.velocityHigh}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
    for(const regions of groups.values()){
      const roots=[...new Set(regions.map(r=>r.rootPitch))].sort((a,b)=>a-b);
      if(roots.length!==regions.length)throw Error('auto-map-duplicate-root-in-layer');
      for(const r of regions){const i=roots.indexOf(r.rootPitch);r.keyLow=i?Math.floor((roots[i-1]+r.rootPitch)/2)+1:0;r.keyHigh=i===roots.length-1?127:Math.floor((r.rootPitch+roots[i+1])/2)}
    }
    return normalize(patch);
  }
  function coverage(binding,notes,availableIds){
    const patch=expand(binding),available=new Set(availableIds),result={total:notes.length,mapped:0,unmapped:0,missing:0,issues:[],omitted:0};
    for(const note of notes){let region=null;for(const r of patch.regions)if(note.pitch>=r.keyLow&&note.pitch<=r.keyHigh&&note.velocity>=r.velocityLow&&note.velocity<=r.velocityHigh&&(!region||Math.abs(note.pitch-r.rootPitch)<Math.abs(note.pitch-region.rootPitch)))region=r;const status=!region?'unmapped':!available.has(region.assetId)?'missing':'mapped';result[status]++;if(status!=='mapped'){if(result.issues.length<32)result.issues.push({noteId:String(note.id),pitch:note.pitch,velocity:note.velocity,status,assetId:region?.assetId||null});else result.omitted++}}
    return result;
  }
  function editPreset(value,id,operation,name,newId){
    const next=library(value),preset=next.patches.find(p=>p.id===id);if(!preset)throw Error('instrument-preset-not-found');
    const title=label(name);
    if(operation==='rename'){preset.name=title;preset.instrument={...expand(preset.instrument),name:title}}
    else if(operation==='duplicate')next.patches.push({id:newId,name:title,instrument:{...expand(preset.instrument),name:title}});
    else throw Error('invalid-preset-operation');
    return library(next);
  }
  function library(value){if(value===undefined)return{version:1,patches:[]};if(value?.version!==1||!Array.isArray(value.patches)||value.patches.length>32)throw Error('invalid-instrument-library');const ids=new Set();return{version:1,patches:value.patches.map(p=>{if(typeof p?.id!=='string'||!p.id||p.id.length>240||ids.has(p.id))throw Error('invalid-instrument-preset');ids.add(p.id);return{id:p.id,name:label(p.name),instrument:normalize(p.instrument)}})}}
  function inventory(project){const assets=project?.pcmMix?.assets||[],uses=new Map();function add(binding,owner){for(const r of expand(binding).regions){if(!uses.has(r.assetId))uses.set(r.assetId,[]);const list=uses.get(r.assetId);if(!list.includes(owner))list.push(owner)}}for(const track of project?.midiData?.tracks||[])if(track.sampleInstrument)add(track.sampleInstrument,`Track: ${track.name||track.id}`);for(const p of library(project?.instrumentLibrary).patches)add(p.instrument,`Preset: ${p.name}`);return[...new Set([...assets.map(a=>a.id),...uses.keys()])].map(id=>{const a=assets.find(a=>a.id===id);return{id,name:a?.name||id,missing:!a,seconds:a?a.original.channels[0].length/a.original.sampleRate:null,channels:a?.original.channels.length||0,owners:uses.get(id)||[]}})}
  root.MusicStudioInstruments={normalize,expand,select,fitNotes,autoMap,coverage,editPreset,library,inventory,copy};
})(typeof window!=='undefined'?window:globalThis);
