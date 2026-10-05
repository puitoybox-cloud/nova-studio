/* Synthetic offline Real Chrome generations; never opens user origin or selects storage policy. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
let browser;const reports=[];
const watchdog=setTimeout(()=>{console.error('Binary browser watchdog exceeded');process.exit(1)},90000);
async function bound(p,ms=15000){let t;try{return await Promise.race([p,new Promise((_,reject)=>t=setTimeout(()=>reject(Error('browser-timeout')),ms))])}finally{clearTimeout(t)}}
(async()=>{try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined,timeout:15000});
 for(const width of [1440,820,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),messages=[],external=[];
  page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push({type:m.type(),text:m.text()})});page.on('pageerror',e=>messages.push({type:'pageerror',text:e.message}));
  try{
   await page.route('**/*',r=>{if(r.request().url()==='https://nova-generation-isolated.test/')return r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><body>Isolated binary contract</body>'});external.push(r.request().url());return r.abort()});await page.goto('https://nova-generation-isolated.test/');
   await page.addScriptTag({path:'music-studio-ingress.js'});await page.addScriptTag({path:'music-studio-binary-boundary.js'});await page.addScriptTag({path:'music-studio.js'});await page.addScriptTag({path:'music-studio-package-resources.js'});await page.addScriptTag({path:'music-studio-runtime-capabilities.js'});await page.addScriptTag({path:'music-studio-distribution-capabilities.js'});await page.addScriptTag({path:'music-studio-portable-package.js'});await page.addScriptTag({path:'music-studio-generation-adapter.js'});await page.addScriptTag({path:'music-studio-binding-prerequisites.js'});await page.addScriptTag({path:'music-studio-publication-prebinding.js'});await page.addScriptTag({path:'music-studio-distribution-identity.js'});await page.addScriptTag({path:'music-studio-audio-pipeline.js'});await page.waitForFunction(()=>MusicStudio.state.loaded,{},{timeout:15000});
   const result=await bound(page.evaluate(async()=>{
    const app=MusicStudio,codec=MusicStudioPortablePackage,adapter=MusicStudioGenerationAdapter,cases=[];
    {
    const distribution=MusicStudioDistributionIdentity;
    const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    const manifest={version:1,buildRevision:'offline-fixture',helper:{version:1,pipelineRevision:2,protocolVersion:1,runtimeVersion:'1',sourceDigest:'a'.repeat(64),requirementsDigest:'b'.repeat(64),identityModuleDigest:'c'.repeat(64),dependencyObserverDigest:'f'.repeat(64)},models:[{id:'fixture',revision:'1',digest:'d'.repeat(64),byteLength:3}],dependencies:[{id:'python',version:'3',digest:'e'.repeat(64)}],architectures:['x86_64'],assets:[]};
    const trust={buildRevision:'offline-fixture',manifestDigest:await hash(new TextEncoder().encode(distribution.canonical(manifest)))};
    const boundDistribution=await distribution.bind(manifest,trust,{sha256:hash});
    const health={ok:true,localOnly:true,host:'127.0.0.1',port:8766,version:1,pipelineRevision:2,sourceDigest:manifest.helper.sourceDigest,runtimeIdentity:{...manifest.helper,architecture:'x86_64',modelInventory:{status:'VERIFIED',entries:manifest.models},dependencyInventory:{status:'VERIFIED',entries:manifest.dependencies}}};
    const distributionSavedFetch=window.fetch;
    try{
     window.fetch=async()=>({ok:true,json:async()=>structuredClone(health)});
     boundDistribution.configure(MusicStudioAudioPipeline);
     if((await boundDistribution.verify(MusicStudioAudioPipeline)).status!=='VERIFIED')throw Error('strict distribution');cases.push('distribution strict verified');
     for(const key of ['modelInventory','dependencyInventory']){const previous=health.runtimeIdentity[key].status;health.runtimeIdentity[key].status='UNCONFIGURED';let rejected=false;try{await boundDistribution.verify(MusicStudioAudioPipeline)}catch{rejected=true}if(!rejected)throw Error(key+' accepted');health.runtimeIdentity[key].status=previous;cases.push(key+' rejected')}
     await boundDistribution.verify(MusicStudioAudioPipeline);cases.push('distribution retry');
     if(distribution.legacy().status!=='UNVERIFIED')throw Error('legacy verified');cases.push('distribution legacy unverified');
     const config=distribution.canonical({version:1,models:[{id:'fixture'}],dependencies:[{id:'python'}],native:[],assets:[]});
     manifest.assets=[{id:'runtime-config',revision:'1',digest:await hash(new TextEncoder().encode(config)),byteLength:new TextEncoder().encode(config).length}];
     trust.manifestDigest=await hash(new TextEncoder().encode(distribution.canonical(manifest)));
     const bootstrap=await distribution.bootstrap(manifest,trust,{sha256:hash,runtimeConfigText:config});
     health.runtimeIdentity.actualInventory={inventoryVersion:2,mode:'STRICT',status:'VERIFIED',artifactClosure:'VERIFIED',architecture:'x86_64',models:manifest.models.map(identity=>({identity,status:'LOADED_VERIFIED_FILE'})),dependencies:manifest.dependencies.map(identity=>({identity,status:'VERIFIED_ARTIFACT'})),native:[],assets:manifest.assets};
     const verified=await bootstrap.verify(MusicStudioAudioPipeline);
     if(!verified.identityEligible||verified.publicationEligible)throw Error('bootstrap eligibility conflation');cases.push('bootstrap authenticated inventory match');
     for(const [key,value] of [['status','PARTIAL'],['mode','LEGACY'],['artifactClosure','UNVERIFIED'],['architecture','wrong'],['models',[]],['native',[{status:'RESOLVED_ONLY'}]]]){
      const saved=health.runtimeIdentity.actualInventory[key];health.runtimeIdentity.actualInventory[key]=value;
      let rejected=false;try{await bootstrap.verify(MusicStudioAudioPipeline)}catch{rejected=true}
      if(!rejected)throw Error('bootstrap accepted '+key);health.runtimeIdentity.actualInventory[key]=saved;cases.push('bootstrap rejected '+key);
     }
     await bootstrap.verify(MusicStudioAudioPipeline);cases.push('bootstrap retry');

    }finally{window.fetch=distributionSavedFetch;MusicStudioAudioPipeline.configureIdentity(null)}

    }
    const check=(v,msg)=>{if(!v)throw Error(msg)};
    const p=app.makeProject({projectId:'p',projectName:'synthetic'});p.audioAssets=[{assetId:'a',size:3,storage:{kind:'external',reference:'offline.wav'}}];p.unknown={future:true};
    const snapshot={format:app.BACKUP_FORMAT,version:1,projects:[p],settings:app.defaultSettings(),unknown:{keep:true}},key='projects[0].audioAssets[0]';
    const validateMetadata=b=>app.restorePreflight(b).ok;
    let db;
    const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('generation-codec-synthetic',1);r.onupgradeneeded=()=>r.result.createObjectStore('generations',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    db=await open();let sequence=0,fault='',why=null;
    const transact=(mode,work)=>new Promise((resolve,reject)=>{const tx=db.transaction('generations',mode),store=tx.objectStore('generations');let result;tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(Error('aborted'));tx.onerror=()=>{try{tx.abort()}catch{}};work(store,tx,v=>result=v)});
    const read=id=>transact('readonly',(store,tx,set)=>{store.get(id).onsuccess=e=>set(e.target.result)});
    const mutate=(id,fn)=>transact('readwrite',(store,tx)=>{store.get(id).onsuccess=e=>{try{const r=e.target.result;fn(r);store.put(r)}catch(error){tx.abort()}}});
    const backend={
     prepare:id=>transact('readwrite',(store,tx)=>store.add({id,sequence:++sequence,binaries:[],marker:null})),
     async stageMetadata(id,text){await mutate(id,r=>r.packageText=fault==='metadata'?'invalid':text)},
     async stageBinary(id,key,bytes){await mutate(id,r=>r.binaries.push({key,bytes:Array.from(fault==='binary'?bytes.slice(1):bytes)}));if(fault==='Cancel')why='Cancel';if(fault==='late')throw Error('late')},
     read,
     commit:(id,marker,control)=>mutate(id,r=>{if(control.reason())throw Error(control.reason());r.marker=marker}),
     list:()=>transact('readonly',(store,tx,set)=>{store.getAll().onsuccess=e=>set(e.target.result.map(r=>({id:r.id,sequence:r.sequence})))}),
     abort:async()=>{},cleanupIncomplete:async()=>{throw Error('explicit-cleanup-not-exercised')}
    };
    const create=()=>adapter.create({backend,validateMetadata});
    const g=id=>({id,snapshot:structuredClone(snapshot),settings:structuredClone(snapshot.settings),binaries:[{key,bytes:new Uint8Array([1,2,3])}]});
    await create().restoreGeneration(g('old'));cases.push('commit');
    for(const mode of ['metadata','binary','Cancel','late']){fault=mode;why=null;let rejected=false;try{await create().restoreGeneration(g(mode),{reason:()=>why})}catch{rejected=true}check(rejected,'fault accepted '+mode);check((await create().recoverLatestValidGeneration()).generation.id==='old','fallback '+mode);cases.push(mode)}
    fault='';why=null;await create().restoreGeneration(g('new'));db.close();db=await open();check((await create().reloadGeneration('new')).binaries[0].bytes[2]===3,'reload');cases.push('reopen');
    await mutate('new',r=>r.marker=null);check((await create().recoverLatestValidGeneration()).generation.id==='old','missing marker fallback');cases.push('missing marker');
    const text=await codec.write(snapshot,{generationId:'package',validateMetadata,bindings:new Map([[key,new Uint8Array([1,2,3])]]),extensions:{future:{keep:true}}});
    const parsed=await codec.read(text,{validateMetadata});check(parsed.complete&&parsed.package.future.keep,'roundtrip');await create().restoreGeneration(parsed.generation);check((await create().reloadGeneration('package')).snapshot.unknown.keep,'restore');cases.push('package Restore');
    for(const mode of ['missing','duplicate','size','digest','unsupported']){const value=JSON.parse(text);if(mode==='missing')value.entries=[];if(mode==='duplicate')value.entries.push(value.entries[0]);if(mode==='size')value.entries[0].byteLength++;if(mode==='digest')value.entries[0].bytes[0]=9;if(mode==='unsupported')value.entries[0].contract='future';let rejected=false;try{await codec.read(value,{validateMetadata})}catch{rejected=true}check(rejected,'package '+mode);cases.push(mode)}
    const metadataOnly=await codec.write(snapshot,{generationId:'meta',scope:'metadata-only',validateMetadata});check(!(await codec.read(metadataOnly,{validateMetadata})).complete,'metadata-only complete');cases.push('metadata-only');
    const limits={maxPackageBytes:100000,maxEntryCount:2,maxSingleBinaryBytes:3,maxMetadataBytes:50000,maxManifestEntries:2,maxObservedBytes:6},resources=MusicStudioPackageResources,runtime=MusicStudioRuntimeCapabilities;
    check((await codec.read(text,{validateMetadata,limits})).complete,'bounded roundtrip');cases.push('bounded roundtrip');check((await codec.readFile(new Blob([text]),{validateMetadata,limits})).complete,'bounded File ingress');cases.push('bounded File ingress');
    for(const field of resources.names){let rejected=false;try{await codec.read(text,{validateMetadata,limits:{...limits,[field]:0}})}catch{rejected=true}check(rejected,'limit '+field);cases.push(field)}
    for(const mode of ['negative','overflow','duplicate','mismatch']){const p=JSON.parse(text);if(mode==='negative')p.entries[0].byteLength=-1;if(mode==='overflow')p.entries[0].byteLength=Number.MAX_SAFE_INTEGER+1;if(mode==='duplicate')p.entries.push(p.entries[0]);if(mode==='mismatch')p.entries[0].bytes.pop();let rejected=false;try{await codec.read(p,{validateMetadata,limits})}catch{rejected=true}check(rejected,mode);cases.push('bounded '+mode)}
    for(const why of ['Abort','Cancel','stale']){let rejected=false;try{await codec.read(text,{validateMetadata,limits,reason:()=>why})}catch(e){rejected=e.message===why}check(rejected,why);check((await codec.read(text,{validateMetadata,limits})).complete,'retry');cases.push('bounded '+why+' retry')}
    for(const missing of ['indexedDB','crypto','TextEncoder']){const e={indexedDB,crypto,TextEncoder};delete e[missing];check(!runtime.validate(e).ok,'required runtime '+missing);cases.push('missing '+missing)}
    check(runtime.validate({crypto,TextEncoder},'package').ok,'optional runtime fallback');check(!(await runtime.estimate({})).capacityGuaranteed,'estimate unknown');check(runtime.permission(undefined)==='UNAVAILABLE','permission unavailable');cases.push('runtime optional fallback');
    const descriptor=Object.getOwnPropertyDescriptor(window,'crypto');Object.defineProperty(window,'crypto',{value:{},configurable:true});try{let rejected=false;try{await codec.read(text,{validateMetadata,limits})}catch(e){rejected=e.message==='digest-unavailable'}check(rejected,'digest-unavailable');cases.push('digest-unavailable')}finally{if(descriptor)Object.defineProperty(window,'crypto',descriptor);else delete window.crypto}
    const ig=MusicStudioIngress.create();check((await ig.readText(new Blob(['abc']),{maxBytes:3})).text==='abc','production exact limit');cases.push('production exact limit');
    for(const mode of ['over','short','long','negative','unsafe','reader']){let rejected=false;const file={size:mode==='negative'?-1:mode==='unsafe'?Number.MAX_SAFE_INTEGER+1:mode==='short'?2:mode==='long'?4:3,text:async()=>{if(mode==='reader')throw Error('reader');return'abc'}};try{await ig.readText(file,{maxBytes:mode==='over'?2:4})}catch{rejected=true}check(rejected,'production '+mode);cases.push('production '+mode)}
    for(const why of ['Abort','Cancel','stale']){const signal=new AbortController();if(why==='Abort')signal.abort();let rejected=false;try{await ig.readText(new Blob(['abc']),{maxBytes:3,signal:signal.signal,reason:()=>why==='Abort'?null:why})}catch{rejected=true}check(rejected,why);check((await ig.readText(new Blob(['abc']),{maxBytes:3})).text==='abc','retry');cases.push('production '+why+' retry')}
    const memory=app.memoryRepository();app.setRepository(memory);await app.refresh();check((await app.importFile(new Blob([JSON.stringify(app.makeProject({projectId:'ingress',projectName:'synthetic'}))]))).ok,'production Project ingress');cases.push('production Project ingress');
    const backupText=JSON.stringify({format:app.BACKUP_FORMAT,version:1,projects:[],settings:app.defaultSettings()});check((await app.previewBackupFile(new Blob([backupText]))).ok,'production Backup ingress');cases.push('production Backup ingress');
    const repo={},strict={...backend,metadataRepository:repo,repositoryId:'repo',capabilities:{immutableSlots:true,guardedCommit:true,atomicMetadataPublication:true,selectedPointer:true,quotaFailureAtomic:true}};let pointer;
    strict.prepare=(id,identity)=>transact('readwrite',(store,tx)=>store.add({id,repositoryId:identity.repositoryId,sequence:++sequence,binaries:[],marker:null}));
    strict.commit=(id,marker,control)=>mutate(id,r=>{if(control.reason())throw Error(control.reason());r.marker=marker;pointer={version:1,repositoryId:'repo',generationId:id,digest:marker.digest}});strict.readSelectedPointer=async()=>pointer;
    const pub=MusicStudioPublicationPrebinding.create({backend:strict,repository:repo,repositoryId:'repo',limits,environment:window,legacyPreserved:true,validateMetadata});
    const identityText=await codec.write(snapshot,{generationId:'identity',extensions:{bindingIdentity:{version:1,repositoryId:'repo',generationId:'identity'}},validateMetadata,limits,bindings:new Map([[key,new Uint8Array([1,2,3])]])});
    check((await pub.importPackage(new Blob([identityText]))).selectedAcknowledged,'publication selected acknowledgement');cases.push('publication selected acknowledgement');
    for(const mode of ['repository','generation','marker']){const saved=pointer;pointer={...saved,[mode==='repository'?'repositoryId':mode==='generation'?'generationId':'digest']:'wrong'};let rejected=false;try{await pub.reloadSelected('identity')}catch{rejected=true}check(rejected,mode);pointer=saved;cases.push('pointer '+mode)}
    const expected={version:1,pipelineRevision:2,sourceDigest:'a'.repeat(64),protocolVersion:1,runtimeVersion:'1',requirementsDigest:'b'.repeat(64),identityModuleDigest:'c'.repeat(64)};
    const baseHealth={ok:true,localOnly:true,host:'127.0.0.1',port:8766,version:1,pipelineRevision:2,sourceDigest:expected.sourceDigest,runtimeIdentity:{version:1,protocolVersion:1,runtimeVersion:'1',requirementsDigest:expected.requirementsDigest,identityModuleDigest:expected.identityModuleDigest,modelInventory:{status:'UNCONFIGURED',entries:[]}}};
    const savedImport=app.importExternalSongFile;app.importExternalSongFile=async()=>({ok:true});MusicStudioAudioPipeline.install();const helper=app.audioStemMidiPipeline;helper.configureIdentity(expected);const savedFetch=window.fetch;
    try{for(const mode of ['correct','revision','digest','protocol','missing','models','unavailable','non-local','Cancel','Abort']){const h=JSON.parse(JSON.stringify(baseHealth));if(mode==='revision')h.pipelineRevision=3;if(mode==='digest')h.sourceDigest='d'.repeat(64);if(mode==='protocol')h.runtimeIdentity.protocolVersion=2;if(mode==='missing')delete h.runtimeIdentity;window.fetch=async()=>({ok:mode!=='unavailable',json:async()=>h});const opts={};if(mode==='models')opts.expected={...expected,models:[]};if(mode==='non-local')opts.endpoint='https://invalid.test';if(mode==='Cancel')opts.reason=()=> 'Cancel';if(mode==='Abort'){const s=new AbortController();s.abort();opts.signal=s.signal}let accepted=false;try{await helper.connectIdentity(opts);accepted=true}catch{}check(accepted===(mode==='correct'),'helper '+mode);cases.push('helper '+mode)}}finally{window.fetch=savedFetch;app.importExternalSongFile=savedImport;helper.configureIdentity(null)}
    db.close();
    return{cases,pass:true};
   }));
   assert.deepEqual(messages,[]);assert.deepEqual(external,[]);reports.push({width,...result,messages,external});await page.screenshot({path:`verification/music-generation-${width}.png`});
  }finally{await bound(page.close(),5000)}
 }
 fs.writeFileSync('verification/music-generation-browser-report.json',JSON.stringify({head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),reports},null,2));
}finally{if(browser)await bound(browser.close(),5000);clearTimeout(watchdog)}})().catch(e=>{console.error(e);process.exitCode=1});
