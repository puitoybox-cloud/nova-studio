/* Policy-neutral offline boundary. No fetch, permission prompt, persistence or schema choice. */
(function(root){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x)),signature=x=>JSON.stringify(x);
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const statuses=new Set(['available','missing','external','permission-unavailable','reselection-required','unsupported','ambiguous','unverified']);
 const proofs=new WeakMap();
 function inventory(backup,{projects=true}={}){
  const dependencies=[],issues=[];
  if(backup?.format!=='music-studio-backup'||backup?.version!==1||!Array.isArray(backup?.projects))issues.push({path:'$',status:'unsupported',reason:'unsupported-backup'});
  for(const [pi,p] of (projects&&Array.isArray(backup?.projects)?backup.projects:[]).entries()){
   if(!object(p)){issues.push({path:`projects[${pi}]`,status:'unsupported',reason:'malformed-project'});continue}
   if(p.format!=='music-studio-project'||p.schemaVersion!=='1.0')issues.push({path:`projects[${pi}]`,status:'unsupported',reason:'unsupported-project'});
   for(const field of ['audioAssets','midiAssets','fileReferences'])if(p[field]!==undefined&&!Array.isArray(p[field]))issues.push({path:`projects[${pi}].${field}`,status:'unsupported',reason:'malformed-collection'});
   // These names exist only in future verification contracts, not the production Project schema.
   for(const field of ['takes','versions','checkpoints'])if(Object.hasOwn(p,field))issues.push({path:`projects[${pi}].${field}`,status:'unsupported',reason:'unimplemented-production-contract'});
   for(const source of [p.importSource,p.midiData?.importSource])if(source!==undefined&&(!object(source)||!['standard-midi-file','external-song-midi'].includes(source.kind)))issues.push({path:`projects[${pi}].importSource`,status:'unsupported',reason:'unassessed-import-source'});
   const sources=[p.importSource,p.midiData?.importSource].filter(x=>object(x)&&['standard-midi-file','external-song-midi'].includes(x.kind));
   if(sources.length){
    const source=sources[0],path=`projects[${pi}].importedMidiOriginal`;
    dependencies.push({key:path,path,projectId:p.projectId,collection:'imported-midi-original',logicalId:null,reference:null,status:sources.some(x=>x.fileName!==source.fileName||x.fileSize!==source.fileSize)?'ambiguous':'reselection-required',declaredSize:source.fileSize??null});
   }
   const identities=new Map();
   for(const field of ['audioAssets','midiAssets','fileReferences'])for(const [i,a] of (Array.isArray(p[field])?p[field]:[]).entries()){
    const path=`projects[${pi}].${field}[${i}]`,id=field==='fileReferences'?a?.id:a?.assetId;
    const storage=object(a?.storage)?a.storage:{},reference=storage.reference;
    let status=a?.missing===true?'missing':storage.requiresReselection===true||!reference||/^(blob:|data:)/i.test(reference)?'reselection-required':'external';
    if(!object(a)||a.version!==undefined||a.schemaVersion!==undefined||storage.kind!==undefined&&!['external','external-file'].includes(storage.kind))status='unsupported';
    if(typeof id!=='string'||!id.trim())status='unsupported';
    const token=(field==='fileReferences'?'file:':'asset:')+id;
    const d={key:path,path,projectId:p.projectId,collection:field,logicalId:id??null,reference:typeof reference==='string'?reference:null,status,declaredSize:a?.size??null};
    if(identities.has(token)){d.status='ambiguous';identities.get(token).status='ambiguous'}else identities.set(token,d);
    dependencies.push(d);
   }
  }
  return{dependencies,issues};
 }
 function createResolver(bindings){
  // Caller binds explicit logical keys to offline sources. Paths/URLs are never dereferenced.
  const table=new Map([...bindings].map(([key,list])=>[key,Array.isArray(list)?[...list]:[list]]));
  return async dependency=>{
   const candidates=table.get(dependency.key);
   if(!candidates)return{status:dependency.status};
   if(candidates.length!==1)return{status:candidates.length?'ambiguous':'missing'};
   const source=candidates[0];
   if(statuses.has(source?.status)&&source.status!=='available')return{status:source.status};
   if(source?.handle){
    if(typeof source.handle.queryPermission!=='function'||typeof source.handle.getFile!=='function')return{status:'unsupported'};
    const permission=await source.handle.queryPermission({mode:'read'});
    if(permission!=='granted')return{status:permission==='denied'?'permission-unavailable':'reselection-required'};
    const file=await source.handle.getFile();return{status:'available',bytes:await file.arrayBuffer(),expectedBytes:source.expectedBytes};
   }
   if(source?.file&&typeof source.file.arrayBuffer==='function')return{status:'available',bytes:await source.file.arrayBuffer(),expectedBytes:source.expectedBytes};
   return{status:'available',bytes:source?.bytes,expectedBytes:source?.expectedBytes};
  };
 }
 function bytes(value){
  if(value instanceof ArrayBuffer)return new Uint8Array(value.slice(0));
  if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength));
  throw Error('unsupported-byte-source');
 }
 function bounded(work,timeoutMs){let timer;return Promise.race([Promise.resolve(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('resolver-timeout')),timeoutMs)})]).finally(()=>clearTimeout(timer))}
 async function resolve(backup,{resolver,projects=true,reason=()=>null,timeoutMs=5000}={}){
  const baseline=signature(backup),snapshot=copy(backup),listed=inventory(snapshot,{projects}),rows=[],observed=new Map();
  const guard=()=>reason()||(signature(backup)!==baseline?'stale-binary-input':null);
  const check=()=>{const why=guard();if(why)throw Error(why)};
  check();
  for(const d of listed.dependencies){
   check();let status=d.status,data;
   if(!['unsupported','ambiguous'].includes(status)&&typeof resolver==='function'){
    try{
     const answer=await bounded(resolver(copy(d)),Math.max(1,Math.min(15000,timeoutMs)));check();
     status=statuses.has(answer?.status)?answer.status:'unsupported';
     if(status==='available'){
      data=bytes(answer.bytes);
      if(d.declaredSize!==null&&(!Number.isSafeInteger(d.declaredSize)||d.declaredSize<0||data.byteLength!==d.declaredSize))throw Error('byte-mismatch');
      if(answer.expectedBytes!==undefined){const expected=bytes(answer.expectedBytes);if(expected.length!==data.length||expected.some((v,i)=>v!==data[i]))throw Error('byte-mismatch')}
      observed.set(d.key,data);
     }
    }catch(error){check();status=error?.name==='NotAllowedError'||error?.name==='SecurityError'?'permission-unavailable':error?.name==='NotFoundError'?'missing':error.message==='byte-mismatch'?'byte-mismatch':'unverified';}
   }
   rows.push({...d,status,byteLength:data&&status==='available'?data.length:null,observed:status==='available'});
  }
  check();const complete=listed.issues.length===0&&rows.every(d=>d.status==='available');
  const result={complete,dependencies:rows,issues:listed.issues,outcome:complete?'complete':rows.some(d=>d.status==='reselection-required'||d.status==='permission-unavailable')?'reselection-required':'blocked'};
  proofs.set(result,{snapshot,observed,baseline,guard,complete,reportSignature:signature(result)});return result;
 }
 async function completeness(backup,options={}){
  // Resolver must read candidate package bytes, never a live source, for binary-complete.
  const result=await resolve(backup,{...options,resolver:options.packageResolver});
  return{scope:result.dependencies.length||result.issues.length?(result.complete?'binary-complete':'metadata-only'):'metadata-only',binaryComplete:result.complete&&result.dependencies.length>0,
   metadataOnly:!(result.complete&&result.dependencies.length>0),fullBackupComplete:false,metadataValidation:'use-production-restore-preflight',dependencies:result.dependencies,issues:result.issues,states:[...new Set(result.dependencies.map(d=>d.status==='external'?'external-dependency':d.status))],byteEvidence:result.complete?'observed-candidate-bytes':'incomplete',externalRequests:0};
 }
 async function commit(report,{adapter,settings,control}={}){
  const proof=proofs.get(report);
  if(!proof||!proof.complete||signature(report)!==proof.reportSignature)throw Error('binary-preflight-required');
  if(typeof adapter?.restoreGeneration!=='function'||adapter.atomicGeneration!==true)throw Error('atomic-binary-generation-adapter-unavailable');
  const reason=()=>control?.reason?.()||proof.guard();if(reason())throw Error(reason());
  proof.expectedSettings=settings?copy(settings):null;
  const generation={snapshot:copy(proof.snapshot),settings:settings?copy(settings):null,binaries:[...proof.observed].map(([key,value])=>({key,bytes:new Uint8Array(value)}))};
  // Adapter must stage, validate, commit bytes+metadata as ONE generation, and acknowledge only commit.
  // A preflight reader is deliberately insufficient to authorize metadata-only publication here.
  return adapter.restoreGeneration(generation,{reason,get abort(){return control?.abort},set abort(value){if(control)control.abort=value}});
 }
 async function verifyRecovery(report,readGeneration,{reason=()=>null,timeoutMs=5000}={}){
  const proof=proofs.get(report);if(!proof||!proof.complete||signature(report)!==proof.reportSignature)return{accepted:false,reason:'binary-preflight-required'};
  try{
   const check=()=>{const why=reason()||proof.guard();if(why)throw Error(why)};check();
   const recovered=await bounded(readGeneration(),timeoutMs);check();
   if(signature(recovered?.snapshot)!==signature(proof.snapshot)||signature(recovered?.settings??null)!==signature(Object.hasOwn(proof,'expectedSettings')?proof.expectedSettings:proof.snapshot.settings??null))throw Error('metadata-mismatch');
   const rows=recovered?.binaries;if(!Array.isArray(rows)||rows.length!==proof.observed.size)throw Error('binary-closure-mismatch');
   const seen=new Set();for(const row of rows){if(seen.has(row.key)||!proof.observed.has(row.key))throw Error('ambiguous-recovery');seen.add(row.key);const actual=bytes(row.bytes),expected=proof.observed.get(row.key);if(actual.length!==expected.length||actual.some((v,i)=>v!==expected[i]))throw Error('byte-mismatch')}
   check();return{accepted:true,outcome:'complete',scope:'observed-generation-recovery'};
  }catch(error){return{accepted:false,outcome:'blocked',reason:error.message}}
 }
 const api={inventory,createResolver,resolve,completeness,commit,verifyRecovery};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MusicStudioBinaryBoundary=api;
})(typeof window!=='undefined'?window:globalThis);
