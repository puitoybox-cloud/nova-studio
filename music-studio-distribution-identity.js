/* External trust anchor required. This module never authenticates its own input. */
(function(root){
'use strict';
const fail=code=>{throw Error(code)};
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function exact(x,keys){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(x,k)))fail('invalid-manifest-field')}
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x)}
function inventory(entries,kind){if(!Array.isArray(entries)||entries.length>128)fail('invalid-inventory');const ids=new Set();for(const e of entries){exact(e,kind==='model'?['id','revision','digest','byteLength']:['id','version','digest']);if(typeof e.id!=='string'||!e.id||ids.has(e.id))fail('duplicate-or-invalid-identity');ids.add(e.id);if(!digest(e.digest))fail('invalid-artifact-digest');if(kind==='model'){if(typeof e.revision!=='string'||!e.revision||!Number.isSafeInteger(e.byteLength)||e.byteLength<1)fail('invalid-model-identity')}else if(typeof e.version!=='string'||!e.version)fail('invalid-dependency-identity')}}
async function bind(manifest,trust,{sha256,signal,reason=()=>null}={}){
 const check=()=>{const why=signal?.aborted?'Abort':reason();if(why)fail(why)};check();
 exact(manifest,['version','buildRevision','helper','models','dependencies','architectures','assets']);
 if(manifest.version!==1)fail('invalid-manifest-version');
 if(!trust||!digest(trust.manifestDigest)||typeof trust.buildRevision!=='string'||typeof sha256!=='function')fail('missing-external-trust-anchor');
 if(manifest.buildRevision!==trust.buildRevision)fail('stale-manifest');
 const h=manifest.helper;exact(h,['version','pipelineRevision','protocolVersion','runtimeVersion','sourceDigest','requirementsDigest','identityModuleDigest','dependencyObserverDigest']);
 if(h.version!==1||h.pipelineRevision!==2||h.protocolVersion!==1||typeof h.runtimeVersion!=='string'||!h.runtimeVersion||!['sourceDigest','requirementsDigest','identityModuleDigest','dependencyObserverDigest'].every(k=>digest(h[k])))fail('invalid-helper-identity');
 inventory(manifest.models,'model');inventory(manifest.dependencies,'dependency');inventory(manifest.assets,'model');
 if(!Array.isArray(manifest.architectures)||!manifest.architectures.length||manifest.architectures.some(x=>typeof x!=='string'||!x)||new Set(manifest.architectures).size!==manifest.architectures.length)fail('unsupported-runtime');
 const snapshot=JSON.parse(canonical(manifest));
 const hash=await sha256(new TextEncoder().encode(canonical(snapshot)));check();if(hash!==trust.manifestDigest)fail('manifest-digest-mismatch');
 const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x)}return x};
 const expected=freeze({...snapshot.helper,models:snapshot.models,dependencies:snapshot.dependencies,architectures:snapshot.architectures,distributionDigest:hash});
 return Object.freeze({mode:'STRICT',trust:'EXTERNALLY_ANCHORED',expected,configure(pipeline){check();pipeline.configureIdentity(expected);return {mode:'STRICT',status:'PENDING_HEALTH'}},async verify(pipeline,options={}){check();await pipeline.connectIdentity({...options,expected,signal,reason});check();return {mode:'STRICT',status:'VERIFIED'}}});
}
async function bootstrap(input,trust,control={}){
 const manifest=JSON.parse(canonical(input)),options={...control},configText=options.runtimeConfigText;
 const check=()=>{const why=options.signal?.aborted?'Abort':options.reason?.();if(why)fail(why)};check();
 const bound=await bind(manifest,{...trust},options);
 const configAsset=manifest.assets.find(e=>e.id==='runtime-config');
 if(!configAsset||typeof configText!=='string')fail('missing-authenticated-runtime-config');
 const bytes=new TextEncoder().encode(configText);
 if(bytes.length!==configAsset.byteLength||bytes.length>65536||await options.sha256(bytes)!==configAsset.digest)fail('runtime-config-digest-mismatch');
 const config=JSON.parse(configText);
 if(canonical(config)!==configText)fail('noncanonical-runtime-config');
 exact(config,['version','models','dependencies','native','assets']);
 if(config.version!==1||['models','dependencies','native','assets'].some(k=>!Array.isArray(config[k])||config[k].length>128||new Set(config[k].map(e=>e.id)).size!==config[k].length))fail('invalid-runtime-config');
 const sameIds=(a,b)=>canonical(a.map(e=>e.id).sort())===canonical(b.map(e=>e.id).sort());
 if(!sameIds(config.models,bound.expected.models)||!sameIds(config.dependencies,bound.expected.dependencies))fail('runtime-config-inventory-mismatch');
 const assetIds=new Set([...config.assets,...config.native,...config.models.flatMap(e=>e.companions||[]),...config.dependencies.flatMap(e=>e.native||[])].map(e=>e.id));assetIds.delete('runtime-config');
 if(canonical([...assetIds].sort())!==canonical(manifest.assets.filter(e=>e.id!=='runtime-config').map(e=>e.id).sort()))fail('missing-or-unexpected-local-asset');
 const native=config.native.map(e=>{const asset=manifest.assets.find(a=>a.id===e.id);if(!asset)fail('missing-native-asset');return {identity:asset,source:e.path,architecture:e.architecture,version:e.version,status:'VERIFIED_EXECUTABLE_FILE',versionEvidence:'MANIFEST_BOUND_ONLY'}});
 const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x)}return x};
 const expected=freeze({...bound.expected,actualInventory:{inventoryVersion:2,models:bound.expected.models,dependencies:bound.expected.dependencies,assets:JSON.parse(canonical(manifest.assets)),native:JSON.parse(canonical(native))}});check();
 return Object.freeze({mode:'STRICT',trust:'EXTERNALLY_ANCHORED',expected,
 configure(pipeline){check();pipeline.configureIdentity(expected);return {mode:'STRICT',status:'PENDING_RUNTIME_INVENTORY'}},
 async verify(pipeline,control={}){check();await pipeline.connectIdentity({...control,expected,signal:options.signal,reason:options.reason});check();return {mode:'STRICT',status:'VERIFIED',identityEligible:true,publicationEligible:false,publicationBlocker:'BACKEND_ACKNOWLEDGEMENT_REQUIRED'}}});
}
const api={canonical,bind,bootstrap,legacy:()=>({mode:'LEGACY',status:'UNVERIFIED'})};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MusicStudioDistributionIdentity=api;
})(typeof window!=='undefined'?window:globalThis);
