/* Injectable backend: immutable generation slots; COMMIT last; no backend/policy selection. */
(function(root){
'use strict';
const codec=typeof module!=='undefined'&&module.exports?require('./music-studio-portable-package'):root.MusicStudioPortablePackage;
const resources=typeof module!=='undefined'&&module.exports?require('./music-studio-package-resources'):root.MusicStudioPackageResources;
const copy=x=>JSON.parse(JSON.stringify(x));
function create({backend,validateMetadata,metadataRepository=null,limits}){
 for(const method of ['prepare','stageMetadata','stageBinary','read','commit','list','abort','cleanupIncomplete'])if(typeof backend?.[method]!=='function')throw Error('backend-interface:'+method);
 let epoch=0;
 const encode=new TextEncoder();
 async function verify(record){
  if(limits&&typeof record?.packageText==='string'){const resources=typeof module!=='undefined'&&module.exports?require('./music-studio-package-resources'):root.MusicStudioPackageResources;resources.textBytes(record.packageText,limits.maxPackageBytes)}
  if(!record?.marker||typeof record.packageText!=='string')throw Error('missing-commit-marker');
  if(record.marker.id!==record.id||record.marker.digest!==await codec.digest(encode.encode(record.packageText)))throw Error('commit-marker-mismatch');
  const parsed=await codec.read(record.packageText,{validateMetadata,limits});if(parsed.package.generationId!==record.id)throw Error('generation-identity-mismatch');
  const binaries=record.binaries;if(!Array.isArray(binaries)||binaries.length!==parsed.generation.binaries.length)throw Error('binary-closure-mismatch');
  const seen=new Set();for(const b of binaries){if(seen.has(b.key))throw Error('duplicate-binary');seen.add(b.key);const expected=parsed.generation.binaries.find(e=>e.key===b.key);if(!Array.isArray(b.bytes)||b.bytes.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('invalid-stored-bytes');if(!expected||await codec.digest(new Uint8Array(b.bytes))!==await codec.digest(expected.bytes)||b.bytes.length!==expected.bytes.length)throw Error('byte-mismatch');}
  return parsed;
 }
 async function reloadGeneration(id){const record=await backend.read(id,{limits});if(record?.id!==id)throw Error('invalid-selected-generation');return(await verify(record)).generation;}
 async function recoverLatestValidGeneration(){const rejected=[];const records=await backend.list();if(!Array.isArray(records))throw Error('invalid-generation-list');const seen=new Set();for(const r of records){if(typeof r.id!=='string'||seen.has(r.id)||!Number.isSafeInteger(r.sequence))throw Error('invalid-generation-list');seen.add(r.id)}
  for(const r of [...records].sort((a,b)=>b.sequence-a.sequence)){try{return{generation:await reloadGeneration(r.id),rejected}}catch(error){rejected.push({id:r.id,reason:error.message})}}return{generation:null,rejected};}
 async function restoreGeneration(g,control={}){
  if(limits){resources.configure(limits);resources.jsonBytes(g,limits.maxPackageBytes,control.reason);resources.jsonBytes(g.snapshot,limits.maxMetadataBytes,control.reason);if(!Array.isArray(g.binaries)||g.binaries.length>limits.maxEntryCount)throw Error('over-limit:entry-count');let observed=0;const seen=new Set();for(const b of g.binaries){if(seen.has(b.key))throw Error('duplicate-accounting');seen.add(b.key);const n=b.bytes?.byteLength??b.bytes?.length;resources.integer(n);if(n>limits.maxSingleBinaryBytes)throw Error('over-limit:single-binary');observed=resources.add(observed,n);if(observed>limits.maxObservedBytes)throw Error('over-limit:observed-bytes')}if(g.packageText!==undefined)resources.textBytes(g.packageText,limits.maxPackageBytes,control.reason)}
  const mine=++epoch,baseline=JSON.stringify(g),id=g.id;let prepared=false,committed=false;
  const check=()=>{const why=control.reason?.()||(mine!==epoch?'superseded':JSON.stringify(g)!==baseline?'stale':null);if(why)throw Error(why)};
  const call=async(fn)=>{check();const value=await fn();check();return value};
  try{
   check();if(typeof id!=='string'||!id.trim())throw Error('generation-id-required');
   if(JSON.stringify(g.settings??null)!==JSON.stringify(g.snapshot.settings??null))throw Error('settings-mismatch');
   if(new Set(g.binaries.map(b=>b.key)).size!==g.binaries.length)throw Error('duplicate-binary');
   let text;
   if(g.packageText!==undefined){
    const original=await call(()=>codec.read(g.packageText,{validateMetadata,limits}));
    if(original.package.generationId!==id||JSON.stringify(original.generation.snapshot)!==JSON.stringify(g.snapshot)||JSON.stringify(original.generation.settings)!==JSON.stringify(g.settings??null))throw Error('package-generation-mismatch');
    text=JSON.stringify(original.package);
   }else text=await call(()=>codec.write(g.snapshot,{generationId:id,validateMetadata,limits,scope:g.scope??'complete',bindings:new Map(g.binaries.map(b=>[b.key,b.bytes])),reason:()=>control.reason?.()||(mine!==epoch?'superseded':null)}));
   // prepare must reserve a fresh immutable slot; never overwrite a committed generation.
   await call(()=>backend.prepare(id));prepared=true;
   await call(()=>backend.stageMetadata(id,text));
   for(const b of g.binaries)await call(()=>backend.stageBinary(id,b.key,new Uint8Array(b.bytes)));
   const marker={id,digest:await codec.digest(encode.encode(text))};check();
   const staged=await call(()=>backend.read(id,{limits}));await call(()=>verify({...staged,marker}));
   // Backend must check reason at its atomic marker transaction; acknowledgement means durable read visibility.
   await call(()=>backend.commit(id,copy(marker),{reason:()=>control.reason?.()||(mine!==epoch?'superseded':null)}));committed=true;
   const recovered=await call(()=>reloadGeneration(id));if(JSON.stringify(recovered.snapshot)!==JSON.stringify(g.snapshot))throw Error('metadata-mismatch');
   return{ok:true,id,generation:recovered,outcome:'committed-reloaded'};
  }catch(error){if(prepared&&!committed){try{await backend.abort(id)}catch(_){} }throw error;}
 }
 return{atomicGeneration:true,metadataRepository,restoreGeneration,reloadGeneration,selectCommittedGeneration:reloadGeneration,recoverLatestValidGeneration,
  prepareGeneration:(...a)=>backend.prepare(...a),stageMetadata:(...a)=>backend.stageMetadata(...a),stageBinary:(...a)=>backend.stageBinary(...a),verifyBytes:verify,
  async commitGeneration(id,control={}){const record=await backend.read(id,{limits});const marker={id,digest:await codec.digest(encode.encode(record.packageText))};await verify({...record,marker});if(control.reason?.())throw Error(control.reason());await backend.commit(id,marker,{reason:()=>control.reason?.()||null});return reloadGeneration(id)},abortGeneration:(...a)=>backend.abort(...a),cleanupIncompleteGeneration:(...a)=>backend.cleanupIncomplete(...a)};
}
const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MusicStudioGenerationAdapter=api;
})(typeof window!=='undefined'?window:globalThis);
