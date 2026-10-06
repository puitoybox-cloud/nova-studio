'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const distribution=require('../music-studio-distribution-identity.js');
const fs=require('node:fs'),vm=require('node:vm');
const hash=async bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(){const helper={version:1,pipelineRevision:2,protocolVersion:1,runtimeVersion:'1',sourceDigest:'a'.repeat(64),requirementsDigest:'b'.repeat(64),identityModuleDigest:'c'.repeat(64),dependencyObserverDigest:'d'.repeat(64)};const manifest={version:1,buildRevision:'fixture',helper,models:[{id:'m',revision:'1',digest:'e'.repeat(64),byteLength:3}],dependencies:[{id:'p',version:'1',digest:'f'.repeat(64)}],architectures:['x86_64'],assets:[]};const context={TextEncoder,AbortController,console,fetch:async()=>({ok:true,json:async()=>health})};context.window=context;context.MusicStudioDistributionIdentity=distribution;vm.runInNewContext(fs.readFileSync(require.resolve('../music-studio-audio-pipeline.js'),'utf8'),context);const health={ok:true,localOnly:true,host:'127.0.0.1',port:8766,version:1,pipelineRevision:2,sourceDigest:helper.sourceDigest,runtimeIdentity:{...helper,version:1,architecture:'x86_64',modelInventory:{status:'VERIFIED',entries:manifest.models},dependencyInventory:{status:'VERIFIED',entries:manifest.dependencies},actualInventory:{inventoryVersion:2,mode:'STRICT',status:'VERIFIED',artifactClosure:'VERIFIED',complete:true,processingEligible:true,architecture:'x86_64',models:manifest.models.map(identity=>({identity,status:'LOADED_VERIFIED_FILE'})),dependencies:manifest.dependencies.map(identity=>({identity,status:'VERIFIED_ARTIFACT'})),native:[],assets:[]}}};return {context,manifest,health,pipeline:context.MusicStudioAudioPipeline};}
async function bind(f,options={}){const config=distribution.canonical({version:1,models:[{id:'m'}],dependencies:[{id:'p'}],native:[],assets:[]});f.manifest.assets=[{id:'runtime-config',revision:'1',digest:await hash(new TextEncoder().encode(config)),byteLength:new TextEncoder().encode(config).length}];f.health.runtimeIdentity.actualInventory.assets=f.manifest.assets;return distribution.bootstrap(f.manifest,{buildRevision:'fixture',manifestDigest:await hash(new TextEncoder().encode(distribution.canonical(f.manifest)))},{sha256:hash,runtimeConfigText:config,...options});}
test('authenticated runtime bootstrap correct fixture and publication eligibility',async()=>{const f=fixture(),b=await bind(f);assert.ok(Object.isFrozen(b.expected.actualInventory.assets));assert.ok(Object.isFrozen(b.expected.actualInventory.assets[0]));assert.throws(()=>{b.expected.actualInventory.assets[0].digest='0'.repeat(64)},TypeError);assert.equal((await b.verify(f.pipeline)).identityEligible,true);assert.equal((await b.verify(f.pipeline)).publicationEligible,false);assert.equal(b.configure(f.pipeline).status,'PENDING_RUNTIME_INVENTORY');});
test('runtime rejects metadata/entry-only evidence and incomplete closure',async()=>{for(const [key,value] of [['status','PARTIAL'],['mode','LEGACY'],['artifactClosure','UNVERIFIED'],['inventoryVersion',1],['architecture','wrong']]){const f=fixture(),b=await bind(f);f.health.runtimeIdentity.actualInventory[key]=value;await assert.rejects(b.verify(f.pipeline));}for(const status of ['OBSERVED_METADATA_ONLY','VERIFIED_ENTRY_FILE']){const f=fixture(),b=await bind(f);f.health.runtimeIdentity.actualInventory.dependencies[0].status=status;await assert.rejects(b.verify(f.pipeline));}});
test('wrong loaded revision/digest, missing unexpected model and native rejected',async()=>{for(const mutate of [i=>i.models=[],i=>i.models.push({...i.models[0]}),i=>i.models[0].identity={...i.models[0].identity,revision:'wrong'},i=>i.models[0].identity={...i.models[0].identity,digest:'0'.repeat(64)},i=>i.native=[{status:'RESOLVED_ONLY'}],i=>i.assets=[{}]]){const f=fixture(),b=await bind(f);mutate(f.health.runtimeIdentity.actualInventory);await assert.rejects(b.verify(f.pipeline));}});
test('missing anchor, stale build, Abort Cancel stale retry and legacy separation',async()=>{const f=fixture();await assert.rejects(distribution.bootstrap(f.manifest,{}, {sha256:hash}));await assert.rejects(distribution.bootstrap(f.manifest,{buildRevision:'stale',manifestDigest:'a'.repeat(64)},{sha256:hash}));const controller=new AbortController();controller.abort();await assert.rejects(bind(f,{signal:controller.signal}),/Abort/);let why='Cancel';await assert.rejects(bind(f,{reason:()=>why}),/Cancel/);why=null;const b=await bind(f,{reason:()=>why});why='stale';await assert.rejects(b.verify(f.pipeline),/stale/);why=null;assert.equal((await b.verify(f.pipeline)).status,'VERIFIED');assert.equal(distribution.legacy().status,'UNVERIFIED');});
test('bootstrap snapshots trust/config/manifest before async hashing',async()=>{const f=fixture(),text=distribution.canonical({version:1,models:[{id:'m'}],dependencies:[{id:'p'}],native:[],assets:[]}),digest=await hash(new TextEncoder().encode(text));f.manifest.assets=[{id:'runtime-config',revision:'1',digest,byteLength:new TextEncoder().encode(text).length}];f.health.runtimeIdentity.actualInventory.assets=structuredClone(f.manifest.assets);const trust={buildRevision:'fixture',manifestDigest:await hash(new TextEncoder().encode(distribution.canonical(f.manifest)))};const control={runtimeConfigText:text,sha256:async bytes=>{const result=await hash(bytes);f.manifest.assets[0].digest='0'.repeat(64);trust.manifestDigest='0'.repeat(64);control.runtimeConfigText='{}';return result}};const b=await distribution.bootstrap(f.manifest,trust,control);assert.equal(b.expected.actualInventory.assets[0].digest,digest);assert.equal((await b.verify(f.pipeline)).identityEligible,true);});

test('production bootstrap caller verifies before configuring and blocks absent trust upload',async()=>{
 const f=fixture();await bind(f);
 const envelope={manifest:f.manifest,trust:{buildRevision:'fixture',manifestDigest:await hash(new TextEncoder().encode(distribution.canonical(f.manifest)))},runtimeConfigText:distribution.canonical({version:1,models:[{id:'m'}],dependencies:[{id:'p'}],native:[],assets:[]})};
 assert.equal((await f.pipeline.bootstrapIdentity(envelope,{sha256:hash})).identityEligible,true);
 assert.equal(f.pipeline.bootstrapStatus().status,'VERIFIED');
 await assert.rejects(f.pipeline.bootstrapIdentity({}),/missing-trusted/);
 assert.equal(f.pipeline.bootstrapStatus().status,'BLOCKED');
 await assert.rejects(f.pipeline.processAudioLocally({size:1}),/strict-bootstrap-incomplete/);
 assert.equal((await f.pipeline.bootstrapIdentity(envelope,{sha256:hash})).identityEligible,true);
});
test('production bootstrap rejects incomplete inventory and native enforcement',async()=>{
 for(const [key,value] of [['complete',false],['processingEligible',false]]){
 const f=fixture(),b=await bind(f);f.health.runtimeIdentity.actualInventory[key]=value;
 await assert.rejects(b.verify(f.pipeline),/actual-runtime-inventory-unverified/);
 }
});
test('production caller Abort Cancel stale and retry cannot fall through legacy',async()=>{
 const f=fixture();await bind(f);
 const envelope={manifest:f.manifest,trust:{buildRevision:'fixture',manifestDigest:await hash(new TextEncoder().encode(distribution.canonical(f.manifest)))},runtimeConfigText:distribution.canonical({version:1,models:[{id:'m'}],dependencies:[{id:'p'}],native:[],assets:[]})};
 for(const reason of ['Abort','Cancel','stale']){
 await assert.rejects(f.pipeline.bootstrapIdentity(envelope,{sha256:hash,reason:()=>reason}),new RegExp(reason));
 assert.equal(f.pipeline.bootstrapStatus().status,'BLOCKED');
 }
 assert.equal((await f.pipeline.bootstrapIdentity(envelope,{sha256:hash})).identityEligible,true);
});

test('cleared or replaced expected identity invalidates verified bootstrap and pending epoch',async()=>{
 const f=fixture();const b=await bind(f);
 const envelope={manifest:f.manifest,trust:{buildRevision:'fixture',manifestDigest:await hash(new TextEncoder().encode(distribution.canonical(f.manifest)))},runtimeConfigText:distribution.canonical({version:1,models:[{id:'m'}],dependencies:[{id:'p'}],native:[],assets:[]})};
 await f.pipeline.bootstrapIdentity(envelope,{sha256:hash});f.pipeline.configureIdentity(null);
 assert.equal(f.pipeline.bootstrapStatus().status,'LEGACY_UNVERIFIED');assert.equal(f.pipeline.bootstrapStatus().mode,'LEGACY');
 await f.pipeline.bootstrapIdentity(envelope,{sha256:hash});f.pipeline.configureIdentity(b.expected);
 assert.equal(f.pipeline.bootstrapStatus().status,'PENDING_HEALTH');
 let release;const wait=new Promise(resolve=>release=resolve);
 const pending=f.pipeline.bootstrapIdentity(envelope,{sha256:async bytes=>{await wait;return hash(bytes)}});
 f.pipeline.configureIdentity(null);release();await assert.rejects(pending,/stale/);
 assert.equal(f.pipeline.bootstrapStatus().mode,'LEGACY');
});

async function nativeBoundFixture(){
 const f=fixture(),config=distribution.canonical({version:1,models:[{id:'m'}],dependencies:[{id:'p'}],native:[],assets:[{id:'runtime-evidence',path:'runtime-evidence.json'}]});
 f.manifest.assets=[{id:'runtime-config',revision:'1',digest:await hash(new TextEncoder().encode(config)),byteLength:new TextEncoder().encode(config).length},{id:'runtime-evidence',revision:'1',digest:'1'.repeat(64),byteLength:1}];
 f.health.runtimeIdentity.actualInventory.assets=structuredClone(f.manifest.assets);
 const b=await distribution.bootstrap(f.manifest,{buildRevision:'fixture',manifestDigest:await hash(new TextEncoder().encode(distribution.canonical(f.manifest)))},{sha256:hash,runtimeConfigText:config});
 return {f,b};
}
test('authenticated native evidence cannot be omitted by a complete identity response',async()=>{
 const {f,b}=await nativeBoundFixture();assert.equal(b.expected.actualInventory.runtimeEvidenceDigest,'1'.repeat(64));
 await assert.rejects(b.verify(f.pipeline),/actual-native-runtime-evidence-unverified/);
});
test('unknown native networking and incomplete dynamic codec evidence reject claimed processing success',async()=>{
 for(const mutate of [e=>e.network.native='UNVERIFIED',e=>e.contractDigest='0'.repeat(64),e=>e.nativeClosure.complete=false,e=>e.dynamicImports.complete=false,e=>e.codec.complete=false,e=>e.largeArtifacts.complete=false]){
  const {f,b}=await nativeBoundFixture();const inventory=f.health.runtimeIdentity.actualInventory;
  inventory.runtimeClosureVersion=1;inventory.runtimeEvidence={contractDigest:'1'.repeat(64),complete:true,network:{native:'ENFORCED'},nativeClosure:{complete:true},dynamicImports:{complete:true},codec:{complete:true},largeArtifacts:{complete:true}};
  mutate(inventory.runtimeEvidence);await assert.rejects(b.verify(f.pipeline),/actual-native-runtime-evidence-unverified/);
 }
});
test('self asserted native enforcement booleans cannot replace a receipt adapter',async()=>{
 const {f,b}=await nativeBoundFixture(),inventory=f.health.runtimeIdentity.actualInventory;
 inventory.runtimeClosureVersion=1;inventory.runtimeEvidence={contractDigest:'1'.repeat(64),complete:true,network:{native:'ENFORCED'},nativeClosure:{complete:true},dynamicImports:{complete:true},codec:{complete:true},largeArtifacts:{complete:true}};
 await assert.rejects(b.verify(f.pipeline),/native-network-receipt-adapter-unavailable/);
});

async function localFixture(){
 const f=fixture();await bind(f);f.context.location={origin:'http://127.0.0.1:18766'};
 const envelope={manifest:f.manifest,trust:{buildRevision:'fixture',manifestDigest:await hash(new TextEncoder().encode(distribution.canonical(f.manifest)))},runtimeConfigText:distribution.canonical({version:1,models:[{id:'m'}],dependencies:[{id:'p'}],native:[],assets:[]})};
 const binding={buildRevision:'fixture',manifestDigest:envelope.trust.manifestDigest,runtimeConfigDigest:await hash(new TextEncoder().encode(envelope.runtimeConfigText)),helperIdentityDigest:await hash(new TextEncoder().encode(distribution.canonical(f.manifest.helper)))};
 const h={format:'NOVA_LOCAL_BROWSER_HANDOFF',version:1,origin:f.context.location.origin,nonce:'1'.repeat(64),session:'2'.repeat(64),expiresAt:Date.now()+60000,...binding};
 const wire={format:'NOVA_LOCAL_BROWSER_ENVELOPE',version:1,origin:h.origin,nonce:h.nonce,session:h.session,expiresAt:h.expiresAt,binding,envelope};
 f.health.lifecycleSession=h.session;const events=[];
 f.context.fetch=async(url,options)=>{
  if(url.endsWith('/health'))return {ok:true,json:async()=>f.health};
  if(url.endsWith('/lifecycle')){events.push(JSON.parse(options.body).state);return {ok:true}};
  return {ok:true,text:async()=>JSON.stringify(wire)};
 };
 return {...f,h,wire,events};
}
test('local browser handoff uses production bootstrap, strict health and one-shot replay guard',async()=>{
 const f=await localFixture();const r=await f.pipeline.bootstrapLocal(f.h,{sha256:hash});
 assert.equal(r.processingEligible,true);assert.equal(r.publicationEligible,false);
 assert.deepEqual(f.events,['BROWSER_READY','IDENTITY_VERIFIED']);
 await assert.rejects(f.pipeline.bootstrapLocal(f.h,{sha256:hash}),/replayed/);
 assert.equal(f.pipeline.bootstrapStatus().status,'BLOCKED');
});
for(const key of ['origin','buildRevision','manifestDigest','runtimeConfigDigest','helperIdentityDigest','nonce','session']){
 test('local browser rejects wrong '+key,async()=>{
  const f=await localFixture();f.h[key]=key==='origin'?'https://example.invalid':'0'.repeat(64);
  await assert.rejects(f.pipeline.bootstrapLocal(f.h,{sha256:hash}));
  assert.equal(f.pipeline.bootstrapStatus().status,'BLOCKED');
 });
}
test('expired session, wrong Helper session and incomplete evidence fail closed',async()=>{
 for(const mutate of [f=>f.h.expiresAt=Date.now()-1,f=>f.health.lifecycleSession='old',f=>f.health.runtimeIdentity.actualInventory.processingEligible=false,f=>f.health.runtimeIdentity.actualInventory.complete=false]){
  const f=await localFixture();mutate(f);await assert.rejects(f.pipeline.bootstrapLocal(f.h,{sha256:hash}));
  assert.equal(f.pipeline.bootstrapStatus().status,'BLOCKED');
  await assert.rejects(f.pipeline.processAudioLocally({size:1}),/strict-bootstrap/);
 }
});
test('bootstrap failure retries only with fresh session, cancel invalidates receipts',async()=>{
 const f=await localFixture();f.wire.binding.buildRevision='wrong';await assert.rejects(f.pipeline.bootstrapLocal(f.h,{sha256:hash}));
 const fresh=await localFixture();assert.equal((await fresh.pipeline.bootstrapLocal(fresh.h,{sha256:hash})).processingEligible,true);
 fresh.pipeline.stopLocal();assert.equal(fresh.pipeline.bootstrapStatus().status,'BLOCKED');
});
test('local processing rechecks fresh Helper session after successful bootstrap',async()=>{
 const f=await localFixture();await f.pipeline.bootstrapLocal(f.h,{sha256:hash});f.health.lifecycleSession='old';
 await assert.rejects(f.pipeline.processAudioLocally({size:1}),/stale-helper-session/);
});

test('strict local processing without Swift authorization never uploads audio',async()=>{
 const f=await localFixture();await f.pipeline.bootstrapLocal(f.h,{sha256:hash});
 f.context.crypto=crypto.webcrypto;let uploads=0;const fetch=f.context.fetch;
 f.context.fetch=async(url,options)=>{if(url.endsWith('/process'))uploads++;return fetch(url,options)};
 await assert.rejects(f.pipeline.processAudioLocally({size:1,arrayBuffer:async()=>Buffer.from('a')}),/missing-swift-processing-authorization/);
 assert.equal(uploads,0);
});
for(const mode of ['foreign','missing-ticket','valid'])test('Swift one-shot authorization '+mode+' gates request handoff',async()=>{
 const f=await localFixture();await f.pipeline.bootstrapLocal(f.h,{sha256:hash});f.context.crypto=crypto.webcrypto;
 // Transport fixture has no approved native contract; the Swift stub is not production authorization.
 let uploads=0,seen=null,headers=null;const fetch=f.context.fetch;
 f.context.__NOVA_OWNED_PROCESSING={authorize:async value=>{seen=value;return {request:value.request,session:mode==='foreign'?'f'.repeat(64):f.h.session,ticket:mode==='missing-ticket'?'invalid':'a'.repeat(64)}},accept:async()=>({accepted:true})};
 f.context.fetch=async(url,options)=>{if(url.endsWith('/process')){uploads++;headers=options.headers;throw Error('disposable-boundary')}return fetch(url,options)};
 await assert.rejects(f.pipeline.processAudioLocally({size:1,arrayBuffer:async()=>Buffer.from('a')}),mode==='valid'?/START_AUDIO_PIPELINE.command/:/foreign-processing-authorization/);
 assert.equal(seen.processingContract,undefined);assert.match(seen.expectedInventory,/^[a-f0-9]{64}$/);
 assert.equal(seen.input.digest,await hash(Buffer.from('a')));assert.equal(seen.input.byteLength,1);
 assert.equal(uploads,mode==='valid'?1:0);
 if(mode==='valid'){assert.equal(headers['X-Nova-Authorization'],'a'.repeat(64));assert.equal(headers['X-Nova-Request'],seen.request);assert.equal(headers['X-Nova-Session'],f.h.session)}
});
