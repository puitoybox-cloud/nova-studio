'use strict';
const {chromium}=require('playwright');
const {spawn,execFileSync}=require('node:child_process');
const readline=require('node:readline');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const rows=[];let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  for(const width of [1440,820,390]){
   let child,page;
   const errors=[],warn=[],pageerror=[],external=[];
   try{
    child=spawn('python3',['scripts/music-local-lifecycle-fixture.py'],{stdio:['pipe','pipe','pipe']});
    const rl=readline.createInterface({input:child.stdout});
    const fixture=await Promise.race([new Promise((resolve,reject)=>{rl.once('line',line=>{try{resolve(JSON.parse(line))}catch(e){reject(e)}});child.once('exit',code=>reject(Error('fixture exited '+code)))}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('fixture startup timeout')),10000);t.unref()})]);
    page=await browser.newPage({viewport:{width,height:900}});
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warn.push(m.text())});page.on('pageerror',e=>pageerror.push(e.message));
    page.on('request',r=>{if(!r.url().startsWith(fixture.handoff.origin+'/')&&!r.url().startsWith('http://127.0.0.1:8766/'))external.push(r.url())});
    await page.route('http://127.0.0.1:8766/health',route=>route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':fixture.handoff.origin},contentType:'application/json',body:JSON.stringify(fixture.health)}));
    await page.addInitScript(h=>{window.__NOVA_LOCAL_HANDOFF=h},fixture.handoff);
    await page.goto(fixture.handoff.origin+'/music-studio.html');
    await page.waitForFunction(()=>window.MusicStudioAudioPipeline?.bootstrapStatus().status==='VERIFIED',{},{timeout:10000});
    const state=await page.evaluate(()=>window.MusicStudioAudioPipeline.bootstrapStatus());assert.equal(state.mode,'STRICT');
    const receipts=await page.evaluate(async()=>{
      const api=window.MusicStudioAudioPipeline;
      const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
      const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
      const inventory={models:[],runtimeEvidence:{codec:{},network:{},mappedNative:{},dynamicNativeGraph:{},transitiveNativeObservation:{},nativeClosure:{},scopedNativeLoads:{}}};
      const input={digest:'c'.repeat(64),byteLength:1},binding={session:'a'.repeat(64),request:'b'.repeat(64),input};
      const values={inventoryRevision:inventory,modelIdentity:[],codecIdentity:{},networkIdentity:{},nativeIdentity:{mappedNative:{},dynamicNativeGraph:{},transitiveNativeObservation:{},nativeClosure:{},scopedNativeLoads:{}}};
      for(const [key,value]of Object.entries(values))binding[key]=await hash(new TextEncoder().encode(canonical(value)));
      const bytes=new TextEncoder().encode('fixture-midi');
      const payload={midiBase64:btoa('fixture-midi'),processingReceipt:{format:'NOVA_PROCESSING_RECEIPT',version:1,binding,complete:true,status:'VERIFIED',processingEligible:true,publicationEligible:false,nativeClosureComplete:true,networkContainment:'CONTAINED',blockedBy:[],output:{digest:await hash(bytes),byteLength:bytes.length},stages:['decoder','resample','model','inference','stem','encoder','result'].map(stage=>({stage,status:'VERIFIED'}))}};
      const options={session:binding.session,request:binding.request,input,inventory};
      if(await api.validateProcessingReceipt(payload,options)!==true)throw Error('complete fixture rejected');
      let rejected=0;
      for(const change of [r=>r.complete=false,r=>r.binding.request='f'.repeat(64),r=>r.networkContainment='UNVERIFIED',r=>r.stages=[],r=>r.output.digest='f'.repeat(64)]){
        const wrong=structuredClone(payload);change(wrong.processingReceipt);
        try{await api.validateProcessingReceipt(wrong,options)}catch(_){rejected++}
      }
      if(rejected!==5)throw Error('partial/stale fixture accepted');
      const hashRows=[];
      const unit=new Uint8Array(65536).fill(7);
      for(const size of [0,65537,64*1024*1024,64*1024*1024+1,96*1024*1024+19]){
        const pieces=Array(Math.floor(size/65536)).fill(unit);if(size%65536)pieces.push(unit.slice(0,size%65536));
        const blob=new Blob(pieces);blob.arrayBuffer=()=>{throw Error('whole-file-read-forbidden')};let max=0,count=0;
        const r=await api.hashBrowserArtifact(blob,{onChunk:c=>{max=Math.max(max,c.byteLength);count++}});
        if(max>65536||count!==Math.ceil(size/65536)||r.byteLength!==size)throw Error('unbounded-browser-hash');
        hashRows.push({size,digest:r.digest,chunks:count,maxChunk:max});api.consumeBrowserArtifact(blob,r);
        let replay=false;try{api.consumeBrowserArtifact(blob,r)}catch(_){replay=true}if(!replay)throw Error('artifact-replay');
      }
      let failures=0;
      for(const kind of ['cancel','failure','digest','size','replace']){
        const b=new Blob([unit,unit]),c=new AbortController();let current=b;
        try{await api.hashBrowserArtifact(b,{signal:c.signal,currentArtifact:()=>current,
          ...(kind==='digest'||kind==='size'?{expectedIdentity:{digest:'f'.repeat(64),byteLength:kind==='size'?1:b.size}}:{}),
          onChunk(){if(kind==='cancel')c.abort();if(kind==='failure')throw Error('disposable-read-failure');if(kind==='replace')current=new Blob(['replacement'])}})}catch(_){failures++}
      }
      if(failures!==5)throw Error('missing-stream-failure');
      return {browserHashRows:hashRows,streamRejected:failures,completeFixture:1,rejectedFixtures:rejected,acceptance:'SOFTWARE_CONTRACT_ONLY'};
    });
    for(const row of receipts.browserHashRows){
      const expected=require('node:crypto').createHash('sha256'),unit=Buffer.alloc(65536,7);
      for(let i=0;i<row.size;i+=65536)expected.update(unit.subarray(0,Math.min(65536,row.size-i)));
      assert.equal(row.digest,expected.digest('hex'));
    }
    await page.evaluate(()=>window.MusicStudioAudioPipeline.stopLocal());
    assert.equal(await page.evaluate(()=>window.MusicStudioAudioPipeline.bootstrapStatus().status),'BLOCKED');
    await page.screenshot({path:`verification/music-local-lifecycle-${width}.png`});
    assert.deepEqual([errors,warn,pageerror,external],[[],[],[],[]]);
    rows.push({width,status:'PASS',processingReceipts:receipts,consoleError:errors,consoleWarn:warn,pageerror,externalRequests:external,acceptance:'SOFTWARE_FIXTURE_ONLY'});
   }finally{
    if(page)await page.close();if(child){child.stdin.end('\n');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);const t=setTimeout(()=>{child.kill('SIGKILL');resolve()},3000);t.unref()})}
   }
  }
  fs.mkdirSync('verification',{recursive:true});fs.writeFileSync('verification/music-local-lifecycle-browser-report.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),rows},null,2));
  console.log('Local lifecycle Chrome PASS: 1440/820/390; console/external 0; software fixture only');
 }finally{if(browser)await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
