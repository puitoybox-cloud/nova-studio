/* Source evidence + explicit runtime observations. No installed model/signing assumptions. */
(function(root){
'use strict';
const matrix=[
 {id:'browser-only',implementation:'IMPLEMENTED',offline:'PHYSICAL TEST REQUIRED',requires:['local script closure','durable browser capabilities']},
 {id:'local-static-serving',implementation:'IMPLEMENTED',offline:'PHYSICAL TEST REQUIRED',requires:['static server','secure-context WebCrypto','local script closure']},
 {id:'PWA',implementation:'UNSUPPORTED',offline:'UNSUPPORTED',requires:['service worker','offline cache manifest']},
 {id:'native-wrapper',implementation:'PARTIAL',offline:'OPEN',requires:['Swift/WKWebView','local asset bundling','platform MIDI bridge'],note:'Production configuration currently opens hosted HTTPS URL'},
 {id:'Audio Helper',implementation:'PARTIAL',offline:'OPEN',requires:['Python runtime','venv dependencies','model files','loopback server','runtime source identity'],note:'Launcher can install pip dependencies and open hosted URL; health checks localOnly without exact source digest'},
 {id:'Python runtime',implementation:'EXTERNAL DEPENDENCY',offline:'OPEN',requires:['compatible Python executable','installed dependency versions']},
 {id:'model files',implementation:'EXTERNAL DEPENDENCY',offline:'OPEN',requires:['Demucs weights','Basic Pitch weights','verified model inventory']},
 {id:'signing/notarization',implementation:'PARTIAL',offline:'PHYSICAL TEST REQUIRED',requires:['distribution signature','notarization ticket','Gatekeeper acceptance'],note:'CI ad-hoc signing verification is not distributable acceptance'},
 {id:'Intel Mac',implementation:'BUILD CONFIG EXISTS',offline:'PHYSICAL TEST REQUIRED',requires:['Intel packaging','real runtime/models/audio/MIDI']},
 {id:'Apple Silicon',implementation:'OPEN',offline:'PHYSICAL TEST REQUIRED',requires:['arm64 runtime/models','real device acceptance']}
];
function helper(observed={}){
 const required=['pythonReady','dependenciesReady','modelsVerified','sourceIdentityMatches','loopbackOnly'];
 const failures=required.filter(k=>observed[k]!==true);return{softwareReady:failures.length===0,failures,offlineReady:failures.length===0&&observed.networkRequired===false,signing:'PHYSICAL TEST REQUIRED',notarization:'PHYSICAL TEST REQUIRED',IntelMac:'PHYSICAL TEST REQUIRED',AppleSilicon:'PHYSICAL TEST REQUIRED'};
}
function health(health,expectedSourceDigest){const failures=[];if(!/^[a-f0-9]{64}$/.test(expectedSourceDigest??''))failures.push('expected-source-unconfigured');if(health?.localOnly!==true)failures.push('not-local-only');if(health?.pipelineRevision!==2)failures.push('unsupported-revision');if(health?.sourceDigest!==expectedSourceDigest)failures.push('source-identity-mismatch');return{ok:failures.length===0,failures,modelsReady:false,physicalAcceptance:'PENDING'}}
async function models(records,{limits,reason=()=>null}={}){
 const node=typeof module!=='undefined'&&module.exports,resources=node?require('./music-studio-package-resources'):root.MusicStudioPackageResources,codec=node?require('./music-studio-portable-package'):root.MusicStudioPortablePackage;
 resources.configure(limits);if(!Array.isArray(records)||records.length===0)throw Error('model-inventory-unconfigured');if(records.length>limits.maxManifestEntries)throw Error('over-limit:manifest-entries');let observed=0;const seen=new Set();
 for(const r of records){const why=reason();if(why)throw Error(why);if(typeof r.identity!=='string'||!r.identity||seen.has(r.identity))throw Error('duplicate-model-identity');seen.add(r.identity);resources.integer(r.byteLength);if(r.byteLength>limits.maxSingleBinaryBytes)throw Error('over-limit:single-binary');if(!(r.bytes instanceof Uint8Array)||r.bytes.length!==r.byteLength)throw Error('model-size-mismatch');observed=resources.add(observed,r.bytes.length);if(observed>limits.maxObservedBytes)throw Error('over-limit:observed-bytes');if(!/^[a-f0-9]{64}$/.test(r.digest)||await codec.digest(r.bytes)!==r.digest)throw Error('model-digest-mismatch');const after=reason();if(after)throw Error(after)}return{ok:true,observedBytes:observed,scope:'CALLER-SUPPLIED INVENTORY ONLY',license:'POLICY REQUIRED',physicalAcceptance:'PENDING'}
}
function validate(observed={}){return{matrix,helper:helper(observed.helper),capabilityContract:'IMPLEMENTED',distributionAcceptance:'OPEN',physicalAcceptance:'PENDING',policyDecision:'REQUIRED'}}
const api={matrix,helper,health,models,validate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MusicStudioDistributionCapabilities=api;
})(typeof window!=='undefined'?window:globalThis);
