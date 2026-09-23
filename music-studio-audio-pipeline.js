/* Local-only audio -> stems -> MIDI bridge for Music Studio. */
(function(root){
  'use strict';

  const VERSION='1.0.0';
  const ENDPOINT='http://127.0.0.1:8766';
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

  async function processAudioLocally(file){
    if(typeof file?.size==='number'&&(file.size<=0||file.size>MAX_AUDIO_BYTES)){
      throw Error('音声ファイルは空でない500 MiB以下のファイルを選んでください。');
    }
    let response;
    try{response=await root.fetch(`${ENDPOINT}/process`,{
      method:'POST',
      headers:{
        'Content-Type':String(file.type||'application/octet-stream'),
        'X-Nova-Audio-Pipeline':'1',
        'X-Nova-File-Name':encodeURIComponent(String(file.name||'audio-input'))
      },
      body:file
    })}catch(error){
      throw Error('MacのローカルAudio Helperに接続できません。START_AUDIO_PIPELINE.commandを起動し、127.0.0.1:8766の接続を確認してください。',{cause:error});
    }
    if(!response.ok)throw Error(await parseError(response));
    const payload=await response.json();
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
      const payload=await processAudioLocally(file),bytes=decodeBase64(payload.midiBase64),midiName=String(payload.midiFileName||`${String(file.name||'audio').replace(/\.[^.]+$/,'')}_stems.mid`);
      assertMidiHeader(bytes);
      const midiFile=makeMidiFile(bytes,midiName);
      setStatus(`分離完了：${Array.isArray(payload.stems)?payload.stems.join(' / ')||'Stem':'Stem'}。Music StudioへTrackとして取り込みます。`);
      const result=await originalImport(midiFile);
      if(result?.ok){
        setStatus('Stem MIDIをTrack Reviewへ取り込みました。','success');
        api.state.externalSongImport={...(api.state.externalSongImport||{}),audioPipeline:{sourceFileName:String(file.name||''),midiFileName:midiName,stems:Array.isArray(payload.stems)?payload.stems.slice():[],bpm:payload.bpm??null,localOnly:true}};
      }else{
        setStatus(String(result?.message||'Stem MIDIのTrack Reviewへの取り込みを確認できませんでした。'),'error');
      }
      return{...result,audioPipeline:payload};
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
    api.audioStemMidiPipeline={VERSION,ENDPOINT,isAudioFile,processAudioLocally,enhanceExternalInput,assertMidiHeader};
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

  root.MusicStudioAudioPipeline=Object.freeze({VERSION,ENDPOINT,isAudioFile,processAudioLocally,enhanceExternalInput,assertMidiHeader,install});
  installWhenReady();
})(typeof window!=='undefined'?window:globalThis);
