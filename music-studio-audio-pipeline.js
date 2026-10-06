/* Local-only audio -> stems -> MIDI bridge for Music Studio. */
(function(root){
  'use strict';

  const VERSION='1.0.6';
  const ENDPOINT='http://127.0.0.1:8766';
  const REQUIRED_PIPELINE_REVISION=2;
  const MAX_AUDIO_BYTES=500*1024*1024;
  const MAX_MIDI_BYTES=64*1024*1024;
  const AUDIO_EXTENSIONS=new Set(['wav','wave','mp3','aif','aiff','caf','m4a','flac','ogg']);
  const AUDIO_ACCEPT='audio/wav,audio/x-wav,audio/mpeg,audio/aiff,audio/x-aiff,audio/x-caf,audio/mp4,audio/flac,audio/ogg,.wav,.wave,.mp3,.aif,.aiff,.caf,.m4a,.flac,.ogg';
  const MIDI_ACCEPT='audio/midi,audio/x-midi,.mid,.midi';
  let installed=false;
  let processing=false;
  let originalImport=null;
  let observer=null;

  // Incremental SHA-256 (FIPS 180-4). Fixed state: 64-byte block + 64 words.
  const HASH_CHUNK=65536;
  const SHA_K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  class StreamingSHA256 {
    constructor(){this.h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);this.w=new Uint32Array(64);this.block=new Uint8Array(64);this.used=0;this.length=0}
    compress(){
      const w=this.w,b=this.block,r=(x,n)=>(x>>>n)|(x<<(32-n));
      for(let i=0;i<16;i++)w[i]=((b[i*4]<<24)|(b[i*4+1]<<16)|(b[i*4+2]<<8)|b[i*4+3])>>>0;
      for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(r(x,7)^r(x,18)^(x>>>3))+w[i-7]+(r(y,17)^r(y,19)^(y>>>10)))>>>0}
      let [a,c,d,e,f,g,h,j]=this.h;
      for(let i=0;i<64;i++){const t=(j+(r(f,6)^r(f,11)^r(f,25))+((f&g)^(~f&h))+SHA_K[i]+w[i])>>>0,u=((r(a,2)^r(a,13)^r(a,22))+((a&c)^(a&d)^(c&d)))>>>0;j=h;h=g;g=f;f=(e+t)>>>0;e=d;d=c;c=a;a=(t+u)>>>0}
      const v=this.h;v[0]=(v[0]+a)>>>0;v[1]=(v[1]+c)>>>0;v[2]=(v[2]+d)>>>0;v[3]=(v[3]+e)>>>0;v[4]=(v[4]+f)>>>0;v[5]=(v[5]+g)>>>0;v[6]=(v[6]+h)>>>0;v[7]=(v[7]+j)>>>0;
    }
    update(bytes){this.length+=bytes.length;for(let i=0;i<bytes.length;){const n=Math.min(64-this.used,bytes.length-i);this.block.set(bytes.subarray(i,i+n),this.used);this.used+=n;i+=n;if(this.used===64){this.compress();this.used=0}}}
    finish(){const length=this.length;this.block[this.used++]=128;if(this.used>56){this.block.fill(0,this.used);this.compress();this.used=0}this.block.fill(0,this.used,56);const view=new DataView(this.block.buffer);view.setUint32(56,Math.floor(length/0x20000000));view.setUint32(60,(length*8)>>>0);this.compress();return Array.from(this.h,x=>x.toString(16).padStart(8,'0')).join('')}
  }
  // Only native immutable Blob/File bytes are accepted. Never trust an overridden
  // size/slice/arrayBuffer or a filename. Snapshot is also the actual upload body.
  const blobProto=root.Blob?.prototype;
  const blobSlice=blobProto?.slice,blobRead=blobProto?.arrayBuffer;
  const blobSize=blobProto&&Object.getOwnPropertyDescriptor(blobProto,'size')?.get;
  const artifactReceipts=new WeakMap();
  let hashBusy=false,hashCache=null,hashEpoch=0;
  function invalidateArtifactHash(){hashCache=null;++hashEpoch}
  function artifactCheck(file,receipt,context){
    const record=artifactReceipts.get(receipt);
    if(!record||record.used||record.file!==file||record.epoch!==hashEpoch||blobSize.call(file)!==receipt.byteLength||
      file.size!==receipt.byteLength||["session","request","processingContract"].some(key=>record.context[key]!==context[key])||record.context.currentArtifact!==context.currentArtifact||context.currentArtifact&&context.currentArtifact()!==file)throw Error('stale-replaced-or-replayed-artifact-receipt');
    return record;
  }
  async function hashBrowserArtifact(file,{signal,check=()=>{},currentArtifact,session=null,request=null,processingContract=null,expectedIdentity=null,onChunk}={}){
    if(hashBusy)throw Error('artifact-hash-occupied');
    if(!blobSlice||!blobRead||!blobSize)throw Error('native-blob-hashing-unavailable');
    const size=blobSize.call(file);
    if(!Number.isSafeInteger(size)||size<0||size>MAX_AUDIO_BYTES||file.size!==size)throw Error('artifact-size-mismatch');
    const epoch=hashEpoch,context={session,request,processingContract,currentArtifact};
    const guard=()=>{check();if(signal?.aborted)throw Error('Abort');if(epoch!==hashEpoch||file.size!==size||blobSize.call(file)!==size||currentArtifact&&currentArtifact()!==file)throw Error('artifact-replaced')};
    guard();hashBusy=true;
    try{
      const snapshot=blobSlice.call(file,0,size);
      let digest,chunks=0;
      if(hashCache?.file===file&&hashCache.size===size&&hashCache.epoch===epoch)digest=hashCache.digest;
      else{
        const sha=new StreamingSHA256();
        for(let start=0;start<size;start+=HASH_CHUNK){guard();const end=Math.min(start+HASH_CHUNK,size);const bytes=new Uint8Array(await blobRead.call(blobSlice.call(snapshot,start,end)));guard();if(bytes.length!==end-start)throw Error('artifact-size-mismatch');sha.update(bytes);chunks++;onChunk?.({byteLength:bytes.length,offset:start});guard();if(chunks%16===0&&root.setTimeout){await new Promise(resolve=>root.setTimeout(resolve,0));guard()}}
        digest=sha.finish();guard();hashCache={file,size,epoch,digest};
      }
      const identity={digest,byteLength:size};
      if(expectedIdentity&&identityText(identity)!==identityText(expectedIdentity))throw Error('artifact-digest-or-size-mismatch');
      const receipt=Object.freeze({format:'NOVA_BROWSER_ARTIFACT_IDENTITY',version:1,...identity,session,request,processingContract,chunkBytes:HASH_CHUNK,chunks,status:'OBSERVED'});
      artifactReceipts.set(receipt,{file,snapshot,context,epoch,used:false});return receipt;
    }catch(error){invalidateArtifactHash();throw error}finally{hashBusy=false}
  }
  function consumeBrowserArtifact(file,receipt,context={session:null,request:null,processingContract:null,currentArtifact:undefined}){
    const record=artifactCheck(file,receipt,context);record.used=true;return record.snapshot;
  }

  function extension(name=''){
    const match=String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
    return match?.[1]||'';
  }

  function isAudioFile(file){
    if(!file)return false;
    const ext=extension(file.name),mime=String(file.type||'').toLowerCase();
    if(ext==='mid'||ext==='midi'||/midi/.test(mime))return false;
    return AUDIO_EXTENSIONS.has(ext)||mime.startsWith('audio/');
  }

  function decodeBase64(value=''){
    if(typeof value!=='string'||value.length===0||value.length>Math.ceil(MAX_MIDI_BYTES/3)*4+4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value)||value.length%4!==0){
      throw Error('ローカル音声処理のMIDIデータが不正、または64 MiBを超えています。');
    }
    const binary=root.atob?root.atob(value):Buffer.from(value,'base64').toString('binary');
    if((root.btoa?root.btoa(binary):Buffer.from(binary,'binary').toString('base64'))!==value){
      throw Error('ローカル音声処理のMIDIデータが不正です。');
    }
    if(binary.length>MAX_MIDI_BYTES)throw Error('ローカル音声処理のMIDIデータが64 MiBを超えています。');
    const bytes=new Uint8Array(binary.length);
    for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
    return bytes;
  }

  function assertMidiHeader(bytes){
    const invalid=()=>{throw Error('ローカル音声処理の結果が有効なMIDIファイルではありません。元の曲は変更していません。')};
    if(bytes.length<22||bytes[0]!==0x4d||bytes[1]!==0x54||bytes[2]!==0x68||bytes[3]!==0x64||
      bytes[4]!==0||bytes[5]!==0||bytes[6]!==0||bytes[7]!==6)invalid();
    const format=(bytes[8]<<8)|bytes[9],trackCount=(bytes[10]<<8)|bytes[11],division=(bytes[12]<<8)|bytes[13];
    if(format>2||trackCount===0||(format===0&&trackCount!==1)||division===0)invalid();
    let offset=14;
    for(let track=0;track<trackCount;track++){
      if(offset+8>bytes.length||bytes[offset]!==0x4d||bytes[offset+1]!==0x54||
        bytes[offset+2]!==0x72||bytes[offset+3]!==0x6b)invalid();
      const size=(bytes[offset+4]*0x1000000)+(bytes[offset+5]<<16)+(bytes[offset+6]<<8)+bytes[offset+7];
      offset+=8+size;
      if(offset>bytes.length)invalid();
    }
  }

  function safeMidiName(value){
    const leaf=String(value||'').replace(/\\/g,'/').split('/').pop().replace(/[\u0000-\u001f\u007f]/g,'').trim();
    const stem=leaf.replace(/\.(?:mid|midi)$/i,'').replace(/[^\p{L}\p{N} ._()\[\]-]/gu,'_').slice(0,160).trim();
    return `${stem||'audio_stems'}.mid`;
  }

  function makeMidiFile(bytes,name){
    const blob=new Blob([bytes],{type:'audio/midi'});
    if(typeof root.File==='function')return new root.File([blob],name,{type:'audio/midi',lastModified:Date.now()});
    blob.name=name;blob.lastModified=Date.now();return blob;
  }

  function statusElement(){
    const section=root.document?.querySelector?.('.music-external-import');
    if(!section)return null;
    let target=section.querySelector?.('#externalAudioPipelineStatus');
    if(!target){
      target=root.document.createElement('p');
      target.id='externalAudioPipelineStatus';
      target.className='music-external-import-status';
      section.appendChild(target);
    }
    return target;
  }

  function setStatus(message,kind='info'){
    const target=statusElement();
    if(!target)return;
    target.textContent=message;
    target.dataset.kind=kind;
    target.setAttribute('role',kind==='error'?'alert':'status');
  }

  function enhanceExternalInput(){
    const input=root.document?.querySelector?.('#externalSongMidiImport');
    if(!input)return false;
    input.accept=`${MIDI_ACCEPT},${AUDIO_ACCEPT}`;
    input.dataset.audioPipeline='local';
    input.title='MIDIまたは音声ファイルを選択します。音声はMac内のローカル処理でStem分離してMIDI化します。';
    const section=input.closest?.('.music-external-import');
    if(section&&!section.querySelector?.('[data-audio-pipeline-help]')){
      const help=root.document.createElement('p');
      help.dataset.audioPipelineHelp='true';
      help.className='music-external-import-status';
      help.textContent='音声（MP3 / WAVなど）はMac内でStem分離 → Audio-to-MIDI → Track Reviewへ進みます。外部AI APIへ音声は送信しません。';
      section.appendChild(help);
    }
    return true;
  }

  async function parseError(response){
    try{const data=await response.json();return String(data?.message||data?.error||`Local audio pipeline error (${response.status})`)}catch(_){return`Local audio pipeline error (${response.status})`}
  }

  let expectedHelperIdentity=null;
  let bootstrapEpoch=0,bootstrapState='LEGACY_UNVERIFIED';
  async function bootstrapIdentity(envelope,controls={}){
    const epoch=++bootstrapEpoch;
    bootstrapState='PENDING'; expectedHelperIdentity=null;
    const check=()=>{const why=controls.signal?.aborted?'Abort':controls.reason?.();if(why)throw Error(why);if(epoch!==bootstrapEpoch)throw Error('stale')};
    try{
      check();
      if(!root.MusicStudioDistributionIdentity?.bootstrap||!envelope?.manifest||!envelope?.trust||typeof envelope.runtimeConfigText!=='string')throw Error('missing-trusted-bootstrap-envelope');
      const binding=await root.MusicStudioDistributionIdentity.bootstrap(envelope.manifest,envelope.trust,{...controls,runtimeConfigText:envelope.runtimeConfigText});check();
      const result=await binding.verify({connectIdentity},controls);check();
      configureIdentity(binding.expected);bootstrapState='VERIFIED';return result;
    }catch(error){if(epoch===bootstrapEpoch){expectedHelperIdentity=null;bootstrapState='BLOCKED'}throw error}
  }
  const usedLocalSessions=new Set();
  let localController=null,localHeartbeat=null,localSession=null,localExpiresAt=0;
  async function bootstrapLocal(handoff,controls={}){
    bootstrapState='BLOCKED';expectedHelperIdentity=null;localSession=null;++bootstrapEpoch;
    const fail=code=>{throw Error(code)};
    let notify=async()=>{};
    try{
      const h=JSON.parse(JSON.stringify(handoff));
      const origin=root.location?.origin;
      if(h?.format!=='NOVA_LOCAL_BROWSER_HANDOFF'||h.version!==1||h.origin!==origin||
          !/^http:\/\/127\.0\.0\.1:[1-9][0-9]*$/.test(origin||'')||
          !['nonce','session','manifestDigest','runtimeConfigDigest','helperIdentityDigest'].every(k=>/^[a-f0-9]{64}$/.test(h[k]))||
          typeof h.buildRevision!=='string'||!h.buildRevision||!Number.isSafeInteger(h.expiresAt)||
          h.expiresAt<=Date.now()||h.expiresAt>Date.now()+300000||usedLocalSessions.has(h.session))fail('invalid-stale-or-replayed-local-handoff');
      usedLocalSessions.add(h.session);
      localController=new AbortController();
      const signal=controls.signal||localController.signal;
      const sha256=controls.sha256||async function(bytes){return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('')};
      const canonical=root.MusicStudioDistributionIdentity?.canonical;if(!canonical)fail('missing-distribution-bootstrap');
      const check=()=>{if(signal.aborted||h.expiresAt<=Date.now())fail('expired-or-cancelled-local-bootstrap')};
      notify=async state=>{await root.fetch(origin+'/lifecycle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,session:h.session,nonce:h.nonce}),keepalive:true}).then(response=>{if(!response.ok)fail('lifecycle-acknowledgement-failed')})};
      check();
      const response=await root.fetch(origin+'/bootstrap-envelope',{method:'POST',headers:{'X-Nova-Session':h.session,'X-Nova-Nonce':h.nonce},body:'',signal,cache:'no-store'});
      if(!response.ok)fail('local-envelope-unavailable');
      const text=await response.text();if(new TextEncoder().encode(text).length>1024*1024)fail('local-envelope-budget');
      const value=JSON.parse(text);check();
      if(value.format!=='NOVA_LOCAL_BROWSER_ENVELOPE'||value.version!==1||value.origin!==origin||value.session!==h.session||value.nonce!==h.nonce||value.expiresAt!==h.expiresAt)fail('local-envelope-session-mismatch');
      const binding={buildRevision:h.buildRevision,manifestDigest:h.manifestDigest,runtimeConfigDigest:h.runtimeConfigDigest,helperIdentityDigest:h.helperIdentityDigest};
      if(canonical(value.binding)!==canonical(binding))fail('local-envelope-anchor-mismatch');
      const envelope=value.envelope;
      for(const [key,bytes] of [['manifestDigest',canonical(envelope.manifest)],['runtimeConfigDigest',envelope.runtimeConfigText],['helperIdentityDigest',canonical(envelope.manifest.helper)]]){
        if(await sha256(new TextEncoder().encode(bytes))!==h[key])fail('local-envelope-digest-mismatch:'+key);check();
      }
      if(envelope.manifest.buildRevision!==h.buildRevision||canonical(envelope.trust)!==canonical({buildRevision:h.buildRevision,manifestDigest:h.manifestDigest}))fail('local-envelope-build-mismatch');
      await notify('BROWSER_READY');check();
      const result=await bootstrapIdentity(envelope,{...controls,signal,sha256,lifecycleSession:h.session});check();
      await notify('IDENTITY_VERIFIED');localSession=h.session;localExpiresAt=h.expiresAt;
      if(root.setInterval)localHeartbeat=root.setInterval(()=>notify('BROWSER_READY').catch(()=>stopLocal()),10000);
      root.addEventListener?.('pagehide',()=>stopLocal(h),{once:true});
      return {...result,processingEligible:true,publicationEligible:false};
    }catch(error){bootstrapState='BLOCKED';expectedHelperIdentity=null;localSession=null;++bootstrapEpoch;localController?.abort();await notify('FAILED').catch(()=>{});throw error}
  }
  function stopLocal(h){
    invalidateArtifactHash();
    localController?.abort();if(localHeartbeat)root.clearInterval?.(localHeartbeat);localHeartbeat=null;
    bootstrapState='BLOCKED';expectedHelperIdentity=null;localSession=null;++bootstrapEpoch;
    if(h)root.navigator?.sendBeacon?.(h.origin+'/lifecycle',new Blob([JSON.stringify({state:'STOPPED',session:h.session,nonce:h.nonce})],{type:'application/json'}));
  }
  function bootstrapStatus(){return {status:bootstrapState,mode:bootstrapState==='LEGACY_UNVERIFIED'?'LEGACY':'STRICT'}}

  function configureIdentity(expected){
    if(expected===null){expectedHelperIdentity=null;++bootstrapEpoch;bootstrapState='LEGACY_UNVERIFIED';return}
    if(expected?.version!==1||expected.pipelineRevision!==2||expected.protocolVersion!==1||typeof expected.runtimeVersion!=='string'||!['sourceDigest','requirementsDigest','identityModuleDigest'].every(k=>/^[a-f0-9]{64}$/.test(expected[k])))throw Error('invalid-helper-identity-contract');
    expectedHelperIdentity=JSON.parse(JSON.stringify(expected));
    ++bootstrapEpoch;bootstrapState='PENDING_HEALTH';
  }
  function identityText(value){
    if(Array.isArray(value))return '['+value.map(identityText).join(',')+']';
    if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+identityText(value[key])).join(',')+'}';
    return JSON.stringify(value);
  }
  function validateIdentity(payload,expected){
    const actual=payload?.runtimeIdentity;
    if(payload?.ok!==true||payload.localOnly!==true||payload.pipelineRevision!==expected.pipelineRevision||payload.sourceDigest!==expected.sourceDigest||payload.version!==1||actual?.version!==1)throw Error('helper-identity-mismatch');
    for(const key of ['protocolVersion','runtimeVersion','requirementsDigest','identityModuleDigest'])if(actual[key]!==expected[key])throw Error('helper-identity-mismatch:'+key);
    if(expected.models!==undefined&&(actual.modelInventory?.status!=='VERIFIED'||identityText(actual.modelInventory.entries)!==identityText(expected.models)))throw Error('model-inventory-mismatch');
    if(expected.dependencyObserverDigest!==undefined&&actual.dependencyObserverDigest!==expected.dependencyObserverDigest)throw Error('helper-identity-mismatch:dependencyObserverDigest');
    if(expected.dependencies!==undefined&&(actual.dependencyInventory?.status!=='VERIFIED'||identityText(actual.dependencyInventory.entries)!==identityText(expected.dependencies)))throw Error('dependency-inventory-mismatch');
    if(expected.architectures!==undefined&&!expected.architectures.includes(actual.architecture))throw Error('unsupported-runtime');
    if(expected.actualInventory){
      const inventory=actual.actualInventory, required=expected.actualInventory;
      if(inventory?.inventoryVersion!==2||inventory.mode!=='STRICT'||inventory.status!=='VERIFIED'||inventory.artifactClosure!=='VERIFIED'||inventory.complete!==true||inventory.processingEligible!==true)throw Error('actual-runtime-inventory-unverified');
      if(required.runtimeEvidenceDigest||inventory.runtimeClosureVersion!==undefined||inventory.runtimeEvidence!==undefined){
        const evidence=inventory.runtimeEvidence;
        if(inventory.runtimeClosureVersion!==1||!evidence||evidence.contractDigest!==required.runtimeEvidenceDigest||evidence.complete!==true||evidence.network?.native!=='ENFORCED'||evidence.nativeClosure?.complete!==true||evidence.dynamicImports?.complete!==true||evidence.codec?.complete!==true||evidence.largeArtifacts?.complete!==true)throw Error('actual-native-runtime-evidence-unverified');
        // This version has no authenticated native-network containment receipt adapter.
        // Claimed booleans/strings cannot unlock strict processing.
        throw Error('native-network-receipt-adapter-unavailable');
      }
      if(!expected.architectures.includes(inventory.architecture))throw Error('unsupported-runtime');
      for(const kind of ['models','dependencies']){
        const entries=inventory[kind];
        if(!Array.isArray(entries)||entries.some(e=>e.status!==(kind==='models'?'LOADED_VERIFIED_FILE':'VERIFIED_ARTIFACT')))throw Error('actual-runtime-inventory-unverified:'+kind);
        const ordered=list=>[...list].sort((a,b)=>a.id.localeCompare(b.id));
        if(identityText(ordered(entries.map(e=>e.identity)))!==identityText(ordered(required[kind])))throw Error('actual-runtime-inventory-mismatch:'+kind);
      }
      if(identityText(inventory.assets)!==identityText(required.assets))throw Error('offline-asset-inventory-mismatch');
      if(!Array.isArray(inventory.native)||identityText(inventory.native)!==identityText(required.native))throw Error('native-inventory-unverified');
    }
    return true;
  }
  async function connectIdentity({expected=expectedHelperIdentity,signal,reason=()=>null,endpoint=ENDPOINT,lifecycleSession}={}){
    if(endpoint!==ENDPOINT)throw Error('non-local-endpoint');
    if(!expected)throw Error('helper-identity-unconfigured');
    const check=()=>{const why=signal?.aborted?'Abort':reason();if(why)throw Error(why)};check();
    const response=await root.fetch(`${ENDPOINT}/health`,{signal,cache:'no-store'});check();if(!response.ok)throw Error('health-unavailable');
    const payload=await response.json();check();
    if(payload.host!=='127.0.0.1'||payload.port!==8766)throw Error('non-local-endpoint');
    if(lifecycleSession&&payload.lifecycleSession!==lifecycleSession)throw Error('stale-helper-session');
    validateIdentity(payload,expected);return payload;
  }
  async function validateProcessingReceipt(payload,{session,request,input,inventory,sha256}={}){
    const receipt=payload?.processingReceipt,binding=receipt?.binding;
    const digest=sha256||async function(bytes){return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('')};
    const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['cache','processingCalls'].includes(key)).map(([key,item])=>[key,stable(item)])):value;
    const hash=value=>digest(new TextEncoder().encode(identityText(value)));
    if(!/^[a-f0-9]{64}$/.test(session||'')||!/^[a-f0-9]{64}$/.test(request||'')||
      receipt?.format!=='NOVA_PROCESSING_RECEIPT'||receipt.version!==1||receipt.complete!==true||
      receipt.status!=='VERIFIED'||receipt.processingEligible!==true||receipt.publicationEligible!==false||
      binding?.session!==session||binding.request!==request||identityText(binding.input)!==identityText(input))throw Error('invalid-processing-receipt-binding');
    const evidence=inventory?.runtimeEvidence||{};
    const identities={inventoryRevision:stable(inventory),modelIdentity:inventory?.models||[],codecIdentity:evidence.codec||{},
      nativeIdentity:Object.fromEntries(['mappedNative','dynamicNativeGraph','transitiveNativeObservation','nativeClosure','scopedNativeLoads'].map(key=>[key,evidence[key]??null])),networkIdentity:evidence.network||{}};
    for(const [key,value] of Object.entries(identities))if(binding[key]!==await hash(value))throw Error('stale-processing-receipt:'+key);
    const required=['decoder','resample','model','inference','stem','encoder','result'];
    if(!Array.isArray(receipt.stages)||receipt.stages.length!==required.length||required.some(stage=>{
      const entries=receipt.stages.filter(entry=>entry.stage===stage);
      return entries.length!==1||!(entries[0].status==='VERIFIED'||stage==='resample'&&entries[0].status==='NOT_APPLICABLE');
    })||receipt.nativeClosureComplete!==true||receipt.networkContainment!=='CONTAINED'||
      !Array.isArray(receipt.blockedBy)||receipt.blockedBy.length)throw Error('partial-processing-receipt');
    const output=decodeBase64(payload.midiBase64);
    if(receipt.output?.byteLength!==output.length||receipt.output?.digest!==await digest(output))throw Error('processing-output-identity-mismatch');
    return true;
  }

  async function processAudioLocally(file,options={}){
    if(['PENDING','BLOCKED'].includes(bootstrapState))throw Error('strict-bootstrap-incomplete');
    const localEpoch=bootstrapEpoch,localSignal=localController?.signal;
    const expected=options.expected||expectedHelperIdentity;
    const check=()=>{const why=localSession&&localExpiresAt<=Date.now()?'expired-local-session':options.signal?.aborted||localSignal?.aborted?'Abort':localSignal&&bootstrapEpoch!==localEpoch?'stale':options.reason?.();if(why)throw Error(why)};check();
    const health=expected?await connectIdentity({...options,expected,...(localSession?{lifecycleSession:localSession}:{})}):null;
    check();
    if(typeof file?.size==='number'&&(file.size<=0||file.size>MAX_AUDIO_BYTES)){
      throw Error('音声ファイルは空でない500 MiB以下のファイルを選んでください。');
    }
    let request=null,input=null,authorization=null,artifact=null,upload=file,artifactContext=null;
    if(localSession){
      if(!root.crypto?.getRandomValues||!root.crypto?.subtle)throw Error('processing-identity-unavailable');
      request=Array.from(root.crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
      artifactContext={session:localSession,request,processingContract:health.runtimeIdentity.actualInventory.runtimeEvidence?.contractDigest??null,currentArtifact:options.currentArtifact};
      artifact=await hashBrowserArtifact(file,{...artifactContext,signal:options.signal,check});
      input={digest:artifact.digest,byteLength:artifact.byteLength};
      check();
      const owner=root.__NOVA_OWNED_PROCESSING;
      if(typeof owner?.authorize!=='function'||typeof owner?.accept!=='function')throw Error('missing-swift-processing-authorization');
      const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['cache','processingCalls'].includes(key)).map(([key,item])=>[key,stable(item)])):value;
      const expectedInventory=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(identityText(stable(health.runtimeIdentity.actualInventory))))),x=>x.toString(16).padStart(2,'0')).join('');
      authorization=await owner.authorize({request,input,expectedInventory,processingContract:health.runtimeIdentity.actualInventory.runtimeEvidence?.contractDigest});
      check();
      if(authorization?.session!==localSession||authorization?.request!==request||!/^[a-f0-9]{64}$/.test(authorization?.ticket||''))throw Error('foreign-processing-authorization');
    }
    check();
    if(localSession)upload=consumeBrowserArtifact(file,artifact,artifactContext);
    let response;
    try{response=await root.fetch(`${ENDPOINT}/process`,{
      method:'POST',
      signal:options.signal,
      headers:{
        'Content-Type':String(file.type||'application/octet-stream'),
        'X-Nova-Audio-Pipeline':'1',
        'X-Nova-File-Name':encodeURIComponent(String(file.name||'audio-input')),
        ...(localSession?{'X-Nova-Session':localSession,'X-Nova-Request':request,'X-Nova-Authorization':authorization.ticket}:{})
      },
      body:upload
    })}catch(error){
      throw Error('MacのローカルAudio Helperに接続できません。START_AUDIO_PIPELINE.commandを起動し、127.0.0.1:8766の接続を確認してください。',{cause:error});
    }
    check();if(!response.ok)throw Error(await parseError(response));
    const payload=await response.json();check();
    if(expected)validateIdentity(payload,expected);
    if(localSession){await validateProcessingReceipt(payload,{session:localSession,request,input,inventory:health.runtimeIdentity.actualInventory});check()}
    if(payload?.pipelineRevision!==REQUIRED_PIPELINE_REVISION){
      throw Error('別の版のAudio Helperが応答しています。以前のHelperをその配布フォルダのSTOP_AUDIO_PIPELINE.commandで停止し、今回の製品HEADと一致するHelperソースを起動してください。');
    }
    if(!payload?.ok||!payload?.midiBase64)throw Error(String(payload?.message||'ローカル音声処理のMIDI結果を受け取れませんでした。'));
    if(localSession){const accepted=await root.__NOVA_OWNED_PROCESSING.accept({midiBase64:payload.midiBase64});check();if(accepted?.accepted!==true)throw Error('owned-output-not-accepted')}
    return payload;
  }

  async function importAudioFile(file){
    const api=root.MusicStudio;
    if(!api||typeof originalImport!=='function')return{ok:false,message:'Music StudioのImport機能を読み込めません。'};
    if(processing)return{ok:false,busy:true,message:'音声をStem分離・MIDI化しています。'};
    processing=true;
    setStatus('音声をMac内で処理しています。Stem分離 → MIDI化の順で進みます。曲の長さによって時間がかかります。');
    try{
      const payload=await processAudioLocally(file),bytes=decodeBase64(payload.midiBase64),midiName=safeMidiName(payload.midiFileName||`${String(file.name||'audio').replace(/\.[^.]+$/,'')}_stems.mid`);
      assertMidiHeader(bytes);
      const midiFile=makeMidiFile(bytes,midiName);
      setStatus(`分離完了：${Array.isArray(payload.stems)?payload.stems.join(' / ')||'Stem':'Stem'}。Music StudioへTrackとして取り込みます。`);
      const result=await originalImport(midiFile);
      const {midiBase64:unusedMidiBytes,...pipelineMetadata}=payload;
      if(result?.ok){
        setStatus('Stem MIDIをTrack Reviewへ取り込みました。','success');
        const {audioPipelineError:previousError,...reviewState}=api.state.externalSongImport||{};
        api.state.externalSongImport={...reviewState,audioPipeline:{sourceFileName:String(file.name||''),midiFileName:midiName,stems:Array.isArray(payload.stems)?payload.stems.slice():[],bpm:payload.bpm??null,localOnly:true}};
      }else{
        setStatus(String(result?.message||'Stem MIDIのTrack Reviewへの取り込みを確認できませんでした。'),'error');
      }
      return{...(result||{ok:false,message:'MIDI取り込み結果を確認できませんでした。'}),audioPipeline:pipelineMetadata};
    }catch(error){
      const message=error?.message||String(error);
      if(api.state){
        const previous=api.state.externalSongImport||{};
        const failure=`音声のStem分離 / MIDI化に失敗しました：${message}`;
        api.state.externalSongImport=Array.isArray(previous.tracks)&&previous.tracks.length
          ?{...previous,audioPipelineError:failure}
          :{...previous,status:'error',message:failure};
      }
      setStatus(`音声のStem分離 / MIDI化に失敗しました：${message}`,'error');
      return{ok:false,error,message};
    }finally{processing=false}
  }

  function install(){
    const api=root.MusicStudio;
    if(installed||!api||typeof api.importExternalSongFile!=='function')return false;
    originalImport=api.importExternalSongFile.bind(api);
    api.importExternalSongFile=function(file){return isAudioFile(file)?importAudioFile(file):originalImport(file)};
    api.audioStemMidiPipeline={VERSION,ENDPOINT,hashBrowserArtifact,consumeBrowserArtifact,invalidateArtifactHash,isAudioFile,processAudioLocally,bootstrapIdentity,bootstrapLocal,stopLocal,bootstrapStatus,configureIdentity,connectIdentity,validateIdentity,validateProcessingReceipt,enhanceExternalInput,assertMidiHeader};
    installed=true;
    enhanceExternalInput();
    if(root.MutationObserver&&root.document?.body){
      observer=new root.MutationObserver(()=>enhanceExternalInput());
      observer.observe(root.document.body,{childList:true,subtree:true});
    }
    return true;
  }

  function installWhenReady(attempt=0){
    if(install())return;
    if(attempt<240)root.setTimeout?.(()=>installWhenReady(attempt+1),50);
  }

  root.MusicStudioAudioPipeline=Object.freeze({VERSION,ENDPOINT,hashBrowserArtifact,consumeBrowserArtifact,invalidateArtifactHash,isAudioFile,processAudioLocally,bootstrapIdentity,bootstrapLocal,stopLocal,bootstrapStatus,configureIdentity,connectIdentity,validateIdentity,validateProcessingReceipt,enhanceExternalInput,assertMidiHeader,install});
  if(root.__NOVA_LOCAL_HANDOFF||root.location?.hash?.startsWith('#nova-local=')){
    bootstrapState='BLOCKED';
    try{
      const handoff=root.__NOVA_LOCAL_HANDOFF||JSON.parse(new URLSearchParams(root.location.hash.slice('#nova-local='.length)).get('handoff'));
      root.history?.replaceState(null,'',root.location.pathname);
      bootstrapLocal(handoff).catch(()=>{});
    }catch(_){bootstrapState='BLOCKED'}
  }
  installWhenReady();
})(typeof window!=='undefined'?window:globalThis);
