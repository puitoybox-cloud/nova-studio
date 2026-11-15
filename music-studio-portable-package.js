/* Offline JSON/byte-array container v1. Storage and publication policy are separate. */
(function(root){
'use strict';
const boundary=typeof module!=='undefined'&&module.exports?require('./music-studio-binary-boundary'):root.MusicStudioBinaryBoundary;
const resources=typeof module!=='undefined'&&module.exports?require('./music-studio-package-resources'):root.MusicStudioPackageResources;
const ingress=typeof module!=='undefined'&&module.exports?require('./music-studio-ingress'):root.MusicStudioIngress;
const copy=x=>JSON.parse(JSON.stringify(x));
const fail=x=>{throw Error(x)};
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
async function digest(bytes){
 const crypto=typeof module!=='undefined'&&module.exports?require('node:crypto').webcrypto:root.crypto;
 if(!crypto?.subtle)fail('digest-unavailable');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
}
function byteArray(x){if(!Array.isArray(x)||x.some(v=>!Number.isInteger(v)||v<0||v>255))fail('invalid-bytes');return new Uint8Array(x)}
function metadata(snapshot,validateMetadata){
 if(typeof validateMetadata!=='function')fail('metadata-validator-required');
 const result=validateMetadata(copy(snapshot));if(result!==true)fail('invalid-metadata');
 const ids=new Set();for(const p of snapshot.projects){if(typeof p.projectId!=='string'||ids.has(p.projectId))fail('duplicate-project-identity');ids.add(p.projectId)}
}
async function read(input,{validateMetadata,reason=()=>null,limits}={}){
 const check=()=>{const r=reason();if(r)fail(r)};check();
 if(limits){resources.configure(limits);if(typeof input==='string')resources.textBytes(input,limits.maxPackageBytes,reason);else resources.inspect(input,limits,reason)}
 const source=typeof input==='string'?JSON.parse(input):input;if(limits)resources.inspect(source,limits,reason);const p=typeof input==='string'?source:copy(source);
 if(!object(p)||p.format!=='music-studio-portable-package'||p.version!==1)fail('unsupported-format');
 if(typeof p.generationId!=='string'||!p.generationId.trim()||!object(p.snapshot)||!Array.isArray(p.entries)||!Array.isArray(p.manifest)||!['complete','metadata-only'].includes(p.scope))fail('required-fields');
 if(p.bindingIdentity!==undefined&&(p.bindingIdentity?.version!==1||typeof p.bindingIdentity.repositoryId!=='string'||!p.bindingIdentity.repositoryId.trim()||p.bindingIdentity.generationId!==p.generationId))fail('repository-generation-identity-mismatch');
 metadata(p.snapshot,validateMetadata);
 const inventory=boundary.inventory(p.snapshot),expected=new Map(inventory.dependencies.map(d=>[d.key,d]));
 if(limits)for(const d of inventory.dependencies)if(d.declaredSize!==null){resources.integer(d.declaredSize);if(d.declaredSize>limits.maxSingleBinaryBytes)fail('over-limit:single-binary')}
 const manifests=new Map(),entries=new Map();
 for(const m of p.manifest){if(!object(m)||typeof m.key!=='string'||manifests.has(m.key))fail('duplicate-identity');manifests.set(m.key,m);if(!expected.has(m.key))fail('unexpected-dependency');const d=expected.get(m.key);if(m.logicalId!==d.logicalId||m.collection!==d.collection||m.projectId!==d.projectId)fail('dependency-identity-mismatch');}
 if(manifests.size!==expected.size)fail('missing-manifest');
 for(const e of p.entries){if(!object(e)||typeof e.key!=='string'||entries.has(e.key))fail('duplicate-entry');if(!expected.has(e.key))fail('unexpected-entry');if(e.contract!=='raw-bytes-v1')fail('unsupported-binary-contract');if(!Number.isSafeInteger(e.byteLength)||e.byteLength<0||!/^[a-f0-9]{64}$/.test(e.digest))fail('invalid-entry-metadata');const bytes=byteArray(e.bytes);if(bytes.length!==e.byteLength)fail('size-mismatch');if(await digest(bytes)!==e.digest)fail('digest-mismatch');const d=expected.get(e.key);if(d.declaredSize!==null&&d.declaredSize!==bytes.length)fail('size-mismatch');entries.set(e.key,bytes);check();}
 const complete=inventory.issues.length===0&&inventory.dependencies.every(d=>!['unsupported','ambiguous'].includes(d.status)&&entries.has(d.key));
 if(p.scope==='complete'&&!complete)fail('incomplete-package');
 check();return{package:p,complete,generation:{packageText:JSON.stringify(p),id:p.generationId,...(p.bindingIdentity?{identity:copy(p.bindingIdentity)}:{}),snapshot:copy(p.snapshot),settings:copy(p.snapshot.settings??null),binaries:[...entries].map(([key,bytes])=>({key,bytes}))}};
}
async function write(snapshot,{generationId,bindings=new Map(),scope='complete',validateMetadata,reason=()=>null,extensions={},limits}={}){
 if(limits){
  resources.configure(limits);resources.jsonBytes(snapshot,limits.maxMetadataBytes,reason);
  const inventory=boundary.inventory(snapshot),entries=[];
  if(inventory.dependencies.length>limits.maxManifestEntries)fail('over-limit:manifest-entries');
  for(const [key,value] of bindings){const why=reason();if(why)fail(why);if(entries.length>=limits.maxEntryCount)fail('over-limit:entry-count');const size=value.byteLength??value.length;resources.integer(size);if(size>limits.maxSingleBinaryBytes)fail('over-limit:single-binary');const bytes=Array.isArray(value)?value:new Uint8Array(value.buffer??value,value.byteOffset??0,size);entries.push({key,contract:'raw-bytes-v1',byteLength:size,digest:'0'.repeat(64),bytes})}
  resources.inspect({...extensions,format:'music-studio-portable-package',version:1,generationId,scope,snapshot,manifest:inventory.dependencies.map(d=>({key:d.key,projectId:d.projectId,logicalId:d.logicalId,collection:d.collection})),entries},limits,reason);
 }

 const baseline=JSON.stringify(snapshot),snap=copy(snapshot),check=()=>{const why=reason()||(JSON.stringify(snapshot)!==baseline?'stale':null);if(why)fail(why)};check();metadata(snap,validateMetadata);
 const inventory=boundary.inventory(snap),entries=[];
 for(const [key,value] of bindings){check();if(!inventory.dependencies.some(d=>d.key===key))fail('unexpected-entry');const bytes=ArrayBuffer.isView(value)?new Uint8Array(value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength)):value instanceof ArrayBuffer?new Uint8Array(value.slice(0)):byteArray(value);entries.push({key,contract:'raw-bytes-v1',byteLength:bytes.length,digest:await digest(bytes),bytes:Array.from(bytes)});check();}
 const p={...copy(extensions),format:'music-studio-portable-package',version:1,generationId,scope,snapshot:snap,manifest:inventory.dependencies.map(d=>({key:d.key,projectId:d.projectId,logicalId:d.logicalId,collection:d.collection})),entries};
 await read(p,{validateMetadata,limits,reason:()=>reason()||(JSON.stringify(snapshot)!==baseline?'stale':null)});check();return JSON.stringify(p);
}
// Optional offline File ingress. No permission prompt or URL dereference.
async function readFile(file,options={}){
 const limits=resources.configure(options.limits);
 if(!ingress)fail('guarded-ingress-unavailable');
 try{
  const input=await ingress.create().readText(file,{maxBytes:limits.maxPackageBytes,signal:options.signal,reason:options.reason});
  input.guard();return await read(input.text,{...options,limits,reason:()=>{input.guard();return options.reason?.()||null}});
 }catch(error){if(['NotAllowedError','SecurityError'].includes(error?.name))fail('permission-unavailable');throw error}
}

const api={read,write,digest,readFile};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MusicStudioPortablePackage=api;
})(typeof window!=='undefined'?window:globalThis);
