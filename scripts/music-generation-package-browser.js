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
   await page.addScriptTag({path:'music-studio-binary-boundary.js'});await page.addScriptTag({path:'music-studio.js'});await page.addScriptTag({path:'music-studio-package-resources.js'});await page.addScriptTag({path:'music-studio-runtime-capabilities.js'});await page.addScriptTag({path:'music-studio-distribution-capabilities.js'});await page.addScriptTag({path:'music-studio-portable-package.js'});await page.addScriptTag({path:'music-studio-generation-adapter.js'});await page.addScriptTag({path:'music-studio-binding-prerequisites.js'});await page.waitForFunction(()=>MusicStudio.state.loaded,{},{timeout:15000});
   const result=await bound(page.evaluate(async()=>{
    const app=MusicStudio,codec=MusicStudioPortablePackage,adapter=MusicStudioGenerationAdapter,cases=[];
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
    check((await codec.read(text,{validateMetadata,limits})).complete,'bounded roundtrip');cases.push('bounded roundtrip');
    for(const field of resources.names){let rejected=false;try{await codec.read(text,{validateMetadata,limits:{...limits,[field]:0}})}catch{rejected=true}check(rejected,'limit '+field);cases.push(field)}
    for(const mode of ['negative','overflow','duplicate','mismatch']){const p=JSON.parse(text);if(mode==='negative')p.entries[0].byteLength=-1;if(mode==='overflow')p.entries[0].byteLength=Number.MAX_SAFE_INTEGER+1;if(mode==='duplicate')p.entries.push(p.entries[0]);if(mode==='mismatch')p.entries[0].bytes.pop();let rejected=false;try{await codec.read(p,{validateMetadata,limits})}catch{rejected=true}check(rejected,mode);cases.push('bounded '+mode)}
    for(const why of ['Abort','Cancel','stale']){let rejected=false;try{await codec.read(text,{validateMetadata,limits,reason:()=>why})}catch(e){rejected=e.message===why}check(rejected,why);check((await codec.read(text,{validateMetadata,limits})).complete,'retry');cases.push('bounded '+why+' retry')}
    for(const missing of ['indexedDB','crypto','TextEncoder']){const e={indexedDB,crypto,TextEncoder};delete e[missing];check(!runtime.validate(e).ok,'required runtime '+missing);cases.push('missing '+missing)}
    check(runtime.validate({crypto,TextEncoder},'package').ok,'optional runtime fallback');check(!(await runtime.estimate({})).capacityGuaranteed,'estimate unknown');check(runtime.permission(undefined)==='UNAVAILABLE','permission unavailable');cases.push('runtime optional fallback');
    const descriptor=Object.getOwnPropertyDescriptor(window,'crypto');Object.defineProperty(window,'crypto',{value:{},configurable:true});try{let rejected=false;try{await codec.read(text,{validateMetadata,limits})}catch(e){rejected=e.message==='digest-unavailable'}check(rejected,'digest-unavailable');cases.push('digest-unavailable')}finally{if(descriptor)Object.defineProperty(window,'crypto',descriptor);else delete window.crypto}
    db.close();
    return{cases,pass:true};
   }));
   assert.deepEqual(messages,[]);assert.deepEqual(external,[]);reports.push({width,...result,messages,external});await page.screenshot({path:`verification/music-generation-${width}.png`});
  }finally{await bound(page.close(),5000)}
 }
 fs.writeFileSync('verification/music-generation-browser-report.json',JSON.stringify({head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),reports},null,2));
}finally{if(browser)await bound(browser.close(),5000);clearTimeout(watchdog)}})().catch(e=>{console.error(e);process.exitCode=1});
