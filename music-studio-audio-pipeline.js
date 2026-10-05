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
  async function connectIdentity({expected=expectedHelperIdentity,signal,reason=()=>null,endpoint=ENDPOINT}={}){
    if(endpoint!==ENDPOINT)throw Error('non-local-endpoint');
    if(!expected)throw Error('helper-identity-unconfigured');
    const check=()=>{const why=signal?.aborted?'Abort':reason();if(why)throw Error(why)};check();
    const response=await root.fetch(`${ENDPOINT}/health`,{signal,cache:'no-store'});check();if(!response.ok)throw Error('health-unavailable');
    const payload=await response.json();check();
    if(payload.host!=='127.0.0.1'||payload.port!==8766)throw Error('non-local-endpoint');
    validateIdentity(payload,expected);return payload;
  }
  async function processAudioLocally(file,options={}){
    if(['PENDING','BLOCKED'].includes(bootstrapState))throw Error('strict-bootstrap-incomplete');
    const expected=options.expected||expectedHelperIdentity;
    const check=()=>{const why=options.signal?.aborted?'Abort':options.reason?.();if(why)throw Error(why)};check();
    if(expected)await connectIdentity({...options,expected});
    check();
    if(typeof file?.size==='number'&&(file.size<=0||file.size>MAX_AUDIO_BYTES)){
      throw Error('音声ファイルは空でない500 MiB以下のファイルを選んでください。');
    }
    let response;
    try{response=await root.fetch(`${ENDPOINT}/process`,{
      method:'POST',
      signal:options.signal,
      headers:{
        'Content-Type':String(file.type||'application/octet-stream'),
        'X-Nova-Audio-Pipeline':'1',
        'X-Nova-File-Name':encodeURIComponent(String(file.name||'audio-input'))
      },
      body:file
    })}catch(error){
      throw Error('MacのローカルAudio Helperに接続できません。START_AUDIO_PIPELINE.commandを起動し、127.0.0.1:8766の接続を確認してください。',{cause:error});
    }
    check();if(!response.ok)throw Error(await parseError(response));
    const payload=await response.json();check();
    if(expected)validateIdentity(payload,expected);
    if(payload?.pipelineRevision!==REQUIRED_PIPELINE_REVISION){
      throw Error('別の版のAudio Helperが応答しています。以前のHelperをその配布フォルダのSTOP_AUDIO_PIPELINE.commandで停止し、今回の製品HEADと一致するHelperソースを起動してください。');
    }
    if(!payload?.ok||!payload?.midiBase64)throw Error(String(payload?.message||'ローカル音声処理のMIDI結果を受け取れませんでした。'));
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
    api.audioStemMidiPipeline={VERSION,ENDPOINT,isAudioFile,processAudioLocally,bootstrapIdentity,bootstrapStatus,configureIdentity,connectIdentity,validateIdentity,enhanceExternalInput,assertMidiHeader};
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

  root.MusicStudioAudioPipeline=Object.freeze({VERSION,ENDPOINT,isAudioFile,processAudioLocally,bootstrapIdentity,bootstrapStatus,configureIdentity,connectIdentity,validateIdentity,enhanceExternalInput,assertMidiHeader,install});
  installWhenReady();
})(typeof window!=='undefined'?window:globalThis);
