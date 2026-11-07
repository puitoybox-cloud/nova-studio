Warning: truncated output (original token count: 253992)
Total output lines: 5320

/* MS-06: isolated Music Studio projects with safe Standard MIDI File round-trip. */
(function(root){
  'use strict';

  const HOME_ROUTE='music-studio';
  const PROJECTS_ROUTE=`${HOME_ROUTE}/recent-projects`;
  const PROJECTS_ALIAS_ROUTE=`${HOME_ROUTE}/projects`;
  const NEW_ROUTE=`${HOME_ROUTE}/new-project`;
  const EDIT_ROUTE=`${HOME_ROUTE}/project`;
  const MIDI_EDITOR_ROUTE=`${HOME_ROUTE}/midi-editor`;
  const SETTINGS_ROUTE=`${HOME_ROUTE}/settings`;
  const BACKUP_ROUTE=`${HOME_ROUTE}/backup`;
  const LOGIC_PRO_ROUTE=`${HOME_ROUTE}/logic-pro`;
  const FIRST_SONG_GUIDE_ROUTE=`${HOME_ROUTE}/first-song-guide`;
  const FORMAT='music-studio-project';
  const SCHEMA_VERSION='1.0';
  const APP_VERSION='1.4.0';
  const ASSET_VERSION='1.4.224';
  const DB_NAME='music-studio-projects';
  const STORE_NAME='projects';
  const SETTINGS_STORE_NAME='settings';
  const AUTO_BACKUP_STORE_NAME='autoBackups';
  const MIDI_HISTORY_STORE_NAME='midiExportHistory';
  const MIDI_IMPORT_HISTORY_STORE_NAME='midiImportHistory';
  const SETTINGS_ID='current';
  const SETTINGS_FORMAT='music-studio-settings';
  const SETTINGS_VERSION=1;
  const BACKUP_FORMAT='music-studio-backup';
  const BACKUP_VERSION=1;
  const PIANO_PITCH_COUNT=128;
  const PIANO_ROW_HEIGHT=18;
  const PIANO_HEADER_HEIGHT=46;
  const LAST_PROJECT_KEY='musicStudio_lastProjectId_v1';
  const STATUS_LABELS={available:'使用可能',working:'作業中',planned:'未実装'};
  const PROJECT_STATUS_LABELS={idea:'アイデア',draft:'制作中',review:'確認中',complete:'完成',paused:'保留'};
  const FEATURES=[
    {id:'new-project',icon:'＋',title:'新しい音楽プロジェクト',description:'曲名や制作目的を決めて、新しい制作を始める入口です。',status:'available'},
    {id:'recent-projects',icon:'◷',title:'最近使ったプロジェクト',description:'最近編集したMusic Studioプロジェクトへ戻る一覧です。',status:'available'},
    {id:'logic-pro',icon:'LP',title:'Logic Pro X連携',description:'標準MIDIと音声参照を使った安全な手動受け渡しを案内します。',status:'working'},
    {id:'midi-composer',icon:'♬',title:'MIDI Composer',description:'Melody／Drums／Bass共通のMIDIノート編集画面です。',status:'available'},
    {id:'lyrics-notes',icon:'あ',title:'歌詞・音符割付',description:'歌詞の読みと音符の対応を確認・調整します。',status:'working'},
    {id:'ai-import',icon:'AI',title:'AI作曲データ取り込み',description:'AI作曲サービスの出力を確認して複製取り込みします。',status:'planned'},
    {id:'instrument-midi',icon:'Pf',title:'楽器別MIDI',description:'パートと楽器ごとにMIDI素材を整理します。',status:'planned'},
    {id:'sounds-plugins',icon:'Fx',title:'音色・プラグイン管理',description:'使用する音色、プラグイン、プリセット情報を管理します。',status:'planned'},
    {id:'mixing',icon:'Mx',title:'ミックス支援',description:'元音声を保持したPCM音量処理とA/B比較を行います。AIミックスは部分実装です。',status:'working'},
    {id:'mastering',icon:'Ms',title:'マスタリング支援',description:'48kHz PCMのLUFS・True Peak測定、音量候補、採用・保存に対応します。部分実装です。',status:'working'},
    {id:'files',icon:'▤',title:'ファイル管理',description:'MIDI、音声、歌詞などの参照ファイルを整理します。',status:'planned'},
    {id:'backup',icon:'⇩',title:'バックアップ',description:'設定とプロジェクトを安全に書き出し・追加復元します。',status:'available'},
    {id:'settings',icon:'⚙',title:'Music Studio設定',description:'保存、自動保存、MIDI、Logic Pro X、表示と製品情報を管理します。',status:'available'},
    {id:'dream-architect',icon:'DA',title:'Dream Architect Studioへ戻る',description:'制作アプリをまとめるDream Architect Studioへ戻ります。',status:'available',action:'dream'},
    {id:'send-nova',icon:'N',title:'Nova Studioへ送る',description:'楽曲情報を自動登録せず、確認してNova Studioへ渡す入口です。',status:'working'}
  ];
  // Session-only bounded observations. No project/settings/Undo writes.
  const performanceMeasurements={};
  function performanceClock(){const t=root.performance?.now?.();return Number.isFinite(t)?t:Date.now()}
  function performanceMeasure(kind,operation){const start=performanceClock();let failed=true;try{const result=operation();failed=false;return result}finally{const end=performanceClock(),ms=end-start;if(Number.isFinite(ms)&&ms>=0){const b=performanceMeasurements[kind]||(performanceMeasurements[kind]=[]);b.push({ms,at:end,failed});if(b.length>64)b.shift()}}}
  function performanceMeasurementReport(){const out={};for(const [kind,rows] of Object.entries(performanceMeasurements)){out[kind]={unit:'ms',scope:'直近64回以内・この起動中の実処理',count:rows.length,failed:rows.filter(r=>r.failed).length,lastMs:rows.at(-1).ms,maxMs:Math.max(...rows.map(r=>r.ms)),meanMs:rows.reduce((n,r)=>n+r.ms,0)/rows.length,lastObservedAt:rows.at(-1).at}}return out}
  const state={projects:[],loaded:false,notice:'',noticeKind:'info',search:'',dirty:false,currentDraft:null,settings:null,settingsDraft:null,saveStatus:'saved',saveSequence:0,savedSequence:0,editGeneration:0,autosaveTimer:null,intervalTimer:null,backupPreview:null,autoBackups:[],midiExportHistory:[],midiImportHistory:[],midiExportPreview:null,midiImportPreview:null,midiExporting:false,midiImporting:false,externalSongImport:null,externalSongImporting:false,lastMidiExport:null,midiEditor:null,partialEditSession:null,midiAddNoteSequence:{session:null,part:'',noteIds:[]},midiEditorSaveTimer:null,midiEditorViewSaveTimer:null,midiEditorSaveInFlight:false,midiEditorSaveRequested:false,midiEditorSavePromise:null,midiInput:{initialized:false,supported:null,access:null,inputs:[],boundInputs:[],inputSignature:'',selectedId:'',targetPart:'melody',messageGate:null,recorder:null,recording:false,recordingPart:null,recordingTrackId:null,startToken:0,inputToken:0,starting:false,stopping:false,countingIn:false,countInBeat:0,countInToken:0,countInTimer:null,countInResolve:null,countInAdapter:null,recordRequestedAt:0,countInStartedAt:0,recordingScheduledAt:0,recordingActivatedAt:0,recordingFrame:null,recordingStartedAt:0,recordingStartTick:0,recordingPlayback:null,liveNotes:[],liveNoteSequence:0,status:''},melodyAudio:{synth:null,playing:false,starting:false,playRequest:0,playbackTimer:null,playbackFrame:null,metronomeToken:0,metronomeTimer:null,playbackState:{mutedByTrackId:{},soloByTrackId:{}},transport:null,status:''}};

  state.partialEditProvider={provider:'openai',model:'',intent:'simpler',text:'',status:'idle',errorCode:'',runId:0};
  state.externalTrackAssignmentDraft=null;

  function defaultSettings(timestamp=now()){return{
    id:SETTINGS_ID,format:SETTINGS_FORMAT,version:SETTINGS_VERSION,createdAt:timestamp,updatedAt:timestamp,appVersion:APP_VERSION,
    general:{language:'ja',dateFormat:'ja-JP',confirmDialogs:true,notifications:true,confirmDangerousActions:true},
    projectDefaults:{bpm:120,timeSignature:'4/4',key:null,status:'idea',purpose:'',notes:''},
    autosave:{enabled:true,intervalSeconds:60,idleDelaySeconds:3,manualSave:true},
    midi:{fileType:1,ppq:480,autoChannel:true,useTrackNames:true,includeTempo:true,includeTimeSignature:true,omitEmptyTracks:true,quantize:'1/16',velocity:100,channel:1},
    logicPro:{method:'file-export',preferMidi:true,audioReferences:'external',autoLaunch:false,directControl:false,showInstructions:true,intelSafe:true},
    fileNaming:{template:'{projectName}_{type}_{date}',maxLength:120,fallback:'music-studio'},
    backup:{manualEnabled:true,automaticEnabled:false,intervalHours:24,maxCopies:10,showScope:true,confirmRestore:true,safetyCopyBeforeRestore:true},
    display:{theme:'music-studio',fontSize:'standard',cardDensity:'standard',reducedMotion:'system'},
    workspace:{mode:'compose',favorites:[]},
    accessibility:{focusVisible:true,keyboard:true,textStatus:true},
    privacy:{externalTransfer:false,usageData:false,analytics:false,cloudSync:false,localOnly:true},
    experimental:{enabled:false,features:{}}
  }}
  function clampNumber(value,min,max,fallback,integer=false){const number=Number(value);if(!Number.isFinite(number))return fallback;const safe=Math.min(max,Math.max(min,number));return integer?Math.round(safe):safe}
  function mergeKnown(base,input){if(!input||typeof input!=='object'||Array.isArray(input))return clone(base);const result=clone(base);for(const key of Object.keys(base)){if(input[key]===undefined)continue;if(base[key]&&typeof base[key]==='object'&&!Array.isArray(base[key]))result[key]=mergeKnown(base[key],input[key]);else result[key]=input[key]}return result}
  function normalizeSettings(input={},timestamp=now()){
    const base=defaultSettings(input.createdAt||timestamp),value=mergeKnown(base,input);
    value.id=SETTINGS_ID;value.format=SETTINGS_FORMAT;value.version=SETTINGS_VERSION;value.appVersion=APP_VERSION;
    value.createdAt=typeof input.createdAt==='string'&&!Number.isNaN(Date.parse(input.createdAt))?input.createdAt:timestamp;value.updatedAt=typeof input.updatedAt==='string'&&!Number.isNaN(Date.parse(input.updatedAt))?input.updatedAt:timestamp;
    value.projectDefaults.bpm=clampNumber(value.projectDefaults.bpm,20,400,120);
    value.workspace=normalizeWorkspace(value.workspace);
    if(!/^(?:[1-9]|1[0-6])\/(?:1|2|4|8|16|32)$/.test(String(value.projectDefaults.timeSignature)))value.projectDefaults.timeSignature='4/4';
    const keys=[null,'C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B','Cm','C#m','Dbm','Dm','D#m','Ebm','Em','Fm','F#m','Gbm','Gm','G#m','Abm','Am','A#m','Bbm','Bm'];if(!keys.includes(value.projectDefaults.key))value.projectDefaults.key=null;
    if(!Object.keys(PROJECT_STATUS_LABELS).includes(value.projectDefaults.status))value.projectDefaults.status='idea';
    value.projectDefaults.purpose=String(value.projectDefaults.purpose||'').slice(0,240);value.projectDefaults.notes=String(value.projectDefaults.notes||'').slice(0,10000);
    value.autosave.intervalSeconds=clampNumber(value.autosave.intervalSeconds,15,3600,60,true);value.autosave.idleDelaySeconds=clampNumber(value.autosave.idleDelaySeconds,1,30,3,true);
    value.midi.fileType=[0,1].includes(Number(value.midi.fileType))?Number(value.midi.fileType):1;value.midi.ppq=clampNumber(value.midi.ppq,24,9600,480,true);value.midi.velocity=clampNumber(value.midi.velocity,1,127,100,true);value.midi.channel=clampNumber(value.midi.channel,1,16,1,true);
    if(!['1/4','1/8','1/16','1/32'].includes(value.midi.quantize))value.midi.quantize='1/16';
    value.backup.intervalHours=clampNumber(value.backup.intervalHours,1,720,24,true);value.backup.maxCopies=clampNumber(value.backup.maxCopies,1,100,10,true);
    value.fileNaming.maxLength=clampNumber(value.fileNaming.maxLength,20,200,120,true);value.fileNaming.fallback=safeFileName(value.fileNaming.fallback||'music-studio');
    value.fileNaming.template=String(value.fileNaming.template||base.fileNaming.template).slice(0,200);if(!/\{(?:projectName|songTitle|date|time|version|type)\}/.test(value.fileNaming.template))value.fileNaming.template=base.fileNaming.template;
    for(const group of ['general','autosave','midi','logicPro','backup','accessibility','privacy'])for(const key of Object.keys(value[group]))if(typeof base[group][key]==='boolean')value[group][key]=value[group][key]===true;
    value.logicPro.autoLaunch=false;value.logicPro.directControl=false;value.privacy.externalTransfer=false;value.privacy.usageData=false;value.privacy.analytics=false;value.privacy.cloudSync=false;value.privacy.localOnly=true;value.experimental.enabled=false;value.experimental.features={};return value
  }
  function validateSettings(value){const errors=[];if(!value||typeof value!=='object'||Array.isArray(value))return{valid:false,errors:['JSONのルートがオブジェクトではありません。']};if(value.format!==SETTINGS_FORMAT)errors.push(`形式は ${SETTINGS_FORMAT} である必要があります。`);if(value.version!==SETTINGS_VERSION)errors.push(`Version ${value.version??'未設定'} には対応していません。`);return{valid:errors.length===0,errors}}

  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function uuid(){return root.crypto?.randomUUID?.()||`ms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`}
  function now(){return new Date().toISOString()}
  function clone(value){return JSON.parse(JSON.stringify(value))}
  function formatBpmDisplay(value){const bpm=Number(value);return Number.isFinite(bpm)?String(Number(bpm.toFixed(3))):String(value??'')}
  function normalizeProjectTempoMap(items=[],initialTempo=120){if(root.MusicStudioEditor?.normalizeTempoMap)return root.MusicStudioEditor.normalizeTempoMap(items,initialTempo);const bpm=Number(initialTempo)||120,byTick=new Map();for(const item of Array.isArray(items)?items:[]){const tick=Math.round(Number(item?.tick)),value=Number(item?.bpm);if(Number.isInteger(tick)&&tick>=0&&Number.isFinite(value)&&value>=20&&value<=400)byTick.set(tick,{...clone(item),tick,bpm:value,microsecondsPerQuarter:Math.round(60000000/value),track:Number.isInteger(Number(item?.track))?Number(item.track):0})}byTick.set(0,{tick:0,bpm,microsecondsPerQuarter:Math.round(60000000/bpm),track:byTick.get(0)?.track??0});return[...byTick.values()].sort((a,b)=>a.tick-b.tick)}
  function safeStorage(){try{return root.localStorage||null}catch(_){return null}}
  function setLastProject(id){try{const storage=safeStorage();if(id)storage?.setItem(LAST_PROJECT_KEY,id);else storage?.removeItem(LAST_PROJECT_KEY)}catch(error){console.warn('Music Studio: last project could not be saved',error)}}
  function getLastProject(){try{return safeStorage()?.getItem(LAST_PROJECT_KEY)||''}catch(_){return ''}}
  function makeProject(input={},timestamp=now()){
    const defaults=state.settings?.projectDefaults||defaultSettings(timestamp).projectDefaults;
    const bpm=Number(input.bpm??input.musicalSettings?.bpm??defaults.bpm);
    const existingSignature=input.musicalSettings?.timeSignature;const signature=String(input.timeSignature||(existingSignature?`${existingSignature.numerator}/${existingSignature.denominator}`:defaults.timeSignature)).split('/').map(Number);
    const defaultSignature=String(defaults.timeSignature).split('/').map(Number);
    const project={
      format:FORMAT,schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,projectId:input.projectId||uuid(),revision:Number(input.revision)||1,
      projectName:String(input.projectName||'').trim(),songTitle:String(input.songTitle||'').trim(),purpose:String(input.purpose??defaults.purpose??'').trim(),status:input.status||defaults.status,
      musicalSettings:{bpm,timeSignature:{numerator:signature[0]||defaultSignature[0]||4,denominator:signature[1]||defaultSignature[1]||4},key:input.key===''?null:(input.key??input.musicalSettings?.key??defaults.key),bars:input.musicalSettings?.bars??null},
      productionNotes:String(input.productionNotes??input.notes??defaults.notes??'').trim(),sections:[],chordProgressions:[],melodies:[],instruments:[],midiAssets:[],audioAssets:[],
      lyrics:{versions:[],activeVersionId:null},syllableAssignments:[],soundSelections:[],plugins:[],mixNotes:[],masteringNotes:[],productionHistory:[],
      fileReferences:Array.isArray(input.fileReferences)?clone(input.fileReferences):[],integrations:{dreamArchitect:[],novaStudio:[],logicPro:[]},
      legacy:{sourceFormat:null,sourceVersion:null,extensions:{}},createdAt:input.createdAt||timestamp,updatedAt:input.updatedAt||timestamp
    };
    const preserve=['sections','chordProgressions','melodies','instruments','midiAssets','audioAssets','lyrics','syllableAssignments','soundSelections','plugins','mixNotes','masteringNotes','productionHistory','integrations','legacy','midiData','importSource','aiWorkspace','pcmMix','finalExportPlan','finalExportHistory','finalExportDeliveries','vocalWorkspace','longWavAssets','longMasterWorkspace','vocalInputProfiles','instrumentLibrary','logicInstruments','songVersions','vocalReplacement','vocalComp','materialLibrary'];
    preserve.forEach(key=>{if(input[key]!=null)project[key]=clone(input[key])});
    return project;
  }
  // One ingress contract for Project JSON, metadata backups and full archives.
  // Legacy note/start/duration aliases are validated without rewriting opaque data.
  // Empty audio-only stem placeholders historically used channel 0; preserve them.
  function validateRestoredMidi(p){
    const errors=[],warnings=[],prefix='MIDI',object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
    if(Object.hasOwn(p,'midiData')){
      const m=p.midiData;
      if(!object(m)){errors.push(`${prefix}: malformed-midi`)}else{
        if(m.version!==undefined&&m.version!==1)errors.push(`${prefix}: unsupported-midi-version`);
        if(m.ppq!==undefined&&!integer(m.ppq,24,32767))errors.push(`${prefix}: invalid-midi-ppq`);
        if(m.tempo!==undefined&&(!Number.isFinite(m.tempo)||m.tempo<20||m.tempo>400))errors.push(`${prefix}: invalid-midi-tempo`);
        if(m.timeSignature!==undefined&&(!integer(m.timeSignature?.numerator,1,255)||![1,2,4,8,16,32].includes(m.timeSignature?.denominator)))errors.push(`${prefix}: invalid-midi-signature`);
        if(m.totalTick!==undefined&&!integer(m.totalTick,0,0x0fffffff))errors.push(`${prefix}: invalid-midi-length`);
        if(m.tracks===undefined)warnings.push(`${prefix}: legacy-midi-without-tracks`);else if(!Array.isArray(m.tracks))errors.push(`${prefix}: malformed-midi-tracks`);
        const ids=new Set();
        for(const t of Array.isArray(m.tracks)?m.tracks:[]){
          if(!object(t)||!Array.isArray(t.notes)){errors.push(`${prefix}: malformed-midi-track`);continue}
          if(t.id!==undefined){if(typeof t.id!=='string'||!t.id||ids.has(t.id))errors.push(`${prefix}: invalid-midi-track-id`);ids.add(t.id)}else warnings.push(`${prefix}: legacy-track-id`);
          if(t.channel!=null&&!(t.channel===0&&t.notes.length===0)&&!integer(t.channel,1,16))errors.push(`${prefix}: invalid-midi-channel`);
          if(t.program!=null&&!integer(t.program,0,127))errors.push(`${prefix}: invalid-midi-program`);
          for(const n of t.notes){
            if(!object(n)){errors.push(`${prefix}: malformed-midi-note`);continue}
            const start=n.startTick??n.start,duration=n.durationTicks??n.duration,pitch=n.pitch??n.note;
            if(!integer(pitch,0,127)||!integer(start,0,0x0fffffff)||!integer(duration,1,0x0fffffff)||start+duration>0x0fffffff||(n.velocity!==undefined&&!integer(n.velocity,1,127)))errors.push(`${prefix}: invalid-midi-note`);
            if(m.totalTick!==undefined&&start+duration>m.totalTick)errors.push(`${prefix}: midi-note-after-end`);
          }
        }
        for(const field of ['tempoMap','timeSignatureMap','keySignatureMap']){
          if(m[field]!==undefined&&!Array.isArray(m[field])){errors.push(`${prefix}: malformed-${field}`);continue}
          for(const item of m[field]||[]){
            if(!object(item)||!integer(item.tick,0,0x0fffffff)||(m.totalTick!==undefined&&item.tick>m.totalTick)){errors.push(`${prefix}: invalid-${field}`);continue}
            if(field==='tempoMap'){const bpm=item.bpm??(60000000/item.microsecondsPerQuarter);if(!Number.isFinite(bpm)||bpm<20||bpm>400)errors.push(`${prefix}: invalid-tempoMap`)}
            if(field==='timeSignatureMap'&&(!integer(item.numerator,1,255)||![1,2,4,8,16,32].includes(item.denominator)))errors.push(`${prefix}: invalid-timeSignatureMap`);
            if(field==='keySignatureMap'&&(!integer(item.sharps,-7,7)||![true,false,0,1].includes(item.minor)))errors.push(`${prefix}: invalid-keySignatureMap`);
          }
        }
      }
    }
    return{errors,warnings};
  }
  function validateProject(value){
    const errors=[];
    if(!value||typeof value!=='object'||Array.isArray(value))return{valid:false,errors:['JSONのルートがオブジェクトではありません。']};
    if(value.materialLibrary!==undefined)try{materialValidate(value.materialLibrary)}catch(e){errors.push(e.message)}
    if(value.songVersions!==undefined)try{versionValidate(value)}catch(e){errors.push(e.message)}
    if(value.format!==FORMAT)errors.push(`形式は ${FORMAT} である必要があります。`);
    if(value.vocalInputProfiles!==undefined)try{vocalInputProfiles(value)}catch(e){errors.push(e.message)}
    if(value.vocalWorkspace!==undefined)try{vocalWorkspace(value)}catch(e){errors.push(e.message)}
    if(value.longMasterWorkspace!==undefined)try{longMasterWorkspaceState(value)}catch(e){errors.push(e.message)}
    if(value.finalExportPlan)try{finalPlan(value,value.finalExportPlan)}catch(e){errors.push(e.message)}
    if(value.finalExportHistory!==undefined&&(!Array.isArray(value.finalExportHistory)||value.finalExportHistory.length>100))errors.push('final-history-invalid');
    if(value.finalExportDeliveries!==undefined)try{finalDeliveryValidate(value.finalExportDeliveries)}catch(e){errors.push(e.message)}
    if(value.schemaVersion!==SCHEMA_VERSION)errors.push(`schemaVersion ${value.schemaVersion||'未設定'} には対応していません。`);
    if(typeof value.projectName!=='string'||!value.projectName.trim())errors.push('プロジェクト名は必須です。');
    if(typeof value.projectId!=='string'||!value.projectId.trim())errors.push('projectIdは必須です。');
    if(!Number.isInteger(value.revision)||value.revision<1)errors.push('revisionは1以上の整数である必要があります。');
    const bpm=Number(value.musicalSettings?.bpm);
    if(!Number.isFinite(bpm)||bpm<20||bpm>400)errors.push('BPMは20〜400で入力してください。');
    const ts=value.musicalSettings?.timeSignature;
    if(!Number.isInteger(ts?.numerator)||ts.numerator<1||![1,2,4,8,16,32].includes(ts?.denominator))errors.push('拍子が正しい形式ではありません。');
    if(Object.hasOwn(value,'aiWorkspace')){const checked=root.MusicStudioAIWorkflow?.validateWorkspace?.(value.aiWorkspace);if(!checked?.ok)errors.push('AI制作データのVersionまたは形式に対応していません。');else if(value.aiWorkspace.projectId!==value.projectId||value.aiWorkspace.baseRevision!==value.revision)errors.push('AI制作データがProject revisionと一致しません。')}
    for(const track of Array.isArray(value.midiData?.tracks)?value.midiData.tracks:[]){const b=track?.sampleInstrument;if(b?.version!==undefined){try{if(!root.MusicStudioInstruments)throw Error('instrument-module-unavailable');root.MusicStudioInstruments.normalize(b)}catch(e){errors.push(e.message)}}else if(b!==undefined&&(typeof b?.assetId!=='string'||!b.assetId||!Number.isInteger(b.rootPitch)||b.rootPitch<0||b.rootPitch>127))errors.push('invalid-instrument-binding')}
    if(value.logicInstruments!==undefined)try{if(!root.NovaLogicInstruments)throw Error('logic-instrument-module-unavailable');root.NovaLogicInstruments.workspace(value)}catch(e){errors.push(e.message)}
    if(value.instrumentLibrary!==undefined)try{if(!root.MusicStudioInstruments)throw Error('instrument-module-unavailable');root.MusicStudioInstruments.library(value.instrumentLibrary)}catch(e){errors.push(e.message)}
    if(Object.hasOwn(value,'pcmMix'))try{pcmMixValidate(value.pcmMix)}catch(e){errors.push(e.message)}
    if(value.vocalReplacement!==undefined)try{vocalReplacementHistory(value)}catch(e){errors.push(e.message)}
    if(value.vocalComp!==undefined)try{vocalCompHistory(value)}catch(e){errors.push(e.message)}
    if(Array.isArray(value.longWavAssets))for(const asset of value.longWavAssets){if(asset?.vocalTake)try{vocalHistory(asset)}catch(e){errors.push(e.message)}if(asset?.mixVersions!==undefined)try{longMixVersionsValidate(asset)}catch(e){errors.push(e.message)}}
    for(const field of ['createdAt','updatedAt'])if(typeof value[field]!=='string'||Number.isNaN(Date.parse(value[field])))errors.push(`${field}はISO 8601日時である必要があります。`);
    return{valid:errors.length===0,errors};
  }
  // Explicit song checkpoints are separate from autosave and the MIDI edit stack.
  // Snapshots never contain this ledger, so archives have a bounded, flat graph.
  const VERSION_FORMAT='nova-song-checkpoints-v1';
  const VERSION_GROUPS={
    music:['musicalSettings','sections','chordProgressions','melodies','instruments','midiAssets','lyrics','syllableAssignments','soundSelections','plugins','midiData','importSource','aiWorkspace','instrumentLibrary','logicInstruments'],
    audio:['audioAssets','fileReferences','pcmMix','longWavAssets','vocalWorkspace','vocalReplacement','vocalComp','vocalInputProfiles','longMasterWorkspace','mixNotes','masteringNotes','finalExportPlan'],
    notes:['productionNotes'],
    details:['projectName','songTitle','purpose','status']
  };
  const AUTOMATIC_EDIT_SOURCES={
    'midi-editor':'MIDI編集','project-editor':'プロジェクト編集','lyrics-editor':'歌詞編集','audio-editor':'音声編集','vocal-editor':'歌声編集','instrument-editor':'楽器設定','final-export':'完成書き出し','material-library':'MIDI素材','dependency-recovery':'元ファイル復旧','checkpoint-history':'候補版の採用・Undo・Redo'
  };
  const versionPanel={open:false,busy:false,draft:null,preview:null,message:'',generation:0,abort:null};
  const versionProof=new WeakMap();
  function versionSnapshot(p){const s=clone(p);delete s.songVersions;return s}
  function versionSnapshots(p){const v=p.songVersions;if(!v)return[];return[...v.checkpoints.map(c=>c.snapshot),...v.operations.flatMap(o=>[o.before,o.after])]}
  function versionValidate(p){
    const v=p.songVersions;if(v===undefined)return;
    if(v?.format!==VERSION_FORMAT||!Array.isArray(v.checkpoints)||v.checkpoints.length>32||!Array.isArray(v.operations)||v.operations.length>32||!Array.isArray(v.path)||v.path.length>32||!Number.isInteger(v.cursor)||v.cursor<0||v.cursor>v.path.length)throw Error('checkpoint-ledger-invalid');
    if(v.checkpoints.some(c=>c.kind!==undefined&&!['working','finished'].includes(c.kind)))throw Error('checkpoint-kind-invalid');
    if(v.fork!==undefined&&(!v.fork||typeof v.fork.sourceProjectId!=='string'||!v.fork.sourceProjectId||!v.checkpoints.some(c=>c.id===v.fork.checkpointId&&c.kind==='finished')||typeof v.fork.createdAt!=='string'||Number.isNaN(Date.parse(v.fork.createdAt))))throw Error('finished-fork-provenance-invalid');
    if(v.days!==undefined){
      if(!Array.isArray(v.days)||v.days.length>512)throw Error('production-day-capacity');const ids=new Set();
      for(const d of v.days){if(!d||typeof d.id!=='string'||!d.id||ids.has(d.id)||typeof d.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.day)||Number.isNaN(Date.parse(d.day))||new Date(d.day).toISOString().slice(0,10)!==d.day||typeof d.createdAt!=='string'||Number.isNaN(Date.parse(d.createdAt))||typeof d.note!=='string'||!d.note.trim()||d.note.length>2000||!Number.isSafeInteger(d.revision)||d.revision<1||d.sessionId!==undefined&&!v.sessions?.some(e=>e.id===d.sessionId))throw Error('production-day-invalid');ids.add(d.id)}
    }
    if(v.sessions!==undefined){
      if(!Array.isArray(v.sessions)||v.sessions.length>256)throw Error('production-session-capacity');
      const sessionIds=new Set();
      for(const e of v.sessions){
        if(!e||typeof e.id!=='string'||!e.id||sessionIds.has(e.id)||typeof e.startedAt!=='string'||Number.isNaN(Date.parse(e.startedAt))||typeof e.note!=='string'||e.note.length>2000||!Number.isSafeInteger(e.startRevision)||e.startRevision<1)throw Error('production-session-invalid');
        sessionIds.add(e.id);if(e.endNote!==undefined&&(typeof e.endNote!=='string'||e.endNote.length>2000))throw Error('production-session-note-invalid');
        if(e.endedAt!==undefined&&(typeof e.endedAt!=='string'||Number.isNaN(Date.parse(e.endedAt))||Date.parse(e.endedAt)<Date.parse(e.startedAt)||!Number.isSafeInteger(e.endRevision)||e.endRevision<e.startRevision))throw Error('production-session-end-invalid');
      }
      if(v.sessions.filter(e=>e.endedAt===undefined).length>1)throw Error('production-session-already-open');
    }
    if(v.edits!==undefined){
      if(!Array.isArray(v.edits)||v.edits.length>512)throw Error('production-edit-capacity');
      const editIds=new Set();
      for(const e of v.edits){
        if(!e||typeof e.id!=='string'||!e.id||editIds.has(e.id)||typeof e.createdAt!=='string'||Number.isNaN(Date.parse(e.createdAt))||!Number.isSafeInteger(e.revision)||e.revision<1||!Object.hasOwn(AUTOMATIC_EDIT_SOURCES,e.source)||!Array.isArray(e.groups)||!e.groups.length||e.groups.length>4||new Set(e.groups).size!==e.groups.length||e.groups.some(group=>!Object.hasOwn(VERSION_GROUPS,group))||e.sessionId!==undefined&&!v.sessions?.some(session=>session.id===e.sessionId))throw Error('production-edit-invalid');
        editIds.add(e.id);
      }
    }
    const ids=new Set();
    for(const item of [...v.checkpoints,...v.operations]){if(typeof item.id!=='string'||!item.id||ids.has(item.id)||typeof item.createdAt!=='string'||Number.isNaN(Date.parse(item.createdAt)))throw Error('checkpoint-entry-invalid');ids.add(item.id)}
    if(v.operations.some(o=>!Array.isArray(o.groups)||!o.groups.length||new Set(o.groups).size!==o.groups.length||o.groups.some(k=>!Object.hasOwn(VERSION_GROUPS,k))||!v.checkpoints.some(c=>c.id===o.checkpointId)))throw Error('checkpoint-operation-invalid');
    if(v.operations.some(o=>o.scope&&(!Number.isSafeInteger(o.scope.startMeasure)||!Number.isSafeInteger(o.scope.endMeasure)||o.scope.startMeasure<1||o.scope.endMeasure<o.scope.startMeasure||o.scope.endMeasure>10000||typeof o.scope.trackId!=='string'||!o.scope.trackId||o.groups.length!==1||o.groups[0]!=='music')))throw Error('checkpoint-operation-range-invalid');
    if(v.checkpoints.some(c=>c.sourceRevision!==c.snapshot?.revision||typeof c.name!=='string'||!c.name.trim()||c.name.length>120))throw Error('checkpoint-name-invalid');
    if(v.operations.some(o=>o.sessionId!==undefined&&!v.sessions?.some(e=>e.id===o.sessionId)))throw Error('checkpoint-operation-session-missing');
    if(v.checkpoints.some(c=>c.sessionId!==undefined&&!v.sessions?.some(e=>e.id===c.sessionId)))throw Error('checkpoint-session-missing');
    if(new Set(v.path).size!==v.path.length||v.path.some(id=>!v.operations.some(o=>o.id===id)))throw Error('checkpoint-path-invalid');
    for(const s of versionSnapshots(p)){
      if(!s||Object.hasOwn(s,'songVersions')||s.projectId!==p.projectId||!validateProject(s).valid)throw Error('checkpoint-snapshot-invalid');
      const preflight=restorePreflight({format:BACKUP_FORMAT,version:BACKUP_VERSION,projects:[s]},{settings:false});
      if(preflight.errors.some(e=>!e.endsWith('long-wav-binary-backup-not-supported')))throw Error('checkpoint-snapshot-data-invalid');
    }
    if(pcmJsonBytes(p)>PCM_JSON_LIMIT)throw Error('checkpoint-project-capacity');
  }
  // Every replacement write checks the durable previous row inside the same
  // transaction. A stale editor must never erase or rewrite a finished receipt.
  function preserveFinishedSnapshots(previous,next){
    for(const saved of previous?.songVersions?.checkpoints||[]){
      if(saved.kind!=='finished')continue;
      const matches=next?.songVersions?.checkpoints?.filter(c=>c.id===saved.id)||[];
      if(matches.length!==1||JSON.stringify(matches[0])!==JSON.stringify(saved))throw Error('finished-snapshot-immutable');
    }
  }
  function versionLedger(p){versionValidate(p);return clone(p.songVersions||{format:VERSION_FORMAT,checkpoints:[],operations:[],path:[],cursor:0})}
  function versionRebind(p,suffix=''){for(const s of versionSnapshots(p)){s.projectId=p.projectId;if(suffix)s.projectName+=suffix;if(s.aiWorkspace)s.aiWorkspace=rebindAIWorkspace(s.aiWorkspace,s.projectId,s.revision)}return p}
  function versionContent(p){const s=versionSnapshot(p);delete s.revision;delete s.updatedAt;delete s.createdAt;delete s.projectId;delete s.finalExportHistory;delete s.finalExportDeliveries;if(s.aiWorkspace){delete s.aiWorkspace.baseRevision;delete s.aiWorkspace.updatedAt}return JSON.stringify(s)}
  function versionTouch(p){p.revision++;p.updatedAt=now();if(p.aiWorkspace)p.aiWorkspace=rebindAIWorkspace(p.aiWorkspace,p.projectId,p.revision);return p}
  function automaticEditRecord(previous,next,source='midi-editor'){
    if(!Object.hasOwn(AUTOMATIC_EDIT_SOURCES,source)||!previous||!next||previous.projectId!==next.projectId||!Number.isSafeInteger(next.revision)||next.revision<=previous.revision)throw Error('production-edit-input-invalid');
    const comparable=(project,field)=>{const value=project[field]===undefined?undefined:clone(project[field]);if(field==='aiWorkspace'&&value){delete value.baseRevision;delete value.updatedAt}return JSON.stringify(value)};
    const groups=Object.entries(VERSION_GROUPS).filter(([,fields])=>fields.some(field=>comparable(previous,field)!==comparable(next,field))).map(([group])=>group);
    // Export-only saves can change receipts/history without changing the recipe.
    // Keep these append-only records outside checkpoint adoption, but include
    // their publication in the session's automatic production timeline.
    if(source==='final-export'&&['finalExportHistory','finalExportDeliveries'].some(field=>comparable(previous,field)!==comparable(next,field))&&!groups.includes('audio'))groups.push('audio');
    // Material publication belongs to the production timeline, while checkpoint
    // adoption continues to leave the reusable library untouched.
    if(source==='material-library'&&comparable(previous,'materialLibrary')!==comparable(next,'materialLibrary')&&!groups.includes('music'))groups.push('music');
    // Restoring missing bytes changes availability without changing descriptors.
    if(source==='dependency-recovery'&&!groups.includes('audio'))groups.push('audio');
    if(!groups.length)return next;
    const ledger=versionLedger(next),edits=ledger.edits||(ledger.edits=[]);if(edits.length>=512)edits.splice(0,edits.length-511);
    const active=ledger.sessions?.find(session=>session.endedAt===undefined);
    edits.push({id:uuid(),createdAt:next.updatedAt,revision:next.revision,source,groups,...(active?{sessionId:active.id}:{})});next.songVersions=ledger;versionValidate(next);return next;
  }
  function versionCapture(p,name,kind='working'){
    if(!['working','finished'].includes(kind))throw Error('checkpoint-kind-invalid');
    const v=versionLedger(p);name=String(name||'').trim();if(!name||name.length>120)throw Error('checkpoint-name-invalid');if(v.checkpoints.length>=32)throw Error('checkpoint-capacity-backup-required');
    const next=clone(p);v.checkpoints.push({id:uuid(),name,kind,...(v.sessions?.find(e=>!e.endedAt)?{sessionId:v.sessions.find(e=>!e.endedAt).id}:{}),createdAt:now(),sourceRevision:p.revision,snapshot:versionSnapshot(p)});next.songVersions=v;versionTouch(next);versionValidate(next);return next;
  }
  function versionCompare(p,checkpointId){
    const c=versionLedger(p).checkpoints.find(c=>c.id===checkpointId);if(!c)throw Error('checkpoint-not-found');
    const groups=Object.entries(VERSION_GROUPS).map(([key,fields])=>({key,fields:fields.filter(f=>JSON.stringify(p[f])!==JSON.stringify(c.snapshot[f]))}));
    return{id:c.id,name:c.name,createdAt:c.createdAt,sourceRevision:c.sourceRevision,groups};
  }
  function versionRangeCompose(p,source,scope){
    if(!scope||typeof scope.trackId!=='string'||!scope.trackId||!Number.isSafeInteger(scope.startMeasure)||!Number.isSafeInteger(scope.endMeasure)||scope.startMeasure<1||scope.endMeasure<scope.startMeasure||scope.endMeasure>10000)throw Error('checkpoint-range-invalid');
    if(!root.MusicStudioMeterMap)throw Error('checkpoint-meter-unavailable');
    // Retain all musical dependencies. A range is only portable when their
    // meanings agree; linked scores/candidates require the existing bundle path.
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    for(const field of [...VERSION_GROUPS.music.filter(f=>f!=='midiData'),...VERSION_GROUPS.audio]){
      let a=p[field],b=source[field];if(field==='aiWorkspace'&&a&&b){a=clone(a);b=clone(b);delete a.baseRevision;delete b.baseRevision;delete a.updatedAt;delete b.updatedAt}
      if(!same(a,b))throw Error('checkpoint-range-dependency-conflict:'+field);
    }
    // Identical text-only lyrics and harmonic context do not bind note IDs.
    // Assigned scores, rendered vocals and AI workspaces still require a bundle.
    for(const field of ['aiWorkspace','vocalWorkspace','syllableAssignments','melodies']){
      const value=p[field];if(Array.isArray(value)?value.length:Boolean(value))throw Error('checkpoint-range-linked-score-use-bundle:'+field);
    }
    const current=p.midiData,old=source.midiData;
    if(!Array.isArray(current?.tracks)||!Array.isArray(old?.tracks))throw Error('checkpoint-range-midi-missing');
    const metadata=data=>{const x=clone(data);delete x.tracks;return x};
    if(!same(metadata(current),metadata(old)))throw Error('checkpoint-range-timeline-conflict');
    const tracks=data=>data.tracks.filter(t=>t.id===scope.trackId),a=tracks(current),b=tracks(old);
    if(a.length!==1||b.length!==1||!Array.isArray(a[0].notes)||!Array.isArray(b[0].notes))throw Error('checkpoint-range-track-missing-or-ambiguous');
    const trackMeta=t=>{const x=clone(t);delete x.notes;return x};
    if(!same(trackMeta(a[0]),trackMeta(b[0])))throw Error('checkpoint-range-track-settings-conflict');
    const range=root.MusicStudioMeterMap.rangeToTicks(current,scope.startMeasure,scope.endMeasure);
    const editor=current.editor||{};
    if(editor.measureLocks||editor.lockedMeasures?.length||Object.values(editor.trackStates||{}).some(x=>x.lockedMeasures?.length)||Object.values(editor.parts||{}).some(x=>x.lockedMeasures?.length)){
      if(!root.MusicStudioMeasureLocks?.protectedRanges||!root.MusicStudioEditor)throw Error('checkpoint-range-measure-lock-use-editor');
      let protectedRanges;try{protectedRanges=root.MusicStudioMeasureLocks.protectedRanges(current,root.MusicStudioEditor,scope.trackId)}catch(e){throw Error('checkpoint-range-lock-context:'+e.message)}
      if(protectedRanges.some(r=>r.startTick<range.endTick&&r.endTick>range.startTick))throw Error('checkpoint-range-measure-lock-use-editor');
    }
    if(a[0].locked||b[0].locked)throw Error('checkpoint-range-locked-track');
    const inside=n=>n.startTick>=range.startTick&&n.startTick<range.endTick;
    for(const track of [a[0],b[0]])for(const n of track.notes){
      if(n.startTick<range.endTick&&n.startTick+n.durationTicks>range.startTick&&(!inside(n)||n.startTick+n.durationTicks>range.endTick))throw Error('checkpoint-range-crossing-note');
      if(inside(n)&&(n.locked||n.protected))throw Error('checkpoint-range-locked-note');
    }
    const retained=a[0].notes.filter(n=>!inside(n)),adopted=b[0].notes.filter(inside),notes=[...retained,...clone(adopted)].sort((x,y)=>x.startTick-y.startTick||String(x.id).localeCompare(String(y.id)));
    if(notes.some(n=>typeof n.id!=='string'||!n.id)||new Set(notes.map(n=>n.id)).size!==notes.length)throw Error('checkpoint-range-note-identity-conflict');
    const next=clone(p);next.midiData.tracks.find(t=>t.id===scope.trackId).notes=notes;
    return{next,impact:{...clone(scope),...range,removedNotes:a[0].notes.filter(inside).length,adoptedNotes:adopted.length,retainedNotes:retained.length,retainedDependencies:['lyrics','chordProgressions',...VERSION_GROUPS.audio].filter(f=>p[f]!==undefined)}};
  }
  function versionCompose(p,checkpointId,groups,scope){
    const v=versionLedger(p),c=v.checkpoints.find(c=>c.id===checkpointId);
    if(!c||!Array.isArray(groups)||!groups.length||new Set(groups).size!==groups.length||groups.some(k=>!Object.hasOwn(VERSION_GROUPS,k)))throw Error('checkpoint-selection-invalid');
    // MIDI, lyrics, AI candidates and sound bindings move together. Cross-domain
    // adoption is refused when its source dependency domain has changed.
    const comparable=(p,f)=>{const v=p[f]===undefined?undefined:clone(p[f]);if(f==='aiWorkspace'&&v){delete v.baseRevision;delete v.updatedAt}return JSON.stringify(v)};
    const same=key=>VERSION_GROUPS[key].every(f=>comparable(p,f)===comparable(c.snapshot,f));
    if(groups.includes('music')&&!groups.includes('audio')&&!same('audio')||groups.includes('audio')&&!groups.includes('music')&&!same('music'))throw Error('checkpoint-select-music-and-audio-together');
    if(scope&&(groups.length!==1||groups[0]!=='music'))throw Error('checkpoint-range-select-music-only');
    const next=scope?versionRangeCompose(p,c.snapshot,scope).next:clone(p);if(!scope)for(const key of groups)for(const field of VERSION_GROUPS[key]){if(Object.hasOwn(c.snapshot,field))next[field]=clone(c.snapshot[field]);else delete next[field]}
    // A recalled workspace is bound to the current revision before the immutable
    // adoption-after snapshot is recorded, as well as to the published revision.
    if(next.aiWorkspace)next.aiWorkspace=rebindAIWorkspace(next.aiWorkspace,next.projectId,next.revision);
    if(versionContent(next)===versionContent(p))throw Error('checkpoint-no-changes');
    if(v.operations.length>=32)throw Error('checkpoint-history-capacity-backup-required');
    // Abandoned redo branches remain in operations and in complete backups.
    const active=v.sessions?.find(e=>e.endedAt===undefined);const entry={id:uuid(),createdAt:now(),checkpointId,...(active?{sessionId:active.id}:{}),groups:clone(groups),...(scope?{scope:clone(scope)}:{}),before:versionSnapshot(p),after:versionSnapshot(next)};
    v.operations.push(entry);v.path=v.path.slice(0,v.cursor);v.path.push(entry.id);v.cursor=v.path.length;next.songVersions=v;versionTouch(next);automaticEditRecord(p,next,'checkpoint-history');versionValidate(next);return next;
  }
  function versionStep(p,direction){
    if(![-1,1].includes(direction))throw Error('checkpoint-history-direction');
    const v=versionLedger(p),index=direction<0?v.cursor-1:v.cursor;if(index<0||index>=v.path.length)throw Error('checkpoint-history-boundary');
    const op=v.operations.find(o=>o.id===v.path[index]),expected=direction<0?op.after:op.before;
    if(versionContent(p)!==versionContent(expected))throw Error('checkpoint-history-conflict');
    const s=direction<0?op.before:op.after,next={...clone(s),revision:p.revision,createdAt:p.createdAt,songVersions:v};for(const field of ['finalExportHistory','finalExportDeliveries']){if(p[field]!==undefined)next[field]=clone(p[field]);else delete next[field]}v.cursor+=direction;versionTouch(next);automaticEditRecord(p,next,'checkpoint-history');versionValidate(next);return next;
  }
  function versionCancel(){finalStop();versionPanel.generation++;versionPanel.abort?.(Error('checkpoint-cancelled'));versionPanel.preview=null;versionPanel.draft=null;versionPanel.message='Checkpoint（操作を取り消しました）';requestPaint()}
  async function versionCommit(id,change,options={}){
    if(versionPanel.busy)return{ok:false,error:'checkpoint-busy'};
    const target=repository,p=state.projects.find(p=>p.projectId===id),baseline=JSON.stringify(p),token=versionPanel.generation;
    const guard=()=>{if(options.signal?.aborted||token!==versionPanel.generation||repository!==target||JSON.stringify(state.projects.find(p=>p.projectId===id))!==baseline||state.dirty||midiEditorHasPendingChanges()||state.midiInput.recording||state.midiInput.starting||state.midiInput.stopping||state.midiInput.countingIn||vocalBusy()||pcmEditor.busy||archiveTransfer.busy||finalExport.busy||shutdownPromise)throw Error('checkpoint-unsaved-busy-or-stale')};
    guard.registerAbort=a=>{versionPanel.abort=a};guard.clearAbort=()=>{versionPanel.abort=null};
    versionPanel.open=true;versionPanel.busy=true;requestPaint();const cancel=()=>versionPanel.abort?.(Error('checkpoint-cancelled'));options.signal?.addEventListener?.('abort',cancel,{once:true});
    try{
      guard();if(!p||!target.compareAndPut)throw Error('checkpoint-atomic-storage-required');
      const next=change(p);guard();const check=validateProject(next);if(!check.valid)throw Error(check.errors.join(';'));
      // Authenticate every retained checkpoint/history binary before publication.
      archiveValidateProjects([next]);
      for(const s of [next,...versionSnapshots(next)]){if(root.MusicStudioInstruments?.inventory(s).some(a=>a.missing))throw Error('checkpoint-instrument-dependency-missing')}
      editorStopMelody(false);pcmStop();longMixStop();vocalPlaybackStop();
      const binaries=[...new Map(archiveBinaries(next).map(a=>[a.id,a])).values()];
      for(const a of binaries){if(!target.getLongWav)throw Error('checkpoint-dependency-storage-required');const r=(options.binaryRecords||[]).find(r=>r.id===a.id)||await target.getLongWav(a.id);guard();if(!r?.blob||r.blob.size!==a.size||JSON.stringify(r.hashes)!==JSON.stringify(a.hashes)||JSON.stringify(await longWavDigest(r.blob,guard))!==JSON.stringify(a.hashes))throw Error('checkpoint-dependency-missing-or-corrupt: '+a.id)}
      await archiveCapacity(pcmJsonBytes(next),guard);guard();if(options.fork){if(!target.compareAndFork||next.projectId===id)throw Error('finished-fork-atomic-storage-required');await target.compareAndFork(next,id,baseline,guard,options.binaryRecords||[])}else await target.compareAndPut(next,baseline,guard);
      // The transaction is durable; a replacement view must keep its own state.
      if(repository!==target||token!==versionPanel.generation||state.dirty||midiEditorHasPendingChanges()||JSON.stringify(state.projects.find(p=>p.projectId===id))!==baseline)return{ok:true,committed:true,refreshPending:true,project:next};
      state.projects=options.fork?[...state.projects,next]:state.projects.map(p=>p.projectId===id?next:p);if(state.midiEditor?.projectId===id){state.midiEditor=null;cancelScheduledSave()}
      versionPanel.preview=null;finalInvalidate();versionPanel.message='Checkpoint（保存しました。元データと履歴は保持しています）';return{ok:true,project:next};
    }catch(e){versionPanel.message='Checkpoint：'+e.message;return{ok:false,error:e.message}}finally{options.signal?.removeEventListener?.('abort',cancel);versionPanel.busy=false;versionPanel.abort=null;requestPaint()}
  }
  async function versionSave(id,name,options){return versionCommit(id,p=>versionCapture(p,name,options?.kind||'working'),options)}
  function finishedFork(p,checkpointId){
    const c=finishedVersions(p).find(c=>c.id===checkpointId);if(!c)throw Error('finished-version-not-found');
    const next={...clone(c.snapshot),songVersions:versionLedger(p),projectId:uuid(),projectName:(c.snapshot.projectName+'（完成版から編集）').slice(0,200),createdAt:now(),updatedAt:now(),revision:p.revision};
    next.songVersions.fork={sourceProjectId:p.projectId,checkpointId:c.id,createdAt:now()};
    // Sessions belong to the source work. Retain its records, closing the copied
    // active record at the fork without changing the source's open session.
    for(const e of next.songVersions.sessions||[])if(!e.endedAt){e.endedAt=new Date(Math.max(Date.now(),Date.parse(e.startedAt))).toISOString();e.endRevision=p.revision}
    versionRebind(next);versionTouch(next);versionValidate(next);return next;
  }
  async function finishedOpen(id,checkpointId,options={}){const r=await versionCommit(id,p=>finishedFork(p,checkpointId),{...options,fork:true});if(r.ok&&!r.refreshPending){setLastProject(r.project.projectId);routeTo(`${EDIT_ROUTE}/${encodeURIComponent(r.project.projectId)}`)}return r}
  function finishedOpenSubmit(event,id){event.preventDefault();return finishedOpen(id,event.currentTarget.elements.finishedId.value)}
  function productionSessionChange(p,action,note=''){
    if(!['start','finish'].includes(action)||typeof note!=='string'||note.length>2000)throw Error('production-session-input-invalid');
    const v=versionLedger(p),sessions=v.sessions||(v.sessions=[]),active=sessions.find(e=>e.endedAt===undefined),next=clone(p),time=now();
    if(action==='start'){if(active)throw Error('production-session-already-open');if(sessions.length>=256)throw Error('production-session-capacity');sessions.push({id:uuid(),startedAt:time,startRevision:p.revision,note:note.trim()})}
    else{if(!active)throw Error('production-session-not-open');active.endedAt=new Date(Math.max(Date.parse(time),Date.parse(active.startedAt))).toISOString();active.endRevision=p.revision;active.endNote=note.trim()}
    next.songVersions=v;versionTouch(next);versionValidate(next);return next;
  }
  function productionDayChange(p,day,note){
    if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||typeof note!=='string'||!note.trim()||note.length>2000)throw Error('production-day-input-invalid');
    const v=versionLedger(p),days=v.days||(v.days=[]),active=v.sessions?.find(e=>!e.endedAt),next=clone(p);if(days.length>=512)throw Error('production-day-capacity');
    days.push({id:uuid(),day,note:note.trim(),createdAt:now(),revision:p.revision,...(active?{sessionId:active.id}:{})});next.songVersions=v;versionTouch(next);versionValidate(next);return next;
  }
  async function productionDaySave(id,day,note,options){return versionCommit(id,p=>productionDayChange(p,day,note),options)}
  async function productionDaySubmit(event,id){event.preventDefault();productionDraftChange(event,id);const f=event.currentTarget,r=await productionDaySave(id,f.elements.productionDay.value,f.elements.productionDayNote.value);if(r.ok&&!r.refreshPending&&versionPanel.productionDraft?.projectId===id){delete versionPanel.productionDraft.day;delete versionPanel.productionDraft.note;requestPaint()}return r}
  async function productionSessionSave(id,action,note,options){return versionCommit(id,p=>productionSessionChange(p,action,note),options)}
  async function productionSessionSubmit(event,id){event.preventDefault();productionDraftChange(event,id);const f=event.currentTarget,r=await productionSessionSave(id,f.elements.sessionAction.value,f.elements.sessionNote.value);if(r.ok&&!r.refreshPending&&versionPanel.productionDraft?.projectId===id){delete versionPanel.productionDraft.sessionNote;requestPaint()}return r}
  function productionDraftChange(event,id){const f=event.currentTarget,d=versionPanel.productionDraft?.projectId===id?versionPanel.productionDraft:{projectId:id};if(f.elements.sessionNote)d.sessionNote=f.elements.sessionNote.value;if(f.elements.productionDay)d.day=f.elements.productionDay.value;if(f.elements.productionDayNote)d.note=f.elements.productionDayNote.value;versionPanel.productionDraft=d}
  function finishedVersions(p,query=''){const q=String(query).normalize('NFKC').toLocaleLowerCase().trim();return versionLedger(p).checkpoints.filter(c=>c.kind==='finished'&&(!q||[c.name,c.snapshot.songTitle,c.snapshot.projectName,c.snapshot.purpose,c.createdAt].join(' ').normalize('NFKC').toLocaleLowerCase().includes(q)))}
  function productionHistoryView(p){
    const v=versionLedger(p),h=escapeHtml,id=JSON.stringify(p.projectId),active=v.sessions?.find(e=>!e.endedAt),busy=versionPanel.busy?' disabled':'',draft=versionPanel.productionDraft?.projectId===p.projectId?versionPanel.productionDraft:{};
    return `<section class="music-production-history" style="background:#12283a;color:#eef6ff;border:1px solid #5f7f9f;border-radius:12px;padding:12px"><h3>Production history（制作履歴・完成版）</h3><form oninput="${h(`MusicStudio.productionDraftChange(event,${id})`)}" onsubmit="${h(`MusicStudio.productionSessionSubmit(event,${id})`)}"><input type="hidden" name="sessionAction" value="${active?'finish':'start'}"><label style="color:#eef6ff">Session note（作業記録）<textarea name="sessionNote" maxlength="2000"${busy}>${h(draft.sessionNote??(active?.note||''))}</textarea></label><button${busy}>${active?'Finish session（作業を終了して記録）':'Start session（作業を開始して記録）'}</button></form><p>作業セッションは明示的に開始・終了します。終了していない記録は再Open後も保持します。日付はUTCです。</p><form onsubmit="event.preventDefault();MusicStudio.versionPanel.finishedQuery=this.elements.finishedQuery.value;MusicStudio.repaint()"><label style="color:#eef6ff">Find finished（完成曲検索）<input name="finishedQuery" maxlength="120" value="${h(versionPanel.finishedQuery||'')}"></label><button>Search（検索）</button></form><ul>${finishedVersions(p,versionPanel.finishedQuery).map(c=>`<li>${h(c.name)} · ${h(c.snapshot.songTitle||c.snapshot.projectName)} · ${h(c.createdAt)} · r${c.sourceRevision}</li>`).join('')}</ul>${finishedVersions(p).length?`<form onsubmit="${h(`MusicStudio.finishedOpenSubmit(event,${id})`)}"><label style="color:#eef6ff">Finished version（編集元の完成版）<select name="finishedId"${busy}>${finishedVersions(p).map(c=>`<option value="${h(c.id)}">${h(c.name)} · ${h(c.createdAt)}</option>`).join('')}</select></label><button${busy}>Open copy（元を保護して別曲として編集）</button></form>`:''}<ol>${(v.sessions||[]).map(e=>`<li><time>${h(e.startedAt.slice(0,10))}</time> · ${h(e.startedAt)} → ${h(e.endedAt||'Open（継続中）')} · r${e.startRevision}${e.endRevision===undefined?'':'–'+e.endRevision}<p>${h(e.note)}</p>${e.endNote?`<p>Finish（終了記録）: ${h(e.endNote)}</p>`:''}</li>`).join('')}</ol><form oninput="${h(`MusicStudio.productionDraftChange(event,${id})`)}" onsubmit="${h(`MusicStudio.productionDaySubmit(event,${id})`)}"><label style="color:#eef6ff">Day（日付）<input type="date" name="productionDay" value="${h(draft.day||'')}" required${busy}></label><label style="color:#eef6ff">Daily record（日次記録）<textarea name="productionDayNote" maxlength="2000" required${busy}>${h(draft.note||'')}</textarea></label><button${busy}>Add daily record（日次記録を追加）</button></form><ol>${(v.days||[]).slice().sort((a,b)=>a.day.localeCompare(b.day)||a.createdAt.localeCompare(b.createdAt)).map(d=>`<li><time>${h(d.day)}</time> · r${d.revision}<p>${h(d.note)}</p></li>`).join('')}</ol></section>`;
  }
  function versionPreview(id,checkpointId,groups,scope){
    try{const p=state.projects.find(p=>p.projectId===id);if(!p)throw Error('checkpoint-project-missing');const next=versionCompose(p,checkpointId,groups,scope),preview={projectId:id,checkpointId,groups:clone(groups),...(scope?{scope:clone(scope),impact:versionRangeCompose(p,p.songVersions.checkpoints.find(c=>c.id===checkpointId).snapshot,scope).impact}:{}),comparison:versionCompare(p,checkpointId)};versionPanel.draft={projectId:id,checkpointId,groups:clone(groups),scope:scope?clone(scope):null};versionProof.set(preview,{baseline:JSON.stringify(p),next,proof:JSON.stringify(preview)});versionPanel.preview=preview;versionPanel.message='Compare（変更範囲を確認して採用してください）';requestPaint();return{ok:true,preview}}
    catch(e){versionPanel.preview=null;versionPanel.message=e.message;requestPaint();return{ok:false,error:e.message}}
  }
  // Render the authenticated comparison snapshots without publishing audio or edits.
  async function versionAuditionRender(p,guard){
    const plan=p.finalExportPlan?finalPlan(p,p.finalExportPlan):null,sources=[];
    for(const meta of finalSources(p)){
      const route=plan?.routes.find(r=>r.key===meta.key);if(plan&&(!route||route.muted))continue;
      if(!plan&&p.midiData?.tracks?.some(t=>!t.muted&&t.notes?.length)&&p.longWavAssets?.find(a=>a.id===meta.id)?.midiRender)continue;
      guard();const sourceAsset=meta.kind==='pcm'?p.pcmMix.assets.find(a=>a.id===meta.id):p.longWavAssets.find(a=>a.id===meta.id);
      const estimate=(meta.kind==='pcm'?sourceAsset.original.channels[0].length:sourceAsset.vocalTake?Math.max(sourceAsset.frames,48000*125):sourceAsset.frames)+Math.ceil((route?.startSeconds||0)*48000);
      finalCheckCapacity(Math.max(estimate,...sources.map(s=>s.start+s.frames)),sources.length+1,{mixMasterOnly:true});let blob,start=0;
      if(meta.kind==='pcm')blob=new Blob([pcmEncodeWav(pcmRenderAsset(p.pcmMix.assets.find(a=>a.id===meta.id)))],{type:'audio/wav'});
      else{
        const asset=p.longWavAssets.find(a=>a.id===meta.id);if(asset.sampleRate!==48000)throw Error('checkpoint-48khz-required');if(asset.frames>48000*3600||asset.frames*asset.channels*2>240*1048576)throw Error('checkpoint-audio-capacity');const record=await repository.getLongWav?.(asset.id);guard();
        if(!record?.blob||record.blob.size!==asset.size||JSON.stringify(record.hashes)!==JSON.stringify(asset.hashes)||JSON.stringify(await longWavDigest(record.blob,guard))!==JSON.stringify(asset.hashes))throw Error('checkpoint-audio-missing-or-corrupt');
        if(asset.vocalTake){const h=vocalHistory(asset),setting=h.edits[h.cursor];
          if(setting.regions?.length){if(asset.frames>asset.sampleRate*125||asset.frames*asset.channels>VOCAL_EDIT_SAMPLE_LIMIT)throw Error('vocal-edit-sample-capacity');const chunks=[];for await(const chunk of pcmDecodeWavStream(record.blob)){guard();chunks.push(chunk)}
            const pcm={sampleRate:asset.sampleRate,channels:Array.from({length:asset.channels},(_,c)=>Float32Array.from(chunks.flatMap(x=>Array.from(x.channels[c]))))};
            const output=vocalProcessPCM(pcm,setting);blob=vocalWav(output.channels,output.sampleRate).blob;
          }else blob=await vocalStreamPreview(record.blob,asset,setting,guard);
          start=Math.round(Math.max(0,vocalSourceOrigin(p,asset,setting)+setting.first/asset.sampleRate)*48000);
        }else{const h=longMixHistory(asset);blob=(await pcmRenderLongWavBlob(record.blob,h.settings[h.cursor],16384,{guard})).blob}
      }
      let frames=0;for await(const chunk of pcmDecodeWavStream(blob)){guard();if(chunk.sampleRate!==48000)throw Error('checkpoint-48khz-required');frames+=chunk.channels[0].length}
      start+=Math.round((route?.startSeconds||0)*48000);if(start+frames>48000*3600)throw Error('checkpoint-one-hour-limit');
      sources.push({blob,start,frames,gainDb:route?.gainDb||0});
    }
    if(!plan&&p.midiData?.tracks?.some(t=>!t.muted&&t.notes?.length)){
      const result=await root.MusicStudioAudio.renderMidiStream(clone(p.midiData),instrumentEntries(p),{guard});guard();
      if(result.sampleRate!==48000||result.channels!==2)throw Error('checkpoint-midi-render-format');
      finalCheckCapacity(Math.max(result.frames,...sources.map(s=>s.start+s.frames)),sources.length+1,{mixMasterOnly:true});
      const blob=await finalWav(result.chunks,guard);if(blob.size!==44+result.frames*4)throw Error('checkpoint-midi-render-incomplete');
      sources.push({blob,start:0,frames:result.frames,gainDb:0});
    }
    if(!sources.length)throw Error('checkpoint-no-audio');
    const frames=Math.max(...sources.map(s=>s.start+s.frames));finalCheckCapacity(frames,sources.length,{mixMasterOnly:true});
    if(plan){
      const prepared=await finalMeasuredWav(finalChunks(sources,frames,guard),guard,false,plan.masterCompressor),before=prepared.masterInput||prepared.metrics;
      const initial=masterGainPlan(before,plan.targetLufs,plan.ceilingDb);
      const corrected=await masterConverge(initial.gainDb,plan.targetLufs,plan.ceilingDb,g=>finalMeasuredWav(finalMasterChunks(sources,frames,guard,plan.masterCompressor,g),guard,true),r=>r.metrics,{guard});return corrected.output.blob;
    }
    const meter=await masterMeasure(finalChunks(sources,frames,guard),{guard}),gainDb=meter.truePeakDb===null?0:Math.min(0,-1-meter.truePeakDb);
    return finalWav(finalMasterChunks(sources,frames,guard,null,gainDb),guard);
  }
  function versionListenStop(){versionPanel.generation++;finalStop()}
  async function versionListen(id,side){
    if(versionPanel.busy||workspaceBusy()||finalExport.busy||!['A','B'].includes(side))return{ok:false,error:'checkpoint-audition-busy-or-invalid'};
    let audio;const token=++versionPanel.generation,preview=versionPanel.preview,proof=preview&&versionProof.get(preview),target=repository,route=currentRoute();
    const guard=()=>{if(token!==versionPanel.generation||route!==currentRoute()||target!==repository||!proof||preview!==versionPanel.preview||preview.projectId!==id||proof.baseline!==JSON.stringify(state.projects.find(p=>p.projectId===id))||proof.proof!==JSON.stringify(preview)||hasUnsavedChanges()||shutdownPromise)throw Error('checkpoint-audition-stale-or-cancelled')};
    try{
      if(versionPanel.busy||workspaceBusy()||finalExport.busy||!['A','B'].includes(side))throw Error('checkpoint-audition-busy-or-invalid');
      guard();versionPanel.busy=true;finalStop();pcmStop();longMixStop();vocalPlaybackStop();requestPaint();
      if(JSON.stringify(await target.get(id))!==proof.baseline)throw Error('checkpoint-audition-storage-conflict');guard();
      const p=side==='A'?JSON.parse(proof.baseline):clone(proof.next),blob=await versionAuditionRender(p,guard);guard();
      if(JSON.stringify(await target.get(id))!==proof.baseline)throw Error('checkpoint-audition-storage-conflict');guard();
      finalStop();pcmStop();longMixStop();vocalPlaybackStop();const url=root.URL.createObjectURL(blob);finalExport.url=url;audio=new root.Audio(url);finalExport.audio=audio;
      audio.onended=()=>{if(finalExport.audio===audio)finalStop()};await audio.play();guard();if(finalExport.audio!==audio)throw Error('checkpoint-audition-stopped');
      versionPanel.message=side==='A'?'A（現在の保存版を試聴）':'B（選択部分を採用した候補を試聴）';return{ok:true};
    }catch(e){if(finalExport.audio===audio)finalStop();versionPanel.message=e.message;return{ok:false,error:e.message}}
    finally{versionPanel.busy=false;requestPaint()}
  }
  async function versionApply(id,options){const preview=versionPanel.preview,proof=preview&&versionProof.get(preview);return versionCommit(id,p=>{if(!proof||preview.projectId!==id||proof.baseline!==JSON.stringify(p)||proof.proof!==JSON.stringify(preview))throw Error('checkpoint-preview-stale');return clone(proof.next)},options)}
  async function versionUndoRedo(id,direction,options){return versionCommit(id,p=>versionStep(p,direction),options)}
  function versionCaptureChanged(event,id){const f=event.currentTarget;return versionPanel.captureDraft={projectId:id,name:f.elements.checkpointName.value,kind:f.elements.checkpointKind?.value||'working'}}
  async function versionSubmit(event,id){event.preventDefault();const draft=versionCaptureChanged(event,id),result=await versionSave(id,draft.name,{kind:draft.kind});if(result.ok&&!result.refreshPending&&versionPanel.captureDraft===draft){versionPanel.captureDraft=null;requestPaint()}return result}
  function versionScopeForm(f){return f.elements.checkpointTrack?.value?{trackId:f.elements.checkpointTrack.value,startMeasure:Number(f.elements.checkpointStart.value),endMeasure:Number(f.elements.checkpointEnd.value)}:null}
  function versionPreviewSubmit(event,id){event.preventDefault();const f=event.currentTarget;return versionPreview(id,f.elements.checkpointId.value,Array.from(f.querySelectorAll('[name=checkpointGroup]:checked'),x=>x.value),versionScopeForm(f))}
  function versionSelectionChanged(event,id){const f=event.currentTarget;versionPanel.draft={projectId:id,checkpointId:f.elements.checkpointId.value,groups:Array.from(f.querySelectorAll('[name=checkpointGroup]:checked'),x=>x.value),scope:versionScopeForm(f)};versionPanel.preview=null;versionPanel.message='Compare（選択を変更しました。もう一度比較してください）';requestPaint()}
  const VERSION_FIELD_LABELS={musicalSettings:'BPM・Key・拍子',sections:'曲構成',chordProgressions:'コード',melodies:'メロディ',instruments:'楽器',midiAssets:'MIDI素材',lyrics:'歌詞',syllableAssignments:'歌詞と音符の対応',soundSelections:'音色',plugins:'プラグイン',midiData:'MIDI演奏',importSource:'読み込み元',aiWorkspace:'AI候補',logicInstruments:'Logic音源候補・採用履歴',instrumentLibrary:'音源設定',audioAssets:'音声素材',fileReferences:'参照ファイル',pcmMix:'短い音声・Mix',longWavAssets:'WAV・音声編集',vocalWorkspace:'歌声設定',vocalReplacement:'歌声の部分置換',vocalComp:'テイク構成',vocalInputProfiles:'録音設定',longMasterWorkspace:'Master候補',mixNotes:'Mixメモ',masteringNotes:'Masterメモ',finalExportPlan:'書き出し設定',productionNotes:'制作メモ',projectName:'プロジェクト名',songTitle:'曲名',purpose:'制作目的',status:'制作状態'};
  function versionTimeline(p){
    const v=versionLedger(p),h=escapeHtml,events=[...v.checkpoints.map(c=>({id:c.id,time:c.createdAt,label:(c.kind==='finished'?'Finished（完成版）: ':'Checkpoint（候補版）: ')+c.name})),...v.operations.map(o=>({id:o.id,time:o.createdAt,label:'Adoption（部分採用）: '+(v.checkpoints.find(c=>c.id===o.checkpointId)?.name||o.checkpointId)+' · '+(o.scope?o.scope.trackId+' / '+o.scope.startMeasure+'–'+o.scope.endMeasure+'小節':o.groups.map(g=>({music:'音楽',audio:'音声',notes:'制作メモ',details:'曲情報'}[g])).join('、'))+' · '+(v.path.slice(0,v.cursor).includes(o.id)?'採用中':v.path.includes(o.id)?'Undo済み':'分岐として保持')})),...(v.sessions||[]).flatMap(e=>[{id:e.id+':start',time:e.startedAt,label:'Session start（制作開始）: '+e.note},...(e.endedAt?[{id:e.id+':end',time:e.endedAt,label:'Session finish（制作終了）: '+(e.endNote||e.note)}]:[])]),...(v.edits||[]).map(e=>({id:e.id,time:e.createdAt,label:'Automatic edit（自動保存）: r'+e.revision+' · '+AUTOMATIC_EDIT_SOURCES[e.source]+' · '+e.groups.map(g=>({music:'音楽',audio:'音声',notes:'制作メモ',details:'曲情報'}[g])).join('、')})),...(v.days||[]).map(d=>({id:d.id,time:d.createdAt,label:'Daily record（日次記録）: '+d.day+' · '+d.note}))].sort((a,b)=>a.time.localeCompare(b.time)||a.id.localeCompare(b.id));
    if(!events.length)return'';
    return`<details style="background:#12283a;color:#eef6ff;border:1px solid #5f7f9f;border-radius:12px;padding:12px"><summary style="color:#eef6ff">History（完成版・制作履歴） · ${events.length}</summary><p>完成版・候補版・部分採用・制作セッション・保存済み編集・日次記録を日時順に表示します。未保存操作や保存失敗は自動記録の対象外です。</p><ol>${events.map(e=>`<li><time datetime="${h(e.time)}">${h(new Date(e.time).toLocaleString())}</time> · ${h(e.label)}</li>`).join('')}</ol></details>`;
  }
  function versionDisclosureChanged(detail){if(detail.isConnected!==false)versionPanel.open=detail.open}
  function versionView(p){
    let v;try{v=versionLedger(p)}catch(e){return`<p role="alert">${escapeHtml(e.message)}</p>`}const id=JSON.stringify(p.projectId),h=escapeHtml,disabled=versionPanel.busy?' disabled':'',preview=versionPanel.preview?.projectId===p.projectId?versionPanel.preview:null,draft=versionPanel.draft?.projectId===p.projectId?versionPanel.draft:null,captureDraft=versionPanel.captureDraft?.projectId===p.projectId?versionPanel.captureDraft:null;
    return`<details class="music-project-details music-song-versions"${versionPanel.open?' open':''} ontoggle="MusicStudio.versionDisclosureChanged(this)"><summary>Checkpoints（曲の比較・部分採用）</summary><p>通常保存・自動保存とは別の明示的な候補版です。音楽・音声は依存関係をまとめて採用します。元曲を任意の過去状態へ巻き戻す操作ではありません。各32件まで。上限時は完全Backupを保存してください。</p><form oninput="${h(`MusicStudio.versionCaptureChanged(event,${id})`)}" onsubmit="${h(`MusicStudio.versionSubmit(event,${id})`)}"><label style="color:#eef6ff">Name（チェックポイント名）<input name="checkpointName" maxlength="120" value="${h(captureDraft?.name||'')}" required${disabled}></label><label style="color:#eef6ff">Version type（保存する版）<select name="checkpointKind"${disabled}><option value="working"${captureDraft?.kind!=='finished'?' selected':''}>Working（制作途中）</option><option value="finished"${captureDraft?.kind==='finished'?' selected':''}>Finished（完成版を固定）</option></select></label><button class="music-primary"${disabled}>Create（候補版を保存）</button></form>${v.checkpoints.length?`<form onchange="${h(`MusicStudio.versionSelectionChanged(event,${id})`)}" onsubmit="${h(`MusicStudio.versionPreviewSubmit(event,${id})`)}"><label style="color:#eef6ff">Checkpoint（候補版）<select name="checkpointId"${disabled}>${v.checkpoints.map(c=>`<option value="${h(c.id)}"${draft?.checkpointId===c.id?' selected':''}>${c.kind==='finished'?'Finished（完成） · ':''}${h(c.name)} · ${h(c.createdAt)} · r${h(c.sourceRevision)}</option>`).join('')}</select></label><fieldset style="background:#12283a;color:#eef6ff;border:1px solid #5f7f9f;border-radius:12px;padding:12px"${disabled}><legend style="color:#eef6ff">Parts（採用する部分）</legend>${[['music','Music（MIDI・コード・歌詞・AI候補・音源設定）'],['audio','Audio / Mix（音声・編集・Mix・Master設定）'],['notes','Notes（制作メモ）'],['details','Details（曲名・目的・状態）']].map(([key,label])=>`<label style="display:flex;align-items:center;gap:8px;min-height:44px;color:#eef6ff"><input type="checkbox" style="width:18px;min-height:18px;flex:0 0 18px" name="checkpointGroup" value="${key}"${draft?.groups.includes(key)?' checked':''}>${label}</label>`).join('')}</fieldset><fieldset style="background:#12283a;color:#eef6ff;border:1px solid #5f7f9f;border-radius:12px;padding:12px"${disabled}><legend style="color:#eef6ff">Track / Measures（トラック・小節範囲）</legend><label style="color:#eef6ff">Track（全体またはトラック）<select name="checkpointTrack"><option value="">Bundle（選択グループ全体）</option>${(p.midiData?.tracks||[]).map(t=>`<option value="${h(t.id)}"${draft?.scope?.trackId===t.id?' selected':''}>${h(t.name||t.part||t.id)}</option>`).join('')}</select></label><label style="color:#eef6ff">From（開始小節）<input name="checkpointStart" type="number" min="1" max="10000" value="${h(draft?.scope?.startMeasure||1)}"></label><label style="color:#eef6ff">To（終了小節・含む）<input name="checkpointEnd" type="number" min="1" max="10000" value="${h(draft?.scope?.endMeasure||1)}"></label><p>範囲採用はMusicだけを選択してください。拍子・音源・コード等の依存が異なる場合、歌詞の音符割当・歌声・AI候補が結び付く場合、小節境界をまたぐ音符や保護音符がある場合は採用を止めます。</p></fieldset><button class="music-secondary"${disabled}>Compare（比較する）</button></form>`:''}${preview?`<p>保存済みのExport設定がある版は、選択音声・配置・音量・Master設定を反映します。未設定の版はMIDIと保存音声を曲先頭から合成します。参照添付は演奏素材に含みません。</p><p>Candidate（候補）: ${h(preview.comparison.name)}</p>${preview.impact?`<p>Range（変更範囲）: ${h(preview.impact.trackId)} · ${h(preview.impact.startMeasure)}–${h(preview.impact.endMeasure)}小節 · tick ${h(preview.impact.startTick)}–${h(preview.impact.endTick)} · 置換 ${h(preview.impact.removedNotes)}音符 / 採用 ${h(preview.impact.adoptedNotes)}音符 / 範囲外保持 ${h(preview.impact.retainedNotes)}音符。その他のトラック・設定を保持します。関連データ保持：${h((preview.impact.retainedDependencies||[]).map(f=>VERSION_FIELD_LABELS[f]||f).join('、'))}。</p>`:''}<ul>${preview.comparison.groups.filter(g=>preview.groups.includes(g.key)).map(g=>`<li>${h({music:'Music（音楽）',audio:'Audio / Mix（音声）',notes:'Notes（メモ）',details:'Details（曲情報）'}[g.key])}: ${h(g.fields.map(f=>VERSION_FIELD_LABELS[f]||'その他の設定').join('、')||'変更なし')}</li>`).join('')}</ul><button type="button" class="music-secondary"${disabled} onclick="${h(`MusicStudio.versionListen(${id},'A')`)}">A（現在の保存版を試聴）</button><button type="button" class="music-secondary"${disabled} onclick="${h(`MusicStudio.versionListen(${id},'B')`)}">B（採用候補を試聴）</button><button type="button" class="music-secondary" onclick="MusicStudio.versionListenStop()">Stop（試聴停止）</button><button class="music-primary"${disabled} onclick="${h(`MusicStudio.versionApply(${id})`)}">Adopt（選択部分を採用・保存）</button>`:''}<div class="music-form-actions"><button class="music-secondary"${disabled||v.cursor===0?' disabled':''} onclick="${h(`MusicStudio.versionUndoRedo(${id},-1)`)}">Undo adoption（部分採用を戻す）</button><button class="music-secondary"${disabled||v.cursor===v.path.length?' disabled':''} onclick="${h(`MusicStudio.versionUndoRedo(${id},1)`)}">Redo adoption（部分採用をやり直す）</button><button class="music-secondary" onclick="MusicStudio.versionCancel()">Cancel（取消）</button></div><p role="status">${h(versionPanel.message)}</p>${productionHistoryView(p)}${versionTimeline(p)}${binaryRecoveryView(p)}</details>`;
  }
  function rebindAIWorkspace(value,projectId,revision){if(!value)return null;const copy=clone(value);copy.projectId=projectId;copy.baseRevision=revision;copy.updatedAt=now();return copy}

  // Restore is metadata-only. This validates known fields without normalizing Project/MIDI payloads.
  function restorePreflight(value,{settings=true,projects=true}={}){
    const checked=validateBackup(value),errors=[...checked.errors],warnings=[],dependencies=[];
    const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
    for(const [index,p] of (projects&&Array.isArray(value?.projects)?value.projects:[]).entries()){
      const prefix=`Project ${index+1}`,metadata=validateProject(p);errors.push(...metadata.errors.map(e=>`${prefix}: ${e}`));if(!object(p))continue;
      for(const [snapshotIndex,snapshot] of [p,...(metadata.valid?versionSnapshots(p):[])].entries()){
        const midi=validateRestoredMidi(snapshot),location=snapshotIndex?`${prefix}.history[${snapshotIndex-1}]`:prefix;
        errors.push(...midi.errors.map(e=>`${location}: ${e}`));warnings.push(...midi.warnings.map(w=>`${location}: ${w}`));
      }
      if(p.longWavAssets?.length||versionSnapshots(p).some(s=>s.longWavAssets?.length))errors.push(`${prefix}: long-wav-binary-backup-not-supported`);
      const identities=new Map(),assets=[];
      for(const field of ['midiAssets','audioAssets','fileReferences']){
        if(p[field]!==undefined&&!Array.isArray(p[field])){errors.push(`${prefix}: malformed-${field}`);continue}
        for(const [i,a] of (p[field]||[]).entries()){
          const location=`${prefix}.${field}[${i}]`;
          if(!object(a)){errors.push(`${location}: malformed-asset`);continue}
          const id=field==='fileReferences'?a.id:a.assetId,scope=field==='fileReferences'?'file':'asset';
          if(id!==undefined){if(typeof id!=='string'||!id.trim()||identities.has(`${scope}:${id}`))errors.push(`${location}: invalid-or-duplicate-identity`);else identities.set(`${scope}:${id}`,a)}else warnings.push(`${location}: legacy-identity`);
          if(a.storage!==undefined&&!object(a.storage))errors.push(`${location}: malformed-storage`);
          const storage=object(a.storage)?a.storage:{},reference=storage.reference;
          if(reference!==undefined&&(typeof reference!=='string'||!reference.trim()))errors.push(`${location}: malformed-reference`);
          const unsupported=(storage.kind!==undefined&&!['external','external-file'].includes(storage.kind))||a.version!==undefined||a.schemaVersion!==undefined;
          const temporary=typeof reference==='string'&&/^(blob:|data:)/i.test(reference);
          const status=unsupported?'unsupported':a.missing===true?'missing':storage.requiresReselection===true||temporary||!reference?'reselection-required':'external';
          dependencies.push({path:location,status,present:'unverified',binaryIncluded:false});
          if(status!=='external')warnings.push(`${location}: ${status}`);
          if(field!=='fileReferences')assets.push(a);
        }
      }
      for(const a of assets)if(a.derivedFromAssetId!=null&&(typeof a.derivedFromAssetId!=='string'||!a.derivedFromAssetId.trim()||!identities.has(`asset:${a.derivedFromAssetId}`)))errors.push(`${prefix}: missing-asset-dependency`);
    }
    if(settings&&value?.settings){const s=validateSettings(value.settings);errors.push(...s.errors);if(s.valid)errors.push(...settingsTemplateErrors(normalizeSettings(value.settings)))}
    const binaryInventory=root.MusicStudioBinaryBoundary?.inventory(value,{projects});
    return{ok:errors.length===0,errors,warnings,dependencies,binaryDependencies:binaryInventory?.dependencies||[],binaryContractIssues:binaryInventory?.issues||[],scope:'metadata-only',completeBinaryBackup:false,binaryResolution:'not-performed'};
  }
  function preserveRestoreSettings(input){
    // Retain opaque extensions while applying the existing safety normalization to known fields.
    function overlay(raw,safe){const result=raw&&typeof raw==='object'&&!Array.isArray(raw)?clone(raw):{};for(const key of Object.keys(safe))Object.defineProperty(result,key,{value:safe[key]&&typeof safe[key]==='object'&&!Array.isArray(safe[key])?overlay(raw?.[key],safe[key]):clone(safe[key]),enumerable:true,writable:true,configurable:true});return result}
    return overlay(input,normalizeSettings(input));
  }
  function prepareRestoreProjects(sources,existing){
    const used=new Set(existing.map(p=>p.projectId)),items=[];
    for(const source of sources){const incoming=clone(source);if(used.has(incoming.projectId)){
      let candidate;for(let attempt=0;attempt<100;attempt++){candidate=uuid();if(!used.has(candidate))break;candidate=null}if(!candidate)throw Error('restore-id-collision');
      incoming.projectId=candidate;incoming.projectName=`${incoming.projectName}（復元）`;incoming.createdAt=now();if(incoming.aiWorkspace)incoming.aiWorkspace=rebindAIWorkspace(incoming.aiWorkspace,incoming.projectId,incoming.revision);
    }versionRebind(incoming,incoming.projectId!==source.projectId?'（復元）':'');used.add(incoming.projectId);incoming.updatedAt=now();items.push(incoming)}return items;
  }
  function assertRestoreCurrent(control){const reason=control?.reason?.();if(reason)throw Error(reason)}
  let restoreOperation=null;
  function cancelBackupRestore(){if(restoreOperation){restoreOperation.active=false;restoreOperation.abort?.()}return{cancelled:true}}

  function memoryRepository(initial=[]){
    const records=new Map(initial.map(item=>[item.projectId,clone(item)]));
    const automaticBackups=new Map();let settings=null;
    const midiHistory=new Map(),midiImportHistory=new Map();return{kind:'memory',async restoreMetadata(sources,incomingSettings,control){assertRestoreCurrent(control);const items=prepareRestoreProjects(sources,[...records.values()]),staged=new Map(records),nextSettings=incomingSettings?clone(incomingSettings):settings;for(const item of items)staged.set(item.projectId,clone(item));assertRestoreCurrent(control);records.clear();for(const [id,item] of staged)records.set(id,item);settings=nextSettings;return{projects:items,settings:incomingSettings}},async list(){return [...records.values()].map(clone)},async get(id){return records.has(id)?clone(records.get(id)):null},async compareAndFork(item,sourceId,baseline,guard){guard?.();if(records.has(item.projectId)||JSON.stringify(records.get(sourceId))!==baseline)throw Error('finished-fork-storage-conflict');records.set(item.projectId,clone(item));return clone(item)},async compareAndPut(item,baseline,guard){guard?.();if(JSON.stringify(records.get(item.projectId))!==baseline)throw Error('stale-lyrics-assignment-storage');const value=clone(item);preserveFinishedSnapshots(records.get(item.projectId),value);records.set(item.projectId,value);return clone(value)},async put(item){const value=clone(item);preserveFinishedSnapshots(records.get(value.projectId),value);records.set(value.projectId,value);return clone(value)},async compareAndDelete(id,baseline,guard){guard?.();if(JSON.stringify(records.get(id))!==baseline)throw Error('project-delete-conflict');records.delete(id)},async delete(id){records.delete(id)},async has(id){return records.has(id)},async getSettings(){return settings?clone(settings):null},async putSettings(value){settings=clone(value);return clone(settings)},async listAutoBackups(){return [...automaticBackups.values()].map(clone)},async putAutoBackup(value){automaticBackups.set(value.backupId,clone(value));return clone(value)},async deleteAutoBackup(id){automaticBackups.delete(id)},async listMidiHistory(){return [...midiHistory.values()].map(clone)},async putMidiHistory(value){midiHistory.set(value.id,clone(value));return clone(value)},async commitMidiImport(item,history,sourceId,baseline,guard){const value=clone(item),entry=clone(history);guard?.();if(entry.projectId!==value.projectId||records.has(value.projectId)||(sourceId&&JSON.stringify(records.get(sourceId))!==baseline)||midiImportHistory.has(entry.id))throw Error('midi-import-storage-conflict');records.set(value.projectId,value);midiImportHistory.set(entry.id,entry);return clone(value)},async listMidiImportHistory(){return [...midiImportHistory.values()].map(clone)},async putMidiImportHistory(value){midiImportHistory.set(value.id,clone(value));return clone(value)}};
  }
  function indexedDbRepository(){
    if(!root.indexedDB)return memoryRepository();
    const database=new Promise((resolve,reject)=>{let settled=false;const finish=(error,db)=>{if(settled){db?.close();return}settled=true;root.clearTimeout?.(timer);error?reject(error):resolve(db)};const timer=root.setTimeout?.(()=>finish(Error('IndexedDB open timed out.')),15000);const request=root.indexedDB.open(DB_NAME,7);request.onupgradeneeded=()=>{for(const n of ['vocalJournals','vocalJournalChunks'])if(!request.result.objectStoreNames.contains(n))request.result.createObjectStore(n,{keyPath:"id"});if(!request.result.objectStoreNames.contains("longWavBinaries"))request.result.createObjectStore("longWavBinaries",{keyPath:"id"});if(!request.result.objectStoreNames.contains(STORE_NAME)){const store=request.result.createObjectStore(STORE_NAME,{keyPath:'projectId'});store.createIndex('updatedAt','updatedAt')}if(!request.result.objectStoreNames.contains(SETTINGS_STORE_NAME))request.result.createObjectStore(SETTINGS_STORE_NAME,{keyPath:'id'});if(!request.result.objectStoreNames.contains(AUTO_BACKUP_STORE_NAME)){const store=request.result.createObjectStore(AUTO_BACKUP_STORE_NAME,{keyPath:'backupId'});store.createIndex('createdAt','createdAt')}if(!request.result.objectStoreNames.contains(MIDI_HISTORY_STORE_NAME)){const store=request.result.createObjectStore(MIDI_HISTORY_STORE_NAME,{keyPath:'id'});store.createIndex('createdAt','createdAt')}if(!request.result.objectStoreNames.contains(MIDI_IMPORT_HISTORY_STORE_NAME)){const store=request.result.createObjectStore(MIDI_IMPORT_HISTORY_STORE_NAME,{keyPath:'id'});store.createIndex('createdAt','createdAt')}};request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();finish(null,request.result)};request.onerror=()=>finish(request.error);request.onblocked=()=>finish(Error('データベース更新がほかのタブでブロックされています。'))});
    const openTransaction=(db,stores,mode)=>db.transaction(stores,mode,mode==='readwrite'?{durability:'strict'}:undefined);
    const request=(storeName,mode,operation)=>database.then(db=>new Promise((resolve,reject)=>{
      // A resolved write means the browser completed a strict durability commit,
      // not only that the request reached the in-memory IndexedDB transaction.
      const tx=openTransaction(db,storeName,mode);let value,requestSucceeded=false;
      tx.oncomplete=()=>requestSucceeded?resolve(value):reject(Error('IndexedDB request did not complete.'));
      tx.onabort=()=>reject(tx.error||Error('IndexedDB transaction aborted.'));
      tx.onerror=()=>{reject(tx.error||Error('IndexedDB transaction failed.'));try{tx.abort()}catch(_){} };
      try{const result=operation(tx.objectStore(storeName));result.onsuccess=()=>{value=result.result;requestSucceeded=true};result.onerror=()=>{reject(result.error||Error('IndexedDB request failed.'));try{tx.abort()}catch(_){} }}catch(error){try{tx.abort()}catch(_){}reject(error)}
    }));
    function commitMidiImport(item,history,sourceId,baseline,guard){const value=clone(item),entry=clone(history);return database.then(db=>new Promise((resolve,reject)=>{
      let tx,failure;const abort=e=>{failure=failure||e;try{tx.abort()}catch(_){reject(failure)}};
      try{guard?.();if(entry.projectId!==value.projectId)throw Error('midi-import-history-project-mismatch');
        tx=openTransaction(db,[STORE_NAME,MIDI_IMPORT_HISTORY_STORE_NAME],'readwrite');const store=tx.objectStore(STORE_NAME);
        tx.onabort=()=>reject(failure||tx.error||Error('midi-import-aborted'));tx.onerror=()=>abort(tx.error||Error('midi-import-failed'));tx.oncomplete=()=>resolve(clone(value));
        const watch=r=>{r.onerror=()=>abort(r.error);r.onsuccess=()=>{try{guard?.()}catch(e){abort(e)}};return r};
        const write=()=>{try{guard?.();watch(store.add(value));watch(tx.objectStore(MIDI_IMPORT_HISTORY_STORE_NAME).add(entry))}catch(e){abort(e)}};
        if(sourceId){const get=watch(store.get(sourceId));get.onsuccess=()=>{try{guard?.();if(JSON.stringify(get.result)!==baseline)throw Error('midi-import-source-conflict');write()}catch(e){abort(e)}}}else write();
      }catch(e){if(tx)abort(e);else reject(e)}
    }))}
    function restoreMetadata(sources,settings,control){return database.then(db=>new Promise((resolve,reject)=>{
      let transaction,items=[],failure=null,settled=false;
      const finish=(error)=>{if(settled)return;settled=true;root.clearTimeout?.(timer);if(control)control.abort=null;error?reject(error):resolve({projects:items,settings})};
      const abort=error=>{failure=failure||error||Error('restore-cancelled');try{transaction?.abort()}catch(e){finish(failure)}};
      const timer=root.setTimeout?.(()=>{abort(Error('restore-transaction-timeout'));finish(failure)},15000);
      try{
        assertRestoreCurrent(control);transaction=openTransaction(db,[STORE_NAME,SETTINGS_STORE_NAME],'readwrite');
        if(control)control.abort=()=>abort(Error(control.reason?.()||'restore-cancelled'));
        transaction.onabort=()=>finish(failure||transaction.error||Error('restore-transaction-aborted'));
        transaction.onerror=()=>abort(transaction.error||Error('restore-transaction-error'));
        transaction.oncomplete=()=>{if(!failure)finish();else finish(failure)};
        const watch=request=>{request.onerror=()=>abort(request.error||Error('restore-request-error'));request.onsuccess=()=>{try{assertRestoreCurrent(control)}catch(error){abort(error)}};return request};
        const existing=watch(transaction.objectStore(STORE_NAME).getAll());
        existing.onsuccess=()=>{try{
          assertRestoreCurrent(control);items=prepareRestoreProjects(sources,existing.result);
          for(const item of items)watch(transaction.objectStore(STORE_NAME).add(item));
          if(settings)watch(transaction.objectStore(SETTINGS_STORE_NAME).put(clone(settings)));
        }catch(error){abort(error)}};
      }catch(error){if(transaction)abort(error);else finish(error)}
    }))}
    function compareAndDelete(id,baseline,guard){return database.then(db=>new Promise((resolve,reject)=>{
      const tx=openTransaction(db,STORE_NAME,'readwrite'),store=tx.objectStore(STORE_NAME);let failure;
      const abort=e=>{failure=e;try{tx.abort()}catch(_){reject(e)}};
      tx.onabort=()=>reject(failure||tx.error||Error('project-delete-aborted'));tx.onerror=()=>abort(tx.error||Error('project-delete-failed'));tx.oncomplete=()=>resolve();
      const get=store.get(id);get.onerror=()=>abort(get.error);get.onsuccess=()=>{try{guard?.();if(JSON.stringify(get.result)!==baseline)throw Error('project-delete-conflict');const del=store.delete(id);del.onerror=()=>abort(del.error);del.onsuccess=()=>{try{guard?.()}catch(e){abort(e)}}}catch(e){abort(e)}};
    }))}
    function compareAndPut(item,baseline,guard){const value=clone(item);return database.then(db=>new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readwrite',{durability:'strict'}),store=tx.objectStore(STORE_NAME);let failure=null;
      const abort=e=>{failure=failure||e;try{tx.abort()}catch(_){guard?.clearAbort?.();reject(failure)}};
      guard?.registerAbort?.(abort);
      tx.onabort=()=>{guard?.clearAbort?.();reject(failure||tx.error||Error('lyrics-save-aborted'))};tx.onerror=()=>abort(tx.error||Error('lyrics-save-failed'));tx.oncomplete=()=>{guard?.clearAbort?.();resolve(clone(value))};
      const get=store.get(value.projectId);get.onerror=()=>abort(get.error);get.onsuccess=()=>{try{guard?.();if(JSON.stringify(get.result)!==baseline)throw Error('stale-lyrics-assignment-storage');preserveFinishedSnapshots(get.result,value);const put=store.put(value);put.onerror=()=>abort(put.error);put.onsuccess=()=>{try{guard?.()}catch(e){abort(e)}}}catch(e){abort(e)}};
    }))}
    async function compareAndFork(item,sourceId,baseline,guard,records=[]){const value=clone(item),encoded=[];for(const record of records){encoded.push(await encodeLongBinary(record,guard));guard?.()}return database.then(db=>new Promise((resolve,reject)=>{
      const tx=db.transaction(encoded.length?[STORE_NAME,'longWavBinaries']:STORE_NAME,'readwrite',{durability:'strict'}),store=tx.objectStore(STORE_NAME);let failure;
      const abort=e=>{failure=failure||e;try{tx.abort()}catch(_){reject(failure)}};
      guard?.registerAbort?.(abort);tx.onabort=()=>{guard?.clearAbort?.();reject(failure||tx.error||Error('finished-fork-aborted'))};tx.onerror=()=>abort(tx.error||Error('finished-fork-failed'));tx.oncomplete=()=>{guard?.clearAbort?.();resolve(clone(value))};
      const source=store.get(sourceId);source.onerror=()=>abort(source.error);source.onsuccess=()=>{try{guard?.();if(value.projectId===sourceId||JSON.stringify(source.result)!==baseline)throw Error('finished-fork-storage-conflict');for(const record of encoded){const binary=tx.objectStore('longWavBinaries').add(record);binary.onerror=()=>abort(binary.error);binary.onsuccess=()=>{try{guard?.()}catch(e){abort(e)}}}const add=store.add(value);add.onerror=()=>abort(add.error);add.onsuccess=()=>{try{guard?.()}catch(e){abort(e)}}}catch(e){abort(e)}};
    }))}
    // Store bounded, detached Blob nodes in IndexedDB. Reopening these nodes uses
    // the database's durable backing rather than retransferring a WAV of raw bytes
    // into the browser Blob service on every read.
    async function encodeLongBinary(record,guard){
      guard();
      // Archive slices and short rendered WAVs need owned backing too. Never
      // persist a borrowed slice merely because it is below the large-file cutoff.
      const parts=[];for(let at=0;at<record.blob.size;at+=1048576){
        guard();const bytes=await record.blob.slice(at,Math.min(record.blob.size,at+1048576)).arrayBuffer();guard();
        if(bytes.byteLength!==Math.min(1048576,record.blob.size-at))throw Error('long-wav-binary-chunks-invalid');
        const node=new Blob([bytes]);
        // Complete the entire bounded transfer before queuing the durable write.
        if((await node.arrayBuffer()).byteLength!==bytes.byteLength)throw Error('long-wav-binary-chunks-invalid');
        guard();parts.push(node);
      }
      if(record.blob.size<=4*1048576)return{...record,blob:new Blob(parts,{type:record.blob.type})};
      return{id:record.id,format:'nova-long-binary-blobs-v2',size:record.blob.size,type:record.blob.type,parts,hashes:record.hashes};
    }
    async function getLongWav(id){
      const record=await request('longWavBinaries','readonly',store=>store.get(id));
      if(!record||record.blob)return record;
      const legacy=record.format==='nova-long-binary-chunks-v1',durable=record.format==='nova-long-binary-blobs-v2';
      const partSize=p=>legacy?p.byteLength:p.size;
      if((!legacy&&!durable)||!Number.isSafeInteger(record.size)||record.size<1||!Array.isArray(record.parts)||record.parts.some((p,i)=>
        (legacy?(!ArrayBuffer.isView(p)||p.BYTES_PER_ELEMENT!==1):!['[object Blob]','[object File]'].includes(Object.prototype.toString.call(p)))||partSize(p)<1||partSize(p)>1048576||(i<record.parts.length-1&&partSize(p)!==1048576))||record.parts.reduce((size,p)=>size+partSize(p),0)!==record.size)throw Error('long-wav-binary-chunks-invalid');
      // Legacy byte records remain readable without rewriting the source record.
      const nodes=[];for(const part of record.parts){
        if(durable){nodes.push(part);continue}
        const node=new Blob([part]);await node.arrayBuffer();nodes.push(node);
      }
      return{id:record.id,hashes:record.hashes,blob:new Blob(nodes,{type:record.type||'application/octet-stream'})};
    }
    // Append-only PCM journal. Metadata and each chunk share a strict commit.
    function journalWrite(id,operation){return database.then(db=>new Promise((resolve,reject)=>{
      const tx=openTransaction(db,['vocalJournals','vocalJournalChunks'],'readwrite');let failure;
      const timer=root.setTimeout?.(()=>abort(Error('vocal-journal-timeout')),15000),clear=()=>root.clearTimeout?.(timer);
      const abort=e=>{failure=e;try{tx.abort()}catch(_){reject(e)}};
      tx.onabort=()=>{clear();reject(failure||tx.error||Error('vocal-journal-aborted'))};tx.onerror=()=>abort(tx.error||Error('vocal-journal-write-failed'));tx.oncomplete=()=>{clear();resolve()};
      const meta=tx.objectStore('vocalJournals'),chunks=tx.objectStore('vocalJournalChunks'),get=meta.get(id);
      get.onerror=()=>abort(get.error);get.onsuccess=()=>{try{operation(get.result,meta,chunks,abort)}catch(e){abort(e)}};
    }))}
    async function appendVocalJournal(id,seq,bytes,hash){return journalWrite(id,(m,meta,chunks,abort)=>{
      if(!m||m.next!==seq||m.consumed!==0||m.closed)throw Error('vocal-journal-conflict');
      if(m.encoding){if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<1||bytes.byteLength>1048576||(m.encodedBytes||0)+bytes.byteLength>VOCAL_MAX_BYTES)throw Error('vocal-journal-chunk-invalid');const r=chunks.add({id:id+':'+seq,bytes,hash});r.onerror=()=>abort(r.error);const w=meta.put({...m,next:seq+1,encodedBytes:(m.encodedBytes||0)+bytes.byteLength,updatedAt:Date.now()});w.onerror=()=>abort(w.error);return;}
      const n=bytes.byteLength/2;if(!Number.isSafeInteger(n)||n<1||n>4096||m.frames+n>m.rate*VOCAL_CAPTURE_MAX_SECONDS)throw Error('vocal-journal-chunk-invalid');
      const r=chunks.add({id:id+':'+seq,bytes,hash});r.onerror=()=>abort(r.error);
      const w=meta.put({...m,next:seq+1,frames:m.frames+n,updatedAt:Date.now()});w.onerror=()=>abort(w.error);
    })}
    // Binary and project metadata become visible in the same IndexedDB commit.
    async function putLongWav(item,record,baseline,guard){const journal={journalId:record.journalId,journalConsumed:record.journalConsumed,journalFrames:record.journalFrames,journalComplete:record.journalComplete,journalExpectedNext:record.journalExpectedNext};record={...await encodeLongBinary(record,guard),...journal};guard();return database.then(db=>new Promise((resolve,reject)=>{
      const tx=db.transaction([STORE_NAME,'longWavBinaries',...(record.journalId?['vocalJournals','vocalJournalChunks']:[])],'readwrite',{durability:'strict'});let failure=null;
      const abort=e=>{failure=e;try{tx.abort()}catch(_){reject(e)}};
      tx.onabort=()=>reject(failure||tx.error||Error('long-wav-save-aborted'));
      tx.onerror=()=>abort(tx.error||Error('long-wav-save-failed'));
      tx.oncomplete=()=>resolve(clone(item));
      const watch=request=>{request.onerror=()=>abort(request.error);request.onsuccess=()=>{try{guard()}catch(e){abort(e)}};return request};
      const store=tx.objectStore(STORE_NAME),get=store.get(item.projectId);
      get.onerror=()=>abort(get.error);get.onsuccess=()=>{try{
        guard();if(JSON.stringify(get.result)!==baseline)throw Error('long-wav-storage-conflict');preserveFinishedSnapshots(get.result,item);
        const save=()=>{watch(tx.objectStore('longWavBinaries').add(record));watch(store.put(clone(item)))};
        if(record.journalId){const meta=tx.objectStore('vocalJournals'),r=meta.get(record.journalId);r.onerror=()=>abort(r.error);r.onsuccess=()=>{try{
          guard();const m=r.result;if(!m||m.recoveredAt!==undefined||m.consumed!==record.journalConsumed||(record.journalExpectedNext!==undefined&&m.next!==record.journalExpectedNext))throw Error('vocal-journal-already-recovered');
          if(record.journalComplete){for(let i=0;i<m.next;i++)watch(tx.objectStore('vocalJournalChunks').delete(m.id+':'+i));watch(meta.delete(m.id))}
          else if(m.encoding)watch(meta.put({...m,recoveredAt:Date.now(),recoveredFrames:record.journalFrames}));
          else watch(meta.put({...m,consumed:m.consumed+record.journalFrames}));save();
        }catch(e){abort(e)}}}else save();
      }catch(e){abort(e)}};
    }))}
    // Add-only recovery: metadata, original binaries and settings commit together.
    async function restoreLongArchive(projects,records,settings,guard,baselineSettings,histories={exports:[],imports:[]},journals=[]){const encoded=[];for(const record of records){encoded.push(await encodeLongBinary(record,guard));guard(true)}records=encoded;return database.then(db=>new Promise((resolve,reject)=>{
      guard(true);const tx=db.transaction([STORE_NAME,'longWavBinaries',SETTINGS_STORE_NAME,MIDI_HISTORY_STORE_NAME,MIDI_IMPORT_HISTORY_STORE_NAME,'vocalJournals','vocalJournalChunks'],'readwrite',{durability:'strict'});let failure;
      const abort=e=>{failure=failure||e;try{tx.abort()}catch(_){reject(failure)}};
      const timer=root.setTimeout?.(()=>abort(Error('archive-transaction-timeout')),30000);
      const done=()=>root.clearTimeout?.(timer);
      tx.onabort=()=>{done();reject(failure||tx.error||Error('archive-restore-aborted'))};
      tx.onerror=()=>abort(tx.error||Error('archive-restore-failed'));
      tx.oncomplete=()=>{done();failure?reject(failure):resolve(projects)};
      const watch=r=>{r.onerror=()=>abort(r.error);r.onsuccess=()=>{try{guard(true)}catch(e){abort(e)}}};
      const check=tx.objectStore(SETTINGS_STORE_NAME).get(SETTINGS_ID);check.onerror=()=>abort(check.error);check.onsuccess=()=>{try{guard(true);if(JSON.stringify(check.result)!==baselineSettings)throw Error('archive-settings-conflict');for(const p of projects)watch(tx.objectStore(STORE_NAME).add(clone(p)));
        for(const r of records)watch(tx.objectStore('longWavBinaries').add(r));
        for(const j of journals){watch(tx.objectStore('vocalJournals').add(j.meta));for(const c of j.chunks)watch(tx.objectStore('vocalJournalChunks').add(c));}
        for(const r of histories.exports)watch(tx.objectStore(MIDI_HISTORY_STORE_NAME).add(clone(r)));
        for(const r of histories.imports)watch(tx.objectStore(MIDI_IMPORT_HISTORY_STORE_NAME).add(clone(r)));
        if(settings)watch(tx.objectStore(SETTINGS_STORE_NAME).put(clone(settings)));
      }catch(e){abort(e)}};
    }))}
    return{kind:'indexeddb',appendVocalJournal,
      importVocalJournal: (m,items,baseline,guard)=>database.then(db=>new Promise((resolve,reject)=>{
        const tx=openTransaction(db,[STORE_NAME,'vocalJournals','vocalJournalChunks'],'readwrite');let failure;const timer=root.setTimeout?.(()=>abort(Error('vocal-rescue-import-timeout')),15000),done=()=>root.clearTimeout?.(timer);
        const abort=e=>{failure=e;try{tx.abort()}catch(_){reject(e)}};
        tx.onabort=()=>{done();reject(failure||tx.error||Error('vocal-rescue-import-aborted'))};tx.onerror=()=>abort(tx.error||Error('vocal-rescue-import-failed'));tx.oncomplete=()=>{done();resolve()};
        const r=tx.objectStore(STORE_NAME).get(m.owner);r.onerror=()=>abort(r.error);r.onsuccess=()=>{try{guard();if(JSON.stringify(r.result)!==baseline)throw Error('vocal-recovery-conflict');const watch=q=>{q.onerror=()=>abort(q.error)};watch(tx.objectStore('vocalJournals').add(m));for(const c of items)watch(tx.objectStore('vocalJournalChunks').add(c));}catch(e){abort(e)}};
      })),
      sealVocalJournal: (id,expected)=>journalWrite(id,(m,meta,chunks,abort)=>{if(!m||m.next!==expected.next||m.consumed!==expected.consumed||m.frames!==expected.frames)throw Error('vocal-journal-conflict');const r=meta.put({...m,closed:true});r.onerror=()=>abort(r.error)}),
      deleteVocalJournal: (id,expected,guard)=>journalWrite(id,(m,meta,chunks,abort)=>{guard?.();if(!m||JSON.stringify(m)!==JSON.stringify(expected)||(!m.closed&&Date.now()-m.updatedAt<30000)||!Number.isSafeInteger(m.next)||m.next<0||m.next>90000)throw Error('vocal-journal-conflict');for(let i=0;i<m.next;i++){const r=chunks.delete(id+':'+i);r.onerror=()=>abort(r.error)}const r=meta.delete(id);r.onerror=()=>abort(r.error);r.onsuccess=()=>{try{guard?.()}catch(e){abort(e)}}}),
      createVocalJournal: m=>request('vocalJournals','readwrite',store=>store.add(m)),
      listVocalJournals: ()=>request('vocalJournals','readonly',store=>store.getAll()),
      getVocalJournal: id=>request('vocalJournals','readonly',store=>store.get(id)),
      getVocalJournalChunk: id=>request('vocalJournalChunks','readonly',store=>store.get(id)),
      closeVocalJournal: id=>journalWrite(id,(m,meta,chunks,abort)=>{if(m){const r=(m.frames||m.encodedBytes)?meta.put({...m,closed:true}):meta.delete(m.id);r.onerror=()=>abort(r.error)}}),
      commitMidiImport,compareAndDelete,compareAndFork,restoreLongArchive,putLongWav,getLongWav,compareAndPut,restoreMetadata,async close(){(await database).close()},async list(){return request(STORE_NAME,'readonly',store=>store.getAll())},async get(id){return request(STORE_NAME,'readonly',store=>store.get(id))},async put(item){const value=clone(item);return database.then(db=>new Promise((resolve,reject)=>{
        const tx=openTransaction(db,STORE_NAME,'readwrite'),store=tx.objectStore(STORE_NAME);let failure;
        const abort=e=>{failure=e;try{tx.abort()}catch(_){reject(e)}};
        tx.onabort=()=>reject(failure||tx.error||Error('project-save-aborted'));tx.onerror=()=>abort(tx.error||Error('project-save-failed'));tx.oncomplete=()=>resolve(clone(value));
        const get=store.get(value.projectId);get.onerror=()=>abort(get.error);get.onsuccess=()=>{try{preserveFinishedSnapshots(get.result,value);const put=store.put(value);put.onerror=()=>abort(put.error)}catch(e){abort(e)}};
      }))},async delete(id){await request(STORE_NAME,'readwrite',store=>store.delete(id))},async has(id){return Boolean(await request(STORE_NAME,'readonly',store=>store.getKey(id)))},async getSettings(){return request(SETTINGS_STORE_NAME,'readonly',store=>store.get(SETTINGS_ID))},async putSettings(value){await request(SETTINGS_STORE_NAME,'readwrite',store=>store.put(clone(value)));return clone(value)},async listAutoBackups(){return request(AUTO_BACKUP_STORE_NAME,'readonly',store=>store.getAll())},async putAutoBackup(value){const record=clone({...value,archive:undefined});if(value.archive){if(typeof value.archive.slice!=='function')throw Error('backup-archive-blob-required');const encoded=await encodeLongBinary({id:value.backupId,blob:value.archive},()=>{});record.archive=encoded.blob||new Blob(encoded.parts,{type:encoded.type})}await request(AUTO_BACKUP_STORE_NAME,'readwrite',store=>store.put(record));return record},async deleteAutoBackup(id){await request(AUTO_BACKUP_STORE_NAME,'readwrite',store=>store.delete(id))},async listMidiHistory(){return request(MIDI_HISTORY_STORE_NAME,'readonly',store=>store.getAll())},async putMidiHistory(value){await request(MIDI_HISTORY_STORE_NAME,'readwrite',store=>store.put(clone(value)));return clone(value)},async listMidiImportHistory(){return request(MIDI_IMPORT_HISTORY_STORE_NAME,'readonly',store=>store.getAll())},async putMidiImportHistory(value){await request(MIDI_IMPORT_HISTORY_STORE_NAME,'readwrite',store=>store.put(clone(value)));return clone(value)}};
  }
  let repository=indexedDbRepository();
  function setRepository(next){if(localVocalJob?.phase==='requesting')cancelLocalScoreVocal(localVocalJob.id);cancelBackupRestore();repository=next}
  async function loadSettings(){let stored=null;try{stored=await repository.getSettings?.()}catch(error){console.warn('Music Studio settings could not be read',error)}const normalized=preserveRestoreSettings(stored||{});state.settings=normalized;state.settingsDraft=clone(normalized);if(!stored)try{await repository.putSettings?.(normalized)}catch(error){console.warn('Music Studio default settings could not be saved',error)}return normalized}
  async function refresh(){const target=repository,baseline=JSON.stringify(state.projects),projects=await target.list();if(repository!==target||JSON.stringify(state.projects)!==baseline)return{ok:false,stale:true};state.projects=projects.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));state.loaded=true;requestPaint();return{ok:true}}
  let noticeTimer=null;
  function clearNotice(){
    if(noticeTimer&&root.clearTimeout)root.clearTimeout(noticeTimer);
    noticeTimer=null;
    if(!state.notice)return;
    state.notice='';
    requestPaint();
  }
  function openHelp(id){const dialog=root.document?.getElementById?.(id);if(!dialog)return false;if(dialog.classList?.contains?.('music-external-track-review')&&typeof dialog.show==='function')dialog.show();else if(typeof dialog.showModal==='function')dialog.showModal();else if('hidden'in dialog){dialog.hidden=false;dialog.focus?.()}else dialog.setAttribute('open','');return true}
  function closeHelp(id){const dialog=root.document?.getElementById?.(id);if(!dialog)return false;if(typeof dialog.close==='function')dialog.close();else if('hidden'in dialog)dialog.hidden=true;else dialog.removeAttribute('open');return true}
  function prefersInlineFirstSongGuide(){const navigator=root.navigator||{},ua=String(navigator.userAgent||'');return/iPhone|iPod|iPad/i.test(ua)||navigator.platform==='MacIntel'&&Number(navigator.maxTouchPoints)>1}
  function openFirstSongWindow(){if(prefersInlineFirstSongGuide())return openHelp('firstSongGuide');const url=`${root.location?.pathname||'./music-studio.html'}${root.location?.search||''}#${FIRST_SONG_GUIDE_ROUTE}`,guide=root.open?.(url,'musicStudioFirstSongGuide','popup,width=720,height=900,resizable=yes,scrollbars=yes');if(!guide){openHelp('firstSongGuide');return false}guide.focus?.();return true}
  function focusMusicStudio(){if(root.opener&&!root.opener.closed){root.opener.focus?.();return true}routeTo(HOME_ROUTE);return false}
  function notice(message,kind='info'){
    if(noticeTimer&&root.clearTimeout)root.clearTimeout(noticeTimer);
    state.notice=message;state.noticeKind=kind;requestPaint();
    noticeTimer=root.setTimeout?.(()=>{noticeTimer=null;if(state.notice===message){state.notice='';requestPaint()}},2600)||null;
  }
  function routeTo(route){
    if(root.document?.body?.dataset.musicStudioStandalone==='true'){
      // Internal navigation is already guarded by its caller. Paint before a
      // pending save can make the subsequent hashchange look like an external leave.
      root.location.hash=route;lastRoute=route;paintStandalone();return;
    }
    if(typeof root.setView==='function'){
      if(root.setView(route)!==false)lastRoute=route;
      return;
    }
    root.location.hash=route;lastRoute=route;root.render?.();
  }
  function currentRoute(){return (root.location?.hash||`#${HOME_ROUTE}`).slice(1)||HOME_ROUTE}
  // Status repaints replace DOM nodes; keep keyboard focus on the same control
  // only within this route and only when its replacement remains visible.
  function paintFocusIdentity(element){
    if(!element?.getAttribute)return null;
    return JSON.stringify([element.tagName,...['id','name','type','aria-label','onclick','onchange','onsubmit'].map(k=>element.getAttribute(k)),/^(BUTTON|SUMMARY)$/.test(element.tagName)?element.textContent?.trim():null]);
  }
  function capturePaintFocus(){
    const document=root.document,active=document?.activeElement,key=paintFocusIdentity(active);
    if(!key||active===document.body)return null;
    const controls=Array.from(document.querySelectorAll?.('input,select,textarea,button,summary,a[href],[tabindex]')||[]).filter(e=>paintFocusIdentity(e)===key);
    const index=controls.indexOf(active);if(index<0)return null;
    const disclosures=[];for(let parent=active.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS'&&parent.open)disclosures.push(parent.querySelector?.(':scope > summary')?.textContent?.trim());
    return{key,index,disclosures,route:currentRoute(),start:active.selectionStart,end:active.selectionEnd,direction:active.selectionDirection};
  }
  function restorePaintFocus(saved){
    if(!saved||saved.route!==currentRoute())return;
    const controls=Array.from(root.document?.querySelectorAll?.('input,select,textarea,button,summary,a[href],[tabindex]')||[]).filter(e=>paintFocusIdentity(e)===saved.key),target=controls[saved.index];
    if(!target||target.disabled)return;
    for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS'&&saved.disclosures.includes(parent.querySelector?.(':scope > summary')?.textContent?.trim()))parent.open=true;
    if(!target.getClientRects?.().length)return;
    target.focus?.({preventScroll:true});
    if(Number.isInteger(saved.start)&&Number.isInteger(saved.end))try{target.setSelectionRange?.(saved.start,saved.end,saved.direction)}catch(_){}
  }
  function requestPaint(){
    const focused=capturePaintFocus();
    const checkpointPanel=root.document?.querySelector?.('.music-song-versions');if(checkpointPanel)versionPanel.open=checkpointPanel.open;
    // Keep the user's score-return controls through status/download repaints.
    // Retain the actual file input node: a selected local file is never serialized.
    const scoreControls=Array.from(root.document?.querySelectorAll?.('[data-score-return-key]')||[]).filter(detail=>detail.dataset?.scoreReturnKey&&detail.querySelector).map(detail=>({key:detail.dataset.scoreReturnKey,open:detail.open,audio:detail.querySelector('[name=audio]'),origin:detail.querySelector('[name=origin]')?.value,editAfter:detail.querySelector('[name=editAfter]')?.checked,options:Object.fromEntries(['trimStart','trimEnd','gain','latency'].map(k=>[k,detail.querySelector('[name='+k+']')?.value]))}));
    const replacements=Array.from(root.document?.querySelectorAll?.('[data-vocal-replacement]')||[]).filter(d=>d.dataset?.vocalReplacement).map(d=>({key:d.dataset.vocalReplacement,open:d.open,values:Object.fromEntries(['candidate','fade','gain'].map(k=>[k,d.querySelector('[name='+k+']')?.value]))}));
    repaintWorkspace();
    for(const d of Array.from(root.document?.querySelectorAll?.('[data-vocal-replacement]')||[])){const prior=replacements.find(x=>x.key===d.dataset.vocalReplacement);if(prior){d.open=prior.open;for(const [k,v] of Object.entries(prior.values)){const input=d.querySelector('[name='+k+']');if(input&&v!==undefined)input.value=v}}}
    for(const detail of Array.from(root.document?.querySelectorAll?.('[data-score-return-key]')||[])){
      const prior=scoreControls.find(item=>item.key===detail.dataset?.scoreReturnKey);if(!prior)continue;
      detail.open=prior.open;const audio=detail.querySelector('[name=audio]'),origin=detail.querySelector('[name=origin]');
      if(audio&&prior.audio){prior.audio.disabled=audio.disabled;audio.replaceWith(prior.audio)}
      if(origin)origin.value=prior.origin||'';
      const editAfter=detail.querySelector('[name=editAfter]');if(editAfter&&typeof prior.editAfter==='boolean')editAfter.checked=prior.editAfter;
      for(const [key,value] of Object.entries(prior.options||{})){const input=detail.querySelector('[name='+key+']');if(input&&value!==undefined)input.value=value;}
    }
    restorePaintFocus(focused);
    // Host chrome can move its existing menu toggle back after a DOM mutation.
    // Retry after that observer, without stealing focus from another control.
    root.queueMicrotask?.(()=>{if(root.document?.activeElement===root.document?.body)restorePaintFocus(focused)});
  }
  function repaintWorkspace(){return performanceMeasure('paintDispatch',()=>repaintWorkspaceMeasured())}
  function repaintWorkspaceMeasured(){const workspace=root.document?.querySelector?.('[data-workspace]');if(workspace)workspaceExpanded=workspace.open;if(root.document?.body?.dataset.musicStudioStandalone==='true')paintStandalone();else{root.render?.();restoreEditorPitchScroll()}}
  function statusBadge(status){return `<span class="music-status is-${status}">${STATUS_LABELS[status]}</span>`}
  function routeFor(item){return `${HOME_ROUTE}/${item.id}`}
  function navAction(item,standalone){if(item.action==='dream')return standalone?"location.href='./index.html#dream-architect'":"setView('dream-architect')";if(item.id==='midi-composer')return'MusicStudio.openMidiEditor()';return standalone?`location.hash='${routeFor(item)}'`:`setView('${routeFor(item)}')`}
  const TERM_HELP={BPM:'曲の速さ。数値が大きいほど速くなります。',拍子:'1小節に何拍あるかを表します。4/4は1小節に4拍です。',Key:'曲の中心になる音と調（メジャー／マイナー）です。',MIDI:'音そのものではなく、音程・長さ・強さなどの演奏データです。',Pitch:'音の高さです。MIDIでは0〜127の番号で表します。',Velocity:'ノートを鳴らす強さです。値が大きいほど強い演奏になります。',Snap:'ノートの位置や長さをグリッドに合わせます。',Grid:'ノートを置く時間位置の目盛りです。',Quantize:'演奏タイミングを指定したグリッドへ近づける補正です。',Swing:'交互のタイミングをずらして跳ねるリズム感を作ります。',PPQ:'1拍を何分割して記録するかを示すMIDIの時間解像度です。',Loop:'指定範囲を繰り返し再生します。',FitRange:'使用している音域が画面内に収まるように表示します。',Import:'外部ファイルの内容をMusic Studioへ取り込みます。',Export:'Music Studioの内容を外部ファイルとして書き出します。'};
  function helpButton(id,label='この画面のヘルプ'){return`<button type="button" class="music-help-button" aria-label="${escapeHtml(label)}" onclick="MusicStudio.openHelp('${escapeHtml(id)}')"><span aria-hidden="true">?</span><span class="music-help-button-label">ヘルプ</span></button>`}
  function firstSongHelpButton(label='Melody制作のヘルプ'){return`<button type="button" class="music-help-button music-editor-guide-button" aria-label="${escapeHtml(label)}" onclick="MusicStudio.openFirstSongWindow()"><span aria-hidden="true">?</span><span class="music-help-button-label">ヘルプ</span></button>`}
  function helpDialog(id,title,body){return`<dialog class="music-guide-dialog" id="${escapeHtml(id)}" aria-labelledby="${escapeHtml(id)}Title"><div class="music-guide-dialog-head"><h2 id="${escapeHtml(id)}Title">${escapeHtml(title)}</h2><button type="button" class="music-guide-close" aria-label="ヘルプを閉じる" onclick="MusicStudio.closeHelp('${escapeHtml(id)}')">× 閉じる</button></div>${body}</dialog>`}
  function steps(items){return`<ol class="music-guide-steps">${items.map(item=>`<li>${item}</li>`).join('')}</ol>`}
  function saveGuide(){return`<section class="music-save-guide" aria-labelledby="saveGuideTitle"><h3 id="saveGuideTitle">保存について</h3><div class="music-save-compare"><article><b>自動保存</b><p>Music Studio内部へ保存。同じ端末・同じブラウザで再度開くための保存です。クラウド同期ではありません。</p></article><article><b>JSON</b><p>Project全体の外部バックアップ。後からMusic Studioへ読み込んで復元できます。</p></article><article><b>MIDI</b><p>音程・長さなどの演奏データをLogic ProなどのDAWへ渡すファイルです。</p></article></div></section>`}
  function termsGuide(){return`<details class="music-terms-guide"><summary>用語を確認</summary><dl>${Object.entries(TERM_HELP).map(([term,description])=>`<div><dt>${escapeHtml(term==='FitRange'?'Fit Range':term)}</dt><dd>${escapeHtml(description)}</dd></div>`).join('')}</dl></details>`}
  function homeHelpDialog(){return helpDialog('musicHomeHelp','Music Studio Home ヘルプ',`${steps(['「新しい音楽プロジェクト」で曲の基本情報を作る','Projectを開き、Melody → Drums → Bassの順に制作する','Savedを確認し、必要な時にJSONバックアップを作る','Logic Proへ渡す時はMIDIを書き出す'])}${saveGuide()}${termsGuide()}`)}
  function firstSongGuideContent(){return`${steps(['新しいProjectを作る','プロジェクト名・曲名・BPM・拍子・Keyを設定する','Melody制作を開く','MIDIキーボードを使う場合は、上部の「MIDI入力」を押して使用するMIDIキーボードを選択する（SafariなどWeb MIDIを利用できない環境ではMac Chromeを使用）','「Record（録音）」を押してMIDIキーボードを弾き、「Stop（停止）」を押して録音を確定する。Piano Rollに録音したノートが表示されたことを確認する','Piano Rollでノートの位置・長さ・Velocityを修正する','Playで確認する','録音・編集後、上部の Saved（保存済み）を確認する（この端末・このブラウザのMusic Studio保存領域への自動保存。クラウド同期ではありません）','JSONを書き出してProject全体を外部バックアップする','Export Melody MIDIでMelodyの演奏データを書き出す','Logic ProでMIDIファイルを読み込む','Logic ProからStandard MIDI Fileを書き出し、Logic Pro IntegrationのImport MIDIでMusic Studioへ新規または複製として戻す'])}${saveGuide()}${termsGuide()}`}
  function firstSongDialog(){return helpDialog('firstSongGuide','最初の1曲を作る',firstSongGuideContent())}
  function firstSongGuideView(){return`<main class="music-studio-shell music-guide-window" aria-labelledby="firstSongWindowTitle"><header class="music-page-header"><p class="music-kicker">BEGINNER GUIDE（はじめての制作）</p><h1 id="firstSongWindowTitle">最初の1曲を作る</h1><p>Music Studio本体を操作しながら、このガイドを読み続けられます。</p><button type="button" class="music-primary" aria-label="Music Studio本体へ戻る" onclick="MusicStudio.focusMusicStudio()">← Music Studio本体へ戻る</button></header><section class="music-guide-window-content">${firstSongGuideContent()}</section></main>`}
  function card(item,standalone){const label=item.status==='available'?'開く':item.status==='working'?'入口を見る':'準備中ページを見る';return `<article class="music-feature-card is-${item.status}" data-music-feature-id="${escapeHtml(item.id)}"><div class="music-card-top"><span class="music-feature-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>${statusBadge(item.status)}</div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><button class="${item.status==='available'?'music-primary':'music-secondary'}" onclick="${navAction(item,standalone)}">${label}</button></article>`}
  function recentProjects(limit=3){const last=getLastProject();return [...state.projects].sort((a,b)=>a.projectId===last?-1:b.projectId===last?1:(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,limit)}
  function homeView(options={}){const standalone=Boolean(options.standalone),homeFeatures=FEATURES.filter(item=>item.id!=='dream-architect');const counts=Object.keys(STATUS_LABELS).map(status=>`<div><b>${homeFeatures.filter(item=>item.status===status).length}</b><span>${STATUS_LABELS[status]}</span></div>`).join('');const recent=recentProjects().map(project=>`<button class="music-recent-item" onclick="MusicStudio.openProject('${escapeHtml(project.projectId)}')"><b>${escapeHtml(project.projectName)}</b><span>${escapeHtml(project.songTitle||'曲名未設定')} · ${formatDate(project.updatedAt)}</span></button>`).join('')||'<p class="music-empty">プロジェクトはまだありません。「新しい音楽プロジェクト」から始められます。</p>';return `<main class="music-studio-shell" aria-label="Music Studio操作とプロジェクト"><nav class="music-quick-nav" aria-label="Music Studio主要ナビゲーション"><button class="music-primary" onclick="${navAction(FEATURES[0],standalone)}">＋ 新しい音楽プロジェクト</button><button class="music-secondary" onclick="${navAction(FEATURES[1],standalone)}">プロジェクト一覧</button></nav><section class="music-recent" aria-labelledby="musicRecentTitle"><div class="music-section-heading"><div><p class="music-kicker">Recent（最近使った曲）</p><h2 id="musicRecentTitle">最近使ったプロジェクト</h2></div></div>${recent}</section><section class="music-status-summary" aria-label="機能の状態">${counts}</section><section aria-labelledby="musicFeaturesTitle"><div class="music-section-heading"><div><p class="music-kicker">Workspace（作業領域）</p><h2 id="musicFeaturesTitle">制作メニュー</h2></div></div><div class="music-feature-grid">${homeFeatures.map(item=>card(item,standalone)).join('')}</div></section><footer class="music-footer"><p><b>独立保存：</b>Music Studio専用領域を使用し、既存アプリの保存データは変更しません。</p></footer></main>`}
  function flowNavigation(){return ''}
  function logicFlowNavigation(project){return project?flowNavigation('プロジェクト詳細',`MusicStudio.openProject('${escapeHtml(project.projectId)}')`,'Music Studio設定','MusicStudio.goSettings()'):flowNavigation('Music Studioホーム','MusicStudio.goHome()','Music Studio設定','MusicStudio.goSettings()')}
  function backButton(){const editorId=midiEditorId(currentRoute());return editorId?flowNavigation('プロジェクト詳細',`MusicStudio.openProject('${escapeHtml(editorId)}')`,'Music Studioホーム','MusicStudio.goHome()'):currentRoute()===LOGIC_PRO_ROUTE?logicFlowNavigation(selectedMidiProject()):flowNavigation('Music Studioホーム','MusicStudio.goHome()','プロジェクト一覧','MusicStudio.goProjects()')}
  function noticeView(){return state.notice?`<div class="music-notice is-${state.noticeKind}" role="status"><span>${escapeHtml(state.notice)}</span><button type="button" aria-label="通知を閉じる" onclick="MusicStudio.clearNotice()">×</button></div>`:''}
  function formFields(project={}){const ts=project.musicalSettings?.timeSignature;const signature=ts?`${ts.numerator}/${ts.denominator}`:'4/4';const key=project.musicalSettings?.key??'';const signatures=['2/4','3/4','4/4','5/4','6/8','7/8','12/8'];const keys=['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B','Cm','C#m','Dbm','Dm','D#m','Ebm','Em','Fm','F#m','Gbm','Gm','G#m','Abm','Am','A#m','Bbm','Bm','C♯/D♭','D♯/E♭','F♯/G♭','G♯/A♭','A♯/B♭'];return `<div class="music-form-grid"><label for="msProjectName">プロジェクト名 <span aria-hidden="true">*</span><input id="msProjectName" name="projectName" required maxlength="120" value="${escapeHtml(project.projectName||'')}"></label><label for="msSongTitle">曲名<input id="msSongTitle" name="songTitle" maxlength="120" value="${escapeHtml(project.songTitle||'')}"></label><label class="music-span-2" for="msPurpose">制作目的または使用作品<input id="msPurpose" name="purpose" maxlength="240" value="${escapeHtml(project.purpose||'')}"></label><label for="msBpm">BPM<input id="msBpm" name="bpm" type="number" min="20" max="400" inputmode="decimal" step="0.001" required value="${escapeHtml(formatBpmDisplay(project.musicalSettings?.bpm??120))}"></label><label for="msTimeSignature">拍子<select id="msTimeSignature" name="timeSignature">${signatures.map(value=>`<option ${signature===value?'selected':''}>${value}</option>`).join('')}</select></label><label for="msKey">キー<select id="msKey" name="key"><option value="">未設定</option>${keys.map(value=>`<option ${key===value?'selected':''}>${value}</option>`).join('')}</select></label><label for="msStatus">制作状態<select id="msStatus" name="status">${Object.entries(PROJECT_STATUS_LABELS).map(([value,label])=>`<option value="${value}" ${(project.status||'idea')===value?'selected':''}>${label}</option>`).join('')}</select></label><label class="music-span-2" for="msProductionNotes">制作メモ<textarea id="msProductionNotes" name="productionNotes" rows="6" maxlength="10000">${escapeHtml(project.productionNotes||'')}</textarea></label></div>`}
  function createView(){const d=state.settings?.projectDefaults||defaultSettings().projectDefaults;const project=makeProject({projectName:'',bpm:d.bpm,timeSignature:d.timeSignature,key:d.key,status:d.status,purpose:d.purpose,productionNotes:d.notes});return `<main class="music-studio-shell music-project-page" aria-labelledby="musicCreateTitle">${flowNavigation('プロジェクト一覧','MusicStudio.goProjects()','プロジェクト一覧','MusicStudio.goProjects()')}${noticeView()}<section class="music-project-panel"><p class="music-kicker">New project（新規プロジェクト）</p><h1 id="musicCreateTitle">新しい音楽プロジェクト</h1><p class="music-lead">入力内容はMusic Studio専用領域へ保存されます。</p><form id="musicProjectForm" oninput="MusicStudio.markDirty()" onsubmit="MusicStudio.submitCreate(event)">${formFields(project)}<div class="music-form-actions"><button class="music-primary" type="submit">作成して保存</button><button class="music-secondary" type="button" onclick="MusicStudio.cancelEdit()">キャンセル</button><span class="music-save-state" data-dirty="${state.dirty}" aria-live="polite">${state.dirty?'未保存の変更があります':'未変更'}</span></div></form></section></main>`}
  function projectRow(project){return `<article class="music-project-row"><div><h2>${escapeHtml(project.projectName)}</h2><p>${escapeHtml(project.songTitle||'曲名未設定')} · ${escapeHtml(PROJECT_STATUS_LABELS[project.status]||project.status)} · BPM ${escapeHtml(project.musicalSettings?.bpm)} · ${escapeHtml(project.musicalSettings?.key||'キー未設定')}</p><small>最終更新：${formatDate(project.updatedAt)}</small></div><button class="music-primary" onclick="MusicStudio.openProject('${escapeHtml(project.projectId)}')">開く</button></article>`}
  function matchingProjects(value=''){
    const query=String(value).normalize('NFKC').trim().toLocaleLowerCase('ja');
    return state.projects.filter(project=>!query||[project.projectName,project.songTitle,project.purpose].some(field=>String(field||'').normalize('NFKC').toLocaleLowerCase('ja').includes(query))||finishedVersions(project,query).length>0).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
  }
  function listView(){const query=state.search.normalize('NFKC').trim().toLocaleLowerCase('ja');const items=matchingProjects(query);return `<main class="music-studio-shell music-project-page" aria-labelledby="musicProjectsTitle">${flowNavigation('Music Studioホーム','MusicStudio.goHome()','新しい音楽プロジェクト','MusicStudio.goNew()')}${noticeView()}<section class="music-project-panel"><div class="music-section-heading"><div><p class="music-kicker">Projects（プロジェクト一覧）</p><h1 id="musicProjectsTitle">音楽プロジェクト</h1></div><button class="music-primary" onclick="MusicStudio.goNew()">＋ 新規作成</button></div><label class="music-search" for="musicProjectSearch">プロジェクトを検索<input id="musicProjectSearch" type="search" value="${escapeHtml(state.search)}" placeholder="プロジェクト名・曲名・使用作品・完成版" oninput="MusicStudio.searchProjects(this.value)"></label><div class="music-project-list">${state.loaded?(items.map(projectRow).join('')||`<div class="music-empty"><p>${query?'検索条件に一致するプロジェクトはありません。':'プロジェクトはまだありません。'}</p><button class="music-primary" onclick="MusicStudio.goNew()">最初のプロジェクトを作る</button></div>`):'<p class="music-empty">プロジェクトを読み込んでいます…</p>'}</div><div class="music-import-box"><label for="musicProjectImport">JSONから読み込む<input id="musicProjectImport" type="file" accept="application/json,.json" onchange="MusicStudio.importFile(this.files[0]);this.value=''" hidden></label><button class="music-secondary" onclick="document.querySelector('#musicProjectImport').click()">JSONを読み込む</button><p>既存データを消さず、Version 1形式を新規または複製として追加します。</p></div></section></main>`}
  function editView(id){const project=state.projects.find(item=>item.projectId===id);if(!project)return `<main class="music-studio-shell music-project-page">${flowNavigation('プロジェクト一覧','MusicStudio.goProjects()','Music Studioホーム','MusicStudio.goHome()')}<div class="music-empty"><h1>プロジェクトが見つかりません</h1><p>削除済みか、URLが正しくない可能性があります。</p><button class="music-primary" onclick="MusicStudio.goProjects()">一覧へ戻る</button></div></main>`;return `<main class="music-studio-shell music-project-page" aria-labelledby="musicEditTitle">${flowNavigation('プロジェクト一覧','MusicStudio.goProjects()','Melody制作',`MusicStudio.openPart('${escapeHtml(project.projectId)}','melody')`)}${noticeView()}<section class="music-project-panel"><div class="music-section-heading"><div><p class="music-kicker">Project（プロジェクト）</p><h1 id="musicEditTitle">${escapeHtml(project.projectName)}</h1><p>作成：${formatDate(project.createdAt)} / 更新：${formatDate(project.updatedAt)} / Revision ${project.revision}</p></div></div><details class="music-project-details"><summary>Project settings（曲の設定）</summary><form id="musicProjectForm" oninput="MusicStudio.markDirty()" onsubmit="MusicStudio.submitEdit(event,'${escapeHtml(project.projectId)}')">${formFields(project)}<div class="music-form-actions"><button class="music-primary" type="submit">変更を保存</button><button class="music-secondary" type="button" onclick="MusicStudio.cancelEdit('${escapeHtml(project.projectId)}')">キャンセル</button><span class="music-save-state" data-dirty="${state.dirty}">${state.dirty?'未保存の変更があります':'保存済み'}</span></div></form>${referenceFilesView(project)}</details>${versionView(project)}${vocalView(project)}<details class="music-project-details"><summary>Project tools（読み込み・バックアップ・管理）</summary>${productionToolsView(project)}<div class="music-project-tools"><button class="music-primary" onclick="MusicStudio.openPart('${escapeHtml(project.projectId)}','melody')">Melody制作を開く</button><button class="music-secondary" onclick="MusicStudio.openPart('${escapeHtml(project.projectId)}','drums')">Drums制作を開く</button><button class="music-secondary" onclick="MusicStudio.openPart('${escapeHtml(project.projectId)}','bass')">Bass制作を開く</button><button class="music-secondary" onclick="MusicStudio.openMidiEditor('${escapeHtml(project.projectId)}')">共通MIDIエディター</button><button class="music-secondary" onclick="MusicStudio.openLogicPro('${escapeHtml(project.projectId)}')">MIDI読み込み・Logic Pro</button><button class="music-secondary" onclick="MusicStudio.pcmOpen('${escapeHtml(project.projectId)}')">Mix / Gain（音声の音量処理）</button><button class="music-secondary" onclick="MusicStudio.openLyricsAssignment('${escapeHtml(project.projectId)}')">Lyrics / Notes（歌詞割付）</button><button class="music-secondary" onclick="MusicStudio.duplicateProject('${escapeHtml(project.projectId)}')">複製</button><button class="music-secondary" onclick="MusicStudio.exportProject('${escapeHtml(project.projectId)}')">JSON書き出し</button><button class="music-danger" onclick="MusicStudio.askDelete('${escapeHtml(project.projectId)}')">このプロジェクトを削除</button></div></details></section></main>`}
  // Explicit reading tokens map to existing note identities; no text/model inference.
  const LYRICS_ASSIGNMENT_FORMAT='music-studio-lyrics-note-assignment';
  const lyricsEditor={projectId:null,input:null,preview:null,busy:false,message:'',pending:false};
  function lyricsAssignmentPreview(project,input){
    if(!validateProject(project).valid||!Number.isSafeInteger(project.revision)||project.revision>=Number.MAX_SAFE_INTEGER)throw Error('invalid-lyrics-project');
    if(!input||typeof input.trackId!=='string'||!input.trackId)throw Error('lyrics-track-required');
    const matches=(project.midiData?.tracks||[]).filter(t=>t.id===input.trackId);
    if(matches.length!==1)throw Error('lyrics-track-identity-required');
    const track=matches[0];if(track.part==='drums'||track.roleAssignment==='drums'||track.trackType==='midi-drums'||track.isDrum===true)throw Error('lyrics-pitched-track-required');
    if(!Array.isArray(track.notes)||!track.notes.length||track.notes.length>100000)throw Error('lyrics-notes-required');
    const notes=clone(track.notes).sort((a,b)=>a.startTick-b.startTick||String(a.id).localeCompare(String(b.id))),ids=new Set();
    for(const note of notes){if(typeof note.id!=='string'||!note.id||ids.has(note.id)||!Number.isSafeInteger(note.startTick)||note.startTick<0||!Number.isSafeInteger(note.durationTicks)||note.durationTicks<1||!Number.isSafeInteger(note.startTick+note.durationTicks)||!Number.isInteger(note.pitch)||note.pitch<0||note.pitch>127)throw Error('invalid-lyrics-note');ids.add(note.id)}
    if(!Number.isSafeInteger(input.fromNote)||!Number.isSafeInteger(input.toNote)||input.fromNote<1||input.toNote<input.fromNote||input.toNote>notes.length)throw Error('invalid-lyrics-note-range');
    const selected=notes.slice(input.fromNote-1,input.toNote);
    if(selected.length>4096)throw Error('lyrics-range-too-large');
    let previousEnd=0;for(let index=0;index<notes.length;index++){const note=notes[index];if(index>=input.fromNote-1&&index<input.toNote&&(previousEnd>note.startTick||(notes[index+1]&&notes[index+1].startTick<note.startTick+note.durationTicks)))throw Error('lyrics-monophonic-range-required');previousEnd=Math.max(previousEnd,note.startTick+note.durationTicks)}
    if(typeof input.text!=='string'||!input.text.trim()||input.text.length>10000||typeof input.reading!=='string'||input.reading.length>10000)throw Error('lyrics-text-required');
    const tokens=input.reading.trim().split(/\s+/u);if(tokens.length!==selected.length||tokens.some(t=>!t||t.length>64))throw Error('lyrics-token-note-count-mismatch');
    if(tokens[0]==='~')throw Error('lyrics-extension-needs-syllable');
    let syllable=-1;
    const assignments=selected.map((note,index)=>{const extend=tokens[index]==='~';if(!extend)syllable++;return{noteId:note.id,startTick:note.startTick,durationTicks:note.durationTicks,pitch:note.pitch,token:tokens[index],syllableIndex:syllable,extendsPrevious:extend}});
    if(project.syllableAssignments!==undefined&&!Array.isArray(project.syllableAssignments))throw Error('invalid-existing-lyrics-assignments');
    return{format:LYRICS_ASSIGNMENT_FORMAT,version:1,projectId:project.projectId,baseline:JSON.stringify(project),input:clone(input),trackId:track.id,text:input.text,reading:input.reading,assignments,mutates:false};
  }
  function adoptLyricsAssignment(project,preview){
    if(preview?.format!==LYRICS_ASSIGNMENT_FORMAT||preview.version!==1||preview.baseline!==JSON.stringify(project))throw Error('stale-lyrics-assignment-preview');
    const verified=lyricsAssignmentPreview(project,preview.input);
    if(JSON.stringify(verified)!==JSON.stringify(preview))throw Error('modified-lyrics-assignment-preview');
    const updated=clone(project),selected=new Set(verified.assignments.map(a=>a.noteId));
    updated.syllableAssignments=(updated.syllableAssignments||[]).flatMap(record=>{
      if(record?.format!==LYRICS_ASSIGNMENT_FORMAT||record.version!==1||record.trackId!==verified.trackId)return[record];
      if(!Array.isArray(record.assignments)||record.assignments.some(a=>!lyricsBindingValid(a)))throw Error('invalid-existing-lyrics-record');
      // Splitting a melisma would orphan extension notes. Reject rather than silently repair it.
      const touched=new Set(record.assignments.filter(a=>selected.has(a.noteId)).map(a=>a.syllableIndex));
      if(record.assignments.some(a=>touched.has(a.syllableIndex)&&!selected.has(a.noteId)))throw Error('lyrics-existing-syllable-boundary');
      const remaining=record.assignments.filter(a=>!selected.has(a.noteId));return remaining.length?[{...record,assignments:remaining}]:[];
    });
    const stamp=now();updated.syllableAssignments.push({format:LYRICS_ASSIGNMENT_FORMAT,version:1,id:uuid(),trackId:verified.trackId,text:verified.text,reading:verified.reading,assignments:clone(verified.assignments),createdAt:stamp});
    updated.revision++;updated.updatedAt=stamp;if(updated.aiWorkspace)updated.aiWorkspace=rebindAIWorkspace(updated.aiWorkspace,updated.projectId,updated.revision);
    if(!validateProject(updated).valid)throw Error('invalid-lyrics-assignment-result');return updated;
  }
  function lyricsBindingValid(a){return a&&typeof a.noteId==='string'&&a.noteId&&Number.isSafeInteger(a.startTick)&&a.startTick>=0&&Number.isSafeInteger(a.durationTicks)&&a.durationTicks>0&&Number.isInteger(a.pitch)&&a.pitch>=0&&a.pitch<=127&&typeof a.token==='string'&&Number.isSafeInteger(a.syllableIndex)&&a.syllableIndex>=0&&typeof a.extendsPrevious==='boolean'}
  function lyricsSavedRows(project){return(Array.isArray(project.syllableAssignments)?project.syllableAssignments:[]).filter(r=>r?.format===LYRICS_ASSIGNMENT_FORMAT&&r.version===1).map(record=>{
    const tracks=(project.midiData?.tracks||[]).filter(t=>t.id===record.trackId),notes=tracks.length===1?tracks[0].notes||[]:[];
    return{...clone(record),stale:!Array.isArray(record.assignments)||record.assignments.some(a=>{if(!lyricsBindingValid(a))return true;const found=notes.filter(n=>n.id===a.noteId);return found.length!==1||['startTick','durationTicks','pitch'].some(k=>found[0][k]!==a[k])})};
  })}
  function lyricsScoreXML(project,recordId,synthesisRange){
    if(!validateProject(project).valid)throw Error('invalid-score-project');
    const rows=lyricsSavedRows(project).filter(r=>r.id===recordId);
    if(rows.length!==1||rows[0].stale)throw Error('score-lyrics-stale-or-missing');
    const record=rows[0],notes=[...record.assignments].sort((a,b)=>a.startTick-b.startTick),data=project.midiData,meter=root.MusicStudioMeterMap;
    if(!meter||!notes.length||notes.length>4096)throw Error('score-notes-or-meter-unavailable');
    const tracks=data.tracks.filter(t=>t.id===record.trackId);
    if(tracks.length!==1||tracks[0].part==='drums'||tracks[0].roleAssignment==='drums'||tracks[0].isDrum||tracks[0].trackType==='midi-drums')throw Error('score-pitched-track-required');
    const ppq=data.ppq??480;if(!Number.isSafeInteger(ppq)||ppq<1||ppq>32767)throw Error('invalid-score-ppq');
    const xml=value=>{const str=String(value??'');if(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u.test(str))throw Error('invalid-score-xml-text');return str.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))};
    let previousEnd=0,previousSyllable=null;
    for(const n of notes){
      if(n.pitch<12||n.pitch>127)throw Error('score-pitch-outside-musicxml-octaves');
      if(tracks[0].notes.some(other=>other.id!==n.noteId&&other.startTick<n.startTick+n.durationTicks&&other.startTick+other.durationTicks>n.startTick))throw Error('score-monophonic-required');
      if(n.startTick<previousEnd||/\s/u.test(n.token)||n.token.length<1||n.token.length>64||n.extendsPrevious!==(n.token==='~')||(n.extendsPrevious?(previousSyllable===null||n.syllableIndex!==previousSyllable):(previousSyllable!==null&&n.syllableIndex<=previousSyllable)))throw Error('invalid-score-lyric-order');
      previousEnd=n.startTick+n.durationTicks;previousSyllable=n.syllableIndex;xml(n.token);
    }
    const end=previousEnd,last=meter.positionAtTick(data,end-1).measure;if(last>512)throw Error('score-limit-512-measures');
    // Project BPM is authoritative for vocal/MIDI playback, including tick zero.
    const initialTempo=Number(project.musicalSettings?.bpm??data.tempo??120),tempos=new Map([[0,initialTempo]]);
    if(data.tempoMap!=null&&!Array.isArray(data.tempoMap))throw Error('invalid-score-tempo-map');
    for(const t of data.tempoMap||[]){const bpm=Number(t.bpm??(t.microsecondsPerQuarter>0?60000000/t.microsecondsPerQuarter:NaN));if(!Number.isSafeInteger(t.tick)||t.tick<0||!Number.isFinite(bpm)||bpm<20||bpm>400)throw Error('invalid-score-tempo');if(tempos.has(t.tick)&&t.tick!==0&&tempos.get(t.tick)!==bpm)throw Error('conflicting-score-tempo');if(t.tick!==0)tempos.set(t.tick,bpm)}
    if([...tempos.values()].some(b=>!Number.isFinite(b)||b<20||b>400))throw Error('invalid-score-tempo');
    const tempoList=[...tempos].sort((a,b)=>a[0]-b[0]),measures=[],parts=[],divisions=ppq*32,scaled=n=>{const value=n*32;if(!Number.isSafeInteger(value)||value<0)throw Error('invalid-score-tick');return value},pitch=n=>{const pc=n%12,step=['C','C','D','D','E','F','F','G','G','A','A','B'][pc],alter=[1,3,6,8,10].includes(pc)?'<alter>1</alter>':'';return`<pitch><step>${step}</step>${alter}<octave>${Math.floor(n/12)-1}</octave></pitch>`};
    const firstMeasure=synthesisRange?.startMeasure??1,lastMeasure=synthesisRange?.endMeasure??last;
    if(!Number.isSafeInteger(firstMeasure)||!Number.isSafeInteger(lastMeasure)||firstMeasure<1||lastMeasure<firstMeasure||lastMeasure>512||notes.some(n=>n.startTick<meter.tickAtMeasure(data,firstMeasure)||n.startTick+n.durationTicks>meter.tickAtMeasure(data,lastMeasure+1)))throw Error('invalid-synthesis-measure-range');
    const rangeStart=meter.tickAtMeasure(data,firstMeasure);
    let noteIndex=0;
    for(let number=firstMeasure;number<=lastMeasure;number++){
      const start=meter.tickAtMeasure(data,number),position=meter.positionAtTick(data,start),finish=position.measureEndTick;
      if(!Number.isFinite(finish)||finish<=start)throw Error('invalid-score-measure');
      // Truncated measures preserve exact-tick meter changes (A specification).
      const implicit=finish-start<position.ticksPerMeasure,items=[`<attributes><divisions>${divisions}</divisions><time><beats>${position.numerator}</beats><beat-type>${position.denominator}</beat-type></time>${number===firstMeasure?'<clef><sign>G</sign><line>2</line></clef>':''}</attributes>`];
      if(number===firstMeasure&&rangeStart>0&&!tempos.has(rangeStart)){const inherited=tempoList.filter(([tick])=>tick<rangeStart).at(-1)[1];items.push(`<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${inherited}</per-minute></metronome></direction-type><sound tempo="${inherited}"/></direction>`);}
      for(const [tick,bpm] of tempoList)if(tick>=start&&tick<finish)items.push(`<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><offset sound="yes">${scaled(tick-start)}</offset><sound tempo="${bpm}"/></direction>`);
      let cursor=start;
      while(cursor<finish){
        while(noteIndex<notes.length&&notes[noteIndex].startTick+notes[noteIndex].durationTicks<=cursor)noteIndex++;
        const note=notes[noteIndex];
        if(!note||note.startTick>cursor){const stop=Math.min(finish,note?.startTick??finish);items.push(`<note><rest/><duration>${scaled(stop-cursor)}</duration></note>`);cursor=stop;continue}
        const stop=Math.min(finish,note.startTick+note.durationTicks),tieStop=cursor>note.startTick,tieStart=stop<note.startTick+note.durationTicks,ties=(tieStop?'<tie type="stop"/>':'')+(tieStart?'<tie type="start"/>':''),notations=(tieStop?'<tied type="stop"/>':'')+(tieStart?'<tied type="start"/>':'');
        const next=notes[noteIndex+1],continues=next?.extendsPrevious&&next.syllableIndex===note.syllableIndex;
        const lyric=note.extendsPrevious||tieStop?`<lyric><extend type="${tieStart||continues?'continue':'stop'}"/></lyric>`:`<lyric><syllabic>single</syllabic><text>${xml(note.token)}</text>${tieStart||continues?'<extend type="start"/>':''}</lyric>`;
        items.push(`<note>${pitch(note.pitch)}<duration>${scaled(stop-cursor)}</duration>${ties}${notations?`<notations>${notations}</notations>`:''}${lyric}</note>`);parts.push({noteId:note.noteId,startTick:cursor,durationTicks:stop-cursor,pitch:note.pitch,tieStop,tieStart});cursor=stop;
      }
      measures.push(`<measure number="${number}"${implicit?' implicit="yes"':''}>${items.join('')}</measure>`);
    }
    const text=`<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="4.0"><work><work-title>${xml(project.songTitle||project.projectName)}</work-title></work><identification><creator type="software">Music Studio</creator></identification><part-list><score-part id="P1"><part-name>${xml(tracks[0].name||record.trackId)}</part-name></score-part></part-list><part id="P1">${measures.join('')}</part></score-partwise>`;
    return{filename:`${safeFileName(project.projectName)}-vocal-score.musicxml`,text,source:{projectId:project.projectId,revision:project.revision,trackId:record.trackId,recordId},noteCount:notes.length,measureCount:lastMeasure-firstMeasure+1,parts,mutates:false,synthesisPerformed:false};
  }
  function scoreVocalTiming(project,recordId,origin='score-zero'){
    if(!['score-zero','first-note'].includes(origin))throw Error('score-vocal-origin-required');
    const score=lyricsScoreXML(project,recordId),firstTick=score.parts[0].startTick,lastTick=Math.max(...score.parts.map(n=>n.startTick+n.durationTicks));
    const startTick=origin==='score-zero'?0:firstTick,startSeconds=vocalPosition(project,startTick),endSeconds=vocalPosition(project,lastTick);
    return{startTick,startSeconds,firstNoteSeconds:vocalPosition(project,firstTick),endSeconds,minimumDurationSeconds:endSeconds-startSeconds,origin};
  }
  function scoreVocalLinkedView(project,record){
    const takes=(project.longWavAssets||[]).filter(a=>a.vocalTake?.scoreSource?.recordId===record.id&&a.vocalTake.scoreSource.trackId===record.trackId);
    if(!takes.length)return '<p>Imported takes（取り込み済み歌声）：なし</p>';
    let xml;try{xml=lyricsScoreXML(project,record.id).text}catch(_){}
    return `<div class="music-score-vocal-takes"><p>Imported takes（取り込み済み歌声）：${takes.length}</p>${takes.map(a=>{
      const current=xml===a.vocalTake.scoreSource.scoreXML,id=JSON.stringify(project.projectId),key=JSON.stringify(a.id),disabled=vocalBusy()?' disabled':'';
      return `<div><strong>${escapeHtml(a.name)}</strong><span> / ${current?'Current score（現在の楽譜）':'Previous score（以前の楽譜・同期を再確認）'}</span><button type="button" class="music-secondary"${disabled} onclick="${escapeHtml(`MusicStudio.vocalPlay(${id},${key},true)`)}">Play with MIDI（同期試聴）</button><button type="button" class="music-secondary"${disabled} onclick="${escapeHtml(`MusicStudio.openScoreVocalTake(${id},${key})`)}">Edit take（この歌声を編集）</button><button type="button" class="music-secondary"${disabled} onclick="${escapeHtml(`MusicStudio.vocalPublishForMix(${id},${key})`)}">Save for Mix（編集音声をミックスへ）</button><button type="button" class="music-secondary"${disabled} onclick="${escapeHtml(`MusicStudio.vocalTimelineExport(${id},${key})`)}">Timeline WAV（曲先頭から同期書出し）</button></div>`;
    }).join('')}</div>`;
  }
  async function openScoreVocalTake(id,assetId){
    const p=state.projects.find(p=>p.projectId===id);
    if(!p?.longWavAssets?.some(a=>a.id===assetId&&a.vocalTake?.scoreSource))return{ok:false,error:'score-vocal-take-missing'};
    const result=await vocalSelectTake(id,assetId);
    if(result.ok)openWorkAction('vocal',id);
    return result;
  }
  function exportLyricsScore(id,recordId){
    try{
      if(state.dirty||state.midiEditor?.dirty||state.midiInput?.recording)throw Error('変更・録音を保存してから書き出してください。');
      const p=state.projects.find(p=>p.projectId===id),result=lyricsScoreXML(p,recordId);
      if(root.document&&root.URL?.createObjectURL&&root.Blob){const url=root.URL.createObjectURL(new root.Blob([result.text],{type:'application/vnd.recordare.musicxml+xml;charset=utf-8'}));try{const link=root.document.createElement('a');link.href=url;link.download=result.filename;root.document.body.appendChild(link);link.click();link.remove()}finally{root.setTimeout?.(()=>root.URL.revokeObjectURL(url),1000)}}
      lyricsEditor.message='歌声用MusicXMLを書き出しました。音声は未生成です。対応する歌声ソフトで読み込み、生成WAVをVocalへ取り込めます。';requestPaint();return{ok:true,...result};
    }catch(error){lyricsEditor.message=`歌声用楽譜の書出し拒否: ${error.message}`;requestPaint();return{ok:false,error:error.message}}
  }
  async function inspectScoreVocal(file,project,recordId,origin,options={},guard=()=>{}){
    const timing=scoreVocalTiming(project,recordId,origin);
    if(options.compactRange===true){
      if(!options.localSinsy||!options.generationRange||origin!=='score-zero')throw Error('compact-vocal-range-binding-required');
      const selected=vocalRangeProject(project,recordId,options.generationRange);
      lyricsScoreXML(japaneseVocalProject(selected,recordId),recordId,options.generationRange);
      timing.startTick=root.MusicStudioMeterMap.tickAtMeasure(project.midiData,options.generationRange.startMeasure);
      timing.startSeconds=vocalPosition(project,timing.startTick);
      timing.endSeconds=vocalPosition(project,root.MusicStudioMeterMap.tickAtMeasure(project.midiData,options.generationRange.endMeasure+1));
      timing.minimumDurationSeconds=timing.endSeconds-timing.startSeconds;
    }
    if(!file||typeof file.name!=='string'||!file.name.trim()||file.name.length>240||file.size>VOCAL_MAX_BYTES)throw Error('score-vocal-file-invalid');
    const blob=new Blob([file],{type:'audio/wav'});let frames=0,sampleRate=0,channels=0,clipped=0,peak=0;
    for await(const pcm of pcmDecodeWavStream(blob)){
      guard();sampleRate=pcm.sampleRate;channels=pcm.channels.length;frames+=pcm.channels[0].length;
      if((options.localSinsy||options.generationRange)&&frames>sampleRate*VOCAL_MAX_SECONDS)throw Error('score-vocal-limit-120s');
      for(let i=0;i<pcm.channels[0].length;i++){let value=0;for(const c of pcm.channels)value=Math.max(value,Math.abs(c[i]));peak=Math.max(peak,value);if(value>=1)clipped++;}
    }
    const first=options.trimStartSeconds===undefined?0:Math.round(options.trimStartSeconds*sampleRate),end=options.trimEndSeconds===undefined?frames:Math.round(options.trimEndSeconds*sampleRate);
    if((options.trimStartSeconds!==undefined&&typeof options.trimStartSeconds!=='number')||(options.trimEndSeconds!==undefined&&typeof options.trimEndSeconds!=='number'))throw Error('score-vocal-trim-invalid');
    const edit=vocalSetting({frames},{first,end,gainDb:options.gainDb??0,latencyMs:options.latencyMs??0,startTick:timing.startTick});
    return{blob,frames,sampleRate,channels,clipped,peak,edit,timing,durationSeconds:frames/sampleRate,selectedDurationSeconds:(end-first)/sampleRate,shortfallSeconds:Math.max(0,timing.minimumDurationSeconds-(end-first)/sampleRate),silent:peak===0};
  }
  async function inspectScoreVocalForm(button,id,recordId){
    const form=button?.form,output=form?.querySelector('[data-score-audio-report]'),file=form?.elements?.audio?.files?.[0],origin=form?.elements?.origin?.value;
    if(!output)return{ok:false,error:'score-vocal-form-missing'};
    const project=state.projects.find(p=>p.projectId===id),baseline=JSON.stringify(project),values=()=>JSON.stringify(['origin','trimStart','trimEnd','gain','latency'].map(k=>form.elements[k]?.value));
    const inputs=values(),guard=()=>{if(form.isConnected===false||form.elements.audio.files[0]!==file||values()!==inputs||JSON.stringify(state.projects.find(p=>p.projectId===id))!==baseline)throw Error('score-vocal-preview-stale')};
    button.disabled=true;output.textContent='WAVを確認中…';
    try{const r=await inspectScoreVocal(file,project,recordId,origin,scoreVocalFormOptions(form),guard);guard();output.textContent=`WAV ${r.durationSeconds.toFixed(3)} 秒 / ${r.sampleRate} Hz / ${r.channels} ch / 選択範囲 ${r.selectedDurationSeconds.toFixed(3)} 秒 / 楽譜の必要長 ${r.timing.minimumDurationSeconds.toFixed(3)} 秒 / 不足 ${r.shortfallSeconds.toFixed(3)} 秒 / クリップ ${r.clipped} フレーム${r.silent?' / 全サンプル無音':''}。保存前の確認です。`;return{ok:true};}
    catch(e){output.textContent='WAVを確認できません：'+e.message;return{ok:false,error:e.message};}finally{button.disabled=false;}
  }
  function scoreVocalFormOptions(form){
    const number=(key,fallback)=>{const value=form?.elements?.[key]?.value;return value===undefined||value===''?fallback:Number(value)};
    return{trimStartSeconds:number('trimStart',0),trimEndSeconds:number('trimEnd',undefined),gainDb:number('gain',0),latencyMs:number('latency',0)};
  }
  async function importScoreVocal(file,id,recordId,origin,options={}){
    if(vocalBusy()||pcmEditor.busy||archiveTransfer.busy||finalExport.busy||shutdownPromise||state.dirty||midiEditorHasPendingChanges()||state.midiInput.recording||state.midiInput.starting)return{ok:false,error:'score-vocal-busy'};
    const target=repository,project=state.projects.find(p=>p.projectId===id),baseline=JSON.stringify(project),token=vocal.generation;
    const guard=()=>{if(target!==repository||token!==vocal.generation||shutdownPromise||archiveTransfer.busy||state.dirty||midiEditorHasPendingChanges()||state.midiInput.recording||state.midiInput.starting||JSON.stringify(state.projects.find(p=>p.projectId===id))!==baseline)throw Error('score-vocal-stale')};
    vocal.phase='saving';vocalPlaybackStop();requestPaint();
    try{
      guard();if(target.kind!=='indexeddb'||!target.putLongWav)throw Error('score-vocal-durable-storage-required');
      if(!['score-zero','first-note'].includes(origin))throw Error('score-vocal-origin-required');
      const scoreProject=vocalRangeProject(project,recordId,options.generationRange),score=lyricsScoreXML(options.localSinsy?japaneseVocalProject(scoreProject,recordId):scoreProject,recordId);
      // Copy user-selected bytes once; validation, hashing and commit use this same immutable Blob.
      const {blob,frames,sampleRate,channels,clipped,edit}=await inspectScoreVocal(file,project,recordId,origin,options,guard),waveform=[];
      waveform.push(...Array(240).fill(0));let position=0;
      for await(const pcm of pcmDecodeWavStream(blob)){guard();for(let i=0;i<pcm.channels[0].length;i++){const bucket=Math.min(239,Math.floor((position+i)*240/frames));for(const c of pcm.channels)waveform[bucket]=Math.max(waveform[bucket],Math.abs(c[i]))}position+=pcm.channels[0].length}
      const hashes=await longWavDigest(blob,guard);guard();const current=await target.get(id);guard();if(JSON.stringify(current)!==baseline)throw Error('score-vocal-storage-conflict');
      const original={first:0,end:frames,gainDb:0,startTick:edit.startTick,latencyMs:0},edits=Object.keys(original).every(k=>original[k]===edit[k])?[original]:[original,edit];
      const assetId=uuid(),asset={id:assetId,name:file.name,size:blob.size,frames,sampleRate,channels,hashes,vocalTake:{format:'nova-vocal-take-v1',captureMime:'audio/wav',clippedSamples:clipped,waveform,cursor:edits.length-1,edits,scoreSource:{format:'nova-score-vocal-source-v1',recordId,trackId:score.source.trackId,origin,trimOriginFrame:edit.first,scoreXML:score.text,...(options.generationRange?{generationRange:clone(options.generationRange)}:{}),...(options.localSinsy?{engine:'Sinsy-0.92',voice:'NIT-SONG070-F001'}:{})}}};
      vocalHistory(asset);const updated=clone(current);updated.longWavAssets=[...(updated.longWavAssets||[]),asset];updated.vocalWorkspace={...vocalWorkspace(updated),selectedAssetId:assetId};updated.revision++;updated.updatedAt=now();if(updated.aiWorkspace)updated.aiWorkspace=rebindAIWorkspace(updated.aiWorkspace,id,updated.revision);automaticEditRecord(current,updated,'vocal-editor');
      if(!validateProject(updated).valid)throw Error('score-vocal-project-invalid');
      await target.putLongWav(updated,{id:assetId,blob,hashes},baseline,guard);state.projects=state.projects.map(p=>p.projectId===id?updated:p);vocal.phase='saved';
      lyricsEditor.message='歌声WAVを保存しました。Vocal（ボーカル編集）で同期位置・音量・カット・試聴を調整できます。Full WAV Archiveに音声本体を保存できます。';vocal.message=lyricsEditor.message;return{ok:true,assetId,project:updated};
    }catch(e){vocal.phase='error';lyricsEditor.message='歌声WAVを保存できません：'+e.message;vocal.message=lyricsEditor.message;return{ok:false,error:e.message}}finally{requestPaint()}
  }
  async function importScoreVocalForm(event,id,recordId){
    event?.preventDefault();const form=event?.target,editAfter=form?.elements?.editAfter?.checked;
    const result=await importScoreVocal(form?.elements?.audio?.files?.[0],id,recordId,form?.elements?.origin?.value,scoreVocalFormOptions(form));
    if(result.ok&&editAfter)openWorkAction('vocal',id);
    return result;
  }
  async function localGenerationRequest(kind,payload,options={}){
    if(!(root.location?.hostname==='127.0.0.1'||root.__NOVA_GENERATION_HOST__===true)||!['compose','sing','cancel-compose','cancel-sing'].includes(kind))throw Error('local-generation-host-required');
    const statusResponse=await root.fetch('/__nova_generation/status',{signal:options.signal});if(!statusResponse.ok)throw Error('local-generation-host-required');
    const status=await statusResponse.json();if(!(kind==='sing'||kind==='cancel-sing'?status.singer:status.composer))throw Error('local-generation-assets-not-configured');
    const response=await root.fetch(`/__nova_generation/${kind}`,{method:'POST',headers:{'Content-Type':'application/json','X-Nova-Generation':status.token},body:JSON.stringify(payload),signal:options.signal});
    const result=await response.json();if(!response.ok)throw Error(result.error||'local-generation-failed');return result;
  }
  function vocalRangeProject(project,recordId,range){
    if(range===undefined)return project;
    const meter=root.MusicStudioMeterMap;
    if(!meter||!range||!Number.isSafeInteger(range.startMeasure)||!Number.isSafeInteger(range.endMeasure)||range.startMeasure<1||range.endMeasure<range.startMeasure||range.endMeasure>512)throw Error('invalid-vocal-measure-range');
    // Check the full binding before extracting notes. A stale out-of-range note cannot be hidden.
    lyricsScoreXML(project,recordId);
    const start=meter.tickAtMeasure(project.midiData,range.startMeasure),end=meter.tickAtMeasure(project.midiData,range.endMeasure+1),updated=clone(project),record=updated.syllableAssignments.find(r=>r.id===recordId);
    const selected=record.assignments.filter(a=>a.startTick<end&&a.startTick+a.durationTicks>start);
    if(!selected.length)throw Error('vocal-range-has-no-lyrics');
    if(selected.some(a=>a.startTick<start||a.startTick+a.durationTicks>end))throw Error('vocal-range-cuts-note: 音符全体を含む小節を選んでください。');
    const syllables=new Set(selected.map(a=>a.syllableIndex));
    if(record.assignments.some(a=>syllables.has(a.syllableIndex)&&!selected.some(n=>n.noteId===a.noteId)))throw Error('vocal-range-cuts-syllable: 伸ばす音符全体を含めてください。');
    record.assignments=selected;record.reading=selected.map(a=>a.token).join(' ');
    return updated;
  }
  function generateLocalScoreVocalRange(button,id,recordId){
    const form=button?.closest?.('[data-vocal-generation]');
    if(!form)return Promise.resolve({ok:false,error:'vocal-range-form-required'});
    return generateLocalScoreVocal(id,recordId,{startMeasure:Number(form.querySelector('[name=startMeasure]').value),endMeasure:Number(form.querySelector('[name=endMeasure]').value)});
  }
  function japaneseVocalProject(project,recordId){
    const updated=clone(project),records=(updated.syllableAssignments||[]).filter(r=>r.id===recordId);
    if(records.length!==1||!Array.isArray(records[0].assignments))throw Error('score-lyrics-stale-or-missing');
    for(const assignment of records[0].assignments){
      if(assignment.token==='~')continue;
      const token=assignment.token.normalize('NFKC').normalize('NFC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
      if(!token||token.length>64||!/^[ぁ-ゖー]+$/u.test(token))throw Error('音符 '+assignment.noteId+' の読みをかなで指定してください。漢字の読みは自動推測しません。');
      kanaReadingTokens(token);assignment.token=token;
    }
    return updated;
  }
  let localVocalJob=null;
  function cancelLocalScoreVocal(id){
    const job=localVocalJob;if(!job||job.id!==id||job.phase!=='requesting')return{ok:false,error:'local-vocal-not-cancellable'};
    job.cancelled=true;job.controller?.abort();
    if(!job.cancelRequest){
      const controller=typeof root.AbortController==='function'?new root.AbortController():null;
      const timer=root.setTimeout?.(()=>controller?.abort(),5000);
      job.cancelRequest=localGenerationRequest('cancel-sing',{requestId:job.requestId},{signal:controller?.signal})
        .then(()=>({ok:true})).catch(()=>({ok:false})).finally(()=>root.clearTimeout?.(timer));
    }
    requestPaint();return{ok:true};
  }
  async function generateLocalScoreVocal(id,recordId,range){
    const p=state.projects.find(p=>p.projectId===id);if(!p||!(root.location?.hostname==='127.0.0.1'||root.__NOVA_GENERATION_HOST__===true))return{ok:false,error:'local-generation-host-required'};
    if(localVocalJob||vocalBusy()||pcmEditor.busy||archiveTransfer.busy||finalExport.busy||shutdownPromise||state.dirty||midiEditorHasPendingChanges()||state.midiInput.recording||state.midiInput.starting)return{ok:false,error:'local-vocal-production-busy'};
    const baseline=JSON.stringify(p),target=repository;
    const job={id,recordId,requestId:'sing_'+uuid().replace(/[^A-Za-z0-9_-]/g,''),phase:'requesting',cancelled:false,controller:typeof root.AbortController==='function'?new root.AbortController():null};
    localVocalJob=job;requestPaint();
    const timer=root.setTimeout?.(()=>cancelLocalScoreVocal(id),130000);
    try{
      // Refuse a stale stored score before starting a local synthesis job.
      const stored=await target.get(id);
      if(job.cancelled||localVocalJob!==job)throw Error('local-vocal-cancelled');
      if(repository!==target||JSON.stringify(stored)!==baseline||JSON.stringify(state.projects.find(p=>p.projectId===id))!==baseline||state.dirty||midiEditorHasPendingChanges())throw Error('score-changed-before-generation');
      const score=lyricsScoreXML(japaneseVocalProject(vocalRangeProject(p,recordId,range),recordId),recordId,range);
      const result=await localGenerationRequest('sing',{scoreXML:score.text,requestId:job.requestId},{signal:job.controller?.signal});
      if(job.cancelled||localVocalJob!==job)throw Error('local-vocal-cancelled');
      if(repository!==target||state.projects.find(p=>p.projectId===id)!==p||JSON.stringify(p)!==baseline)throw Error('score-changed-during-generation');
      if(typeof result.wavBase64!=='string'||result.wavBase64.length>Math.ceil(VOCAL_MAX_BYTES/3)*4)throw Error('local-vocal-response-size');
      const bytes=Uint8Array.from(root.atob(result.wavBase64),x=>x.charCodeAt(0)),file=new root.File([bytes],'Sinsy-NIT-SONG070-F001.wav',{type:'audio/wav'});
      job.phase='importing';root.clearTimeout?.(timer);
      return await importScoreVocal(file,id,recordId,'score-zero',{generationRange:range,localSinsy:true,compactRange:range!==undefined});
    }catch(error){
      const cancelled=job.cancelled;
      if(job.phase==='requesting')cancelLocalScoreVocal(id);
      const message=cancelled?'local-vocal-cancelled':error.message;
      notice(`歌声生成: ${message}`,cancelled?'info':'error');return{ok:false,error:message};
    }finally{root.clearTimeout?.(timer);if(localVocalJob===job)localVocalJob=null;requestPaint()}
  }
  function scoreVocalReturnView(id,record){
    const disabled=record.stale||vocalBusy()||localVocalJob?' disabled':'';
    const project=state.projects.find(p=>p.projectId===id);let timing='';try{const t=scoreVocalTiming(project,record.id);timing=`<p>Score timing（楽譜の時刻）：最初の音符 ${t.firstNoteSeconds.toFixed(3)} 秒 / 最後の音符末尾 ${t.endSeconds.toFixed(3)} 秒。書出しソフトの冒頭休符の有無に合わせて開始位置を選択してください。</p>`}catch(_){}
    return `${localVocalJob?.id===id?`<p role="status">Sinsy（歌声生成）: ${localVocalJob.cancelled?'停止を要求しました。':localVocalJob.phase==='importing'?'生成したWAVを安全に保存中…':'生成中…'} 元の曲と歌声を保持します。</p>${localVocalJob.phase==='requesting'&&!localVocalJob.cancelled?`<button type="button" class="music-secondary" onclick="${escapeHtml(`MusicStudio.cancelLocalScoreVocal(${JSON.stringify(id)})`)}">Cancel singing（歌声生成を中断）</button>`:''}`:''}${(root.location?.hostname==='127.0.0.1'||root.__NOVA_GENERATION_HOST__===true)?`<button type="button" class="music-secondary" onclick="${escapeHtml(`MusicStudio.generateLocalScoreVocal(${JSON.stringify(id)},${JSON.stringify(record.id)})`)}"${disabled}>Sinsy（端末内で歌声生成・取り込み）</button><div data-vocal-generation class="music-form-grid"><label>First bar（開始小節）<input name="startMeasure" type="number" min="1" max="512" step="1" value="1"${disabled}></label><label>Last bar（終了小節）<input name="endMeasure" type="number" min="1" max="512" step="1" value="1"${disabled}></label><button type="button" class="music-secondary" onclick="${escapeHtml(`MusicStudio.generateLocalScoreVocalRange(this,${JSON.stringify(id)},${JSON.stringify(record.id)})`)}"${disabled}>Generate range（選択小節を別テイク生成）</button><small>範囲内の歌詞音符だけを送ります。選択小節内の休符だけを生成し、元の曲位置へ自動配置します。元の歌声を保持し、VocalのReplace measures（小節置換）で比較・採用できます。</small></div><small>NIT SONG070 F001 / 名古屋工業大学 / CC BY 3.0。HMM歌声合成。</small>`:''}${timing}<form class="music-score-vocal-return music-form-grid" oninput="this.querySelector('[data-score-audio-report]').textContent='WAVを再確認してください。'" onsubmit="${escapeHtml(`MusicStudio.importScoreVocalForm(event,${JSON.stringify(id)},${JSON.stringify(record.id)})`)}"><p>対応する歌声ソフトで作成したWAVを選択してください。このフォームでは生成エンジンの実行・生成元の自動判定は行いません。</p><label>WAV（歌声音声・最大120秒）<input name="audio" type="file" accept="audio/wav,.wav" required${disabled}></label><label>Audio origin（音声の開始位置）<select name="origin" required${disabled}><option value="">選択してください</option><option value="score-zero">Score start（楽譜先頭・冒頭休符を含む）</option><option value="first-note">First note（最初の歌詞音符・冒頭休符なし）</option></select></label><details class="music-span-2"><summary>Import settings（取り込み時の編集）</summary><p>選択範囲の先頭を、選んだ楽譜開始位置へ配置します。元WAVは完全に保持し、編集画面で元に戻せます。</p><div class="music-form-grid"><label>Trim start（音声の開始秒）<input name="trimStart" type="number" min="0" max="120" step="0.001" value="0"${disabled}></label><label>Trim end（音声の終了秒・空欄は最後）<input name="trimEnd" type="number" min="0" max="120" step="0.001"${disabled}></label><label>Gain（音量 dB）<input name="gain" type="number" min="-24" max="12" step="0.1" value="0"${disabled}></label><label>Latency（前へ補正 ms）<input name="latency" type="number" min="-2000" max="2000" step="1" value="0"${disabled}></label></div></details><button type="button" class="music-secondary" onclick="${escapeHtml(`MusicStudio.inspectScoreVocalForm(this,${JSON.stringify(id)},${JSON.stringify(record.id)})`)}"${disabled}>Check WAV（保存前に確認）</button><p data-score-audio-report role="status">長さ・音量・楽譜との時間差を確認できます。生成元は判定しません。</p><label><input type="checkbox" name="editAfter"${disabled}>Open editor（保存後に編集画面へ）</label><button class="music-secondary"${disabled}>Import Vocal WAV（歌声を保存）</button><button type="button" class="music-secondary" onclick="${escapeHtml(`MusicStudio.openWorkAction('vocal',${JSON.stringify(id)})`)}">Vocal（ボーカル編集）</button></form>`;
  }
  function lyricsAssignmentView(id){
    const project=state.projects.find(p=>p.projectId===id);if(!project)return'<main class="music-studio-shell"><p>プロジェクトが見つかりません。</p></main>';
    if(lyricsEditor.projectId!==id){lyricsEditor.projectId=id;lyricsEditor.input=null;lyricsEditor.preview=null;lyricsEditor.pending=false;lyricsEditor.message=''}
    const input=lyricsEditor.input||{trackId:'',fromNote:1,toNote:1,text:'',reading:''},preview=lyricsEditor.preview,valid=preview?.baseline===JSON.stringify(project),saved=lyricsSavedRows(project);
    const table=(rows,editable=false)=>`<div class="music-track-table-wrap"><table class="music-track-table"><thead><tr><th>Note（音符ID）</th><th>Tick（位置）</th><th>Reading（読み）</th></tr></thead><tbody>${(Array.isArray(rows)?rows:[]).map((a,index)=>`<tr><td>${escapeHtml(a?.noteId)}</td><td>${escapeHtml(a?.startTick)} / ${escapeHtml(a?.durationTicks)}</td><td>${editable?`<input type="text" maxlength="64" aria-label="Reading（音符${index+1}の読み）" value="${escapeHtml(a.token)}" onchange="${escapeHtml(`MusicStudio.editLyricsNoteToken(${JSON.stringify(id)},${index},this.value)`)}">`:escapeHtml(a?.extendsPrevious?'~（前の読みを伸ばす）':a?.token)}</td></tr>`).join('')}</tbody></table></div>`;
    return`<main class="music-studio-shell music-project-page music-lyrics-focused">${flowNavigation('プロジェクト詳細',`MusicStudio.openProject('${escapeHtml(id)}')`,'共通MIDIエディター',`MusicStudio.openMidiEditor('${escapeHtml(id)}')`)}<section class="music-project-panel"><h1>Lyrics / Notes（歌詞・音符割付）</h1><details class="music-lyrics-help"><summary>Guide（歌詞・読みの入力方法）</summary><p>漢字の歌詞とは別に、実際に歌わせる読みをかなで入力します。読みを空白で区切り、音符1つに1つ割り当てます。きゃ・きょうなど複数文字も1音符に入力できます。長く伸ばす次の音符は ~ を入力します。和音のある範囲は採用できません。</p></details><form id="musicLyricsForm" oninput="MusicStudio.changeLyricsAssignment()" onsubmit="MusicStudio.previewLyricsAssignment(event,'${escapeHtml(id)}')"><div class="music-form-grid"><label>Track（トラック）<select name="trackId" required><option value="">明示選択してください</option>${(project.midiData?.tracks||[]).filter(t=>t.part!=='drums'&&t.roleAssignment!=='drums'&&t.trackType!=='midi-drums'&&t.isDrum!==true).map(t=>`<option value="${escapeHtml(t.id)}"${t.id===input.trackId?' selected':''}>${escapeHtml(t.name||t.id)} / ${t.notes?.length||0}音</option>`).join('')}</select></label><label>First note（開始音符番号）<input name="fromNote" type="number" min="1" step="1" required value="${input.fromNote}"></label><label>Last note（終了音符番号）<input name="toNote" type="number" min="1" step="1" required value="${input.toNote}"></label><label class="music-span-2">Lyrics（歌詞）<textarea name="text" maxlength="10000" required>${escapeHtml(input.text)}</textarea></label><label class="music-span-2">Reading（読み・空白区切り）<textarea name="reading" maxlength="10000" required placeholder="き み と ~">${escapeHtml(input.reading)}</textarea></label></div><button type="button" class="music-secondary" onclick="MusicStudio.splitLyricsReading()">Split kana（かなの読みを分ける）</button><details class="music-lyrics-help"><summary>Notes（割付の確認方法）</summary><p>音符番号は開始位置順です。採用前に音符IDと位置を確認できます。AI歌詞生成・アクセント解析は未実装です。</p></details><button class="music-primary" type="submit"${lyricsEditor.busy?' disabled':''}>Preview（割付を確認）</button><button class="music-secondary" type="button" onclick="MusicStudio.cancelLyricsAssignment()"${lyricsEditor.busy?' disabled':''}>Cancel（取消）</button></form><p role="status">${escapeHtml(lyricsEditor.message)}</p>${preview?`<h2>Preview（採用前）</h2>${table(preview.assignments,true)}<p>${valid?'MIDIの音程・長さは保持し、この割付を保存します。':'曲が変更されています。もう一度Previewしてください。'}</p><button class="music-primary" onclick="MusicStudio.saveLyricsAssignment('${escapeHtml(id)}')"${valid&&!lyricsEditor.busy?'':' disabled'}>Apply / Save（採用・保存）</button>`:''}<h2>Saved assignments（保存済み割付・歌声生成）</h2>${saved.map(r=>`<details data-score-return-key="${escapeHtml(JSON.stringify([id,r.id]))}"><summary>${escapeHtml(r.text)} / ${escapeHtml(r.trackId)}${r.stale?' / 要再確認：音符が変更されています':''}</summary>${table(r.assignments||[])}<button type="button" class="music-secondary" onclick="${escapeHtml(`MusicStudio.editSavedLyrics(${JSON.stringify(id)},${JSON.stringify(r.id)})`)}">Edit / Regenerate（読み・音符を再編集）</button><button class="music-secondary" ${r.stale?'disabled ':''}onclick="${escapeHtml(`MusicStudio.exportLyricsScore(${JSON.stringify(id)},${JSON.stringify(r.id)})`)}">Export score（歌声用MusicXML）</button><p>保存済みの割付だけを出力。音高・長さ・休符・拍子・BPMを保持します。調号と音の強さは書出し対象外です。端末内Sinsy生成は専用ホストで利用できます。対応ソフト・音声素材の利用条件をご確認ください。</p>${scoreVocalReturnView(id,r)}${scoreVocalLinkedView(project,r)}</details>`).join('')||'<p>保存済みの割付はありません。</p>'}</section></main>`;
  }
  function editSavedLyrics(id,recordId){
    try{
      if(lyricsEditor.busy||vocalBusy()||state.dirty||midiEditorHasPendingChanges())throw Error('編集中の変更を保存してから開いてください。');
      const p=state.projects.find(p=>p.projectId===id),record=p?.syllableAssignments?.find(r=>r.id===recordId);
      if(!record||!Array.isArray(record.assignments)||!record.assignments.length)throw Error('保存済み割付が見つかりません。');
      const notes=[...(p.midiData?.tracks.find(t=>t.id===record.trackId)?.notes||[])].sort((a,b)=>a.startTick-b.startTick||String(a.id).localeCompare(String(b.id)));
      const selected=new Map(record.assignments.map(a=>[a.noteId,a])),indices=notes.map((n,i)=>selected.has(n.id)?i:-1).filter(i=>i>=0);
      if(indices.length!==selected.size||indices.at(-1)-indices[0]+1!==indices.length)throw Error('音符が削除・分割されています。Trackと音符範囲を選び直してください。');
      lyricsEditor.projectId=id;lyricsEditor.input={trackId:record.trackId,fromNote:indices[0]+1,toNote:indices.at(-1)+1,text:record.text,reading:indices.map(i=>selected.get(notes[i].id).token).join(' ')};
      lyricsEditor.preview=null;lyricsEditor.message='読みと音符範囲を編集し、Preview→採用・保存→Sinsyで再生成できます。元の歌声テイクは保持します。';requestPaint();return{ok:true,input:clone(lyricsEditor.input)};
    }catch(error){lyricsEditor.message=error.message;requestPaint();return{ok:false,error:error.message}}
  }
  function kanaReadingTokens(reading){
    if(typeof reading!=='string'||!reading.trim()||reading.length>10000)throw Error('かなの読みを入力してください。');
    const normalized=reading.normalize('NFKC').normalize('NFC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
    const tokens=[];let boundary=true;
    for(const char of normalized){
      if(/\s/u.test(char)){boundary=true;continue}
      if(char==='~'){tokens.push(char);boundary=true;continue}
      if(!/[ぁ-ゖー]/u.test(char))throw Error('漢字・英字は読みをかなに直してください。自動推測はしません。');
      if(/[ゃゅょぁぃぅぇぉゎ]/u.test(char)){
        if(boundary||!tokens.length||!/^[きぎしじちぢにひびぴみりふうてでとどゔくぐすずつ]+$/u.test(tokens.at(-1)))throw Error('小書きかなの前後を確認してください。');
        tokens[tokens.length-1]+=char;
      }else tokens.push(char);
      boundary=false;
    }
    if(!tokens.length||tokens[0]==='~')throw Error('最初に読みのある音節が必要です。');
    return tokens;
  }
  function editLyricsNoteToken(id,index,value){
    if(lyricsEditor.busy||lyricsEditor.projectId!==id)return{ok:false,error:'lyrics-editor-unavailable'};
    try{
      const project=state.projects.find(p=>p.projectId===id),input=clone(lyricsEditor.input);
      if(!lyricsEditor.preview||lyricsEditor.preview.baseline!==JSON.stringify(project))throw Error('stale-lyrics-assignment-preview');
      const current=lyricsAssignmentPreview(project,input);
      if(!Number.isSafeInteger(index)||index<0||index>=current.assignments.length)throw Error('invalid-note-index');
      if(typeof value!=='string'||!value.trim()||/\s/u.test(value.trim())||value.trim().length>64)throw Error('音符1つ分の読みを空白なしで入力してください。');
      const tokens=current.assignments.map(a=>a.token);tokens[index]=value.trim();input.reading=tokens.join(' ');
      const preview=lyricsAssignmentPreview(project,input);
      lyricsEditor.input=input;lyricsEditor.pending=true;lyricsEditor.preview=preview;lyricsEditor.message='読みを変更しました。音符との対応を確認して採用・保存してください。';requestPaint();return{ok:true};
    }catch(error){lyricsEditor.message='読みを変更できません：'+error.message;requestPaint();return{ok:false,error:error.message}}
  }
  function splitLyricsReading(){
    try{const form=root.document?.querySelector('#musicLyricsForm');if(!form)throw Error('lyrics-form-required');const tokens=kanaReadingTokens(form.elements.reading.value);form.elements.reading.value=tokens.join(' ');changeLyricsAssignment();lyricsEditor.message=`読みを${tokens.length}個に分けました。音符数とPreviewを確認してください。`;requestPaint();return{ok:true,tokens}}
    catch(error){lyricsEditor.message=error.message;requestPaint();return{ok:false,error:error.message}}
  }
  function readLyricsInput(){const f=root.document?.querySelector('#musicLyricsForm');if(!f)throw Error('lyrics-form-required');return{trackId:f.elements.trackId.value,fromNote:Number(f.elements.fromNote.value),toNote:Number(f.elements.toNote.value),text:f.elements.text.value,reading:f.elements.reading.value}}
  function changeLyricsAssignment(){lyricsEditor.input=readLyricsInput();lyricsEditor.pending=true;lyricsEditor.preview=null;lyricsEditor.message='入力が変わりました。Previewを再確認してください。';const button=root.document?.querySelector('[onclick^="MusicStudio.saveLyricsAssignment"]');if(button)button.disabled=true}
  function cancelLyricsAssignment(){if(lyricsEditor.busy)return;lyricsEditor.preview=null;lyricsEditor.message='割付候補を取り消しました。';requestPaint()}
  function previewLyricsAssignment(event,id){event?.preventDefault?.();if(lyricsEditor.busy)return;try{const p=state.projects.find(p=>p.projectId===id);lyricsEditor.input=readLyricsInput();lyricsEditor.preview=lyricsAssignmentPreview(p,lyricsEditor.input);lyricsEditor.pending=true;lyricsEditor.message='割付候補を確認してください。まだ保存していません。'}catch(e){lyricsEditor.preview=null;lyricsEditor.message='割付できません：'+e.message}requestPaint()}
  async function saveLyricsAssignment(id){
    if(lyricsEditor.busy)return{ok:false,error:'lyrics-save-busy'};
    const target=repository,preview=lyricsEditor.preview;lyricsEditor.busy=true;requestPaint();
    try{
      const guard=()=>{if(JSON.stringify(state.projects.find(p=>p.projectId===id))!==preview?.baseline||repository!==target||lyricsEditor.projectId!==id||lyricsEditor.preview!==preview||state.dirty||midiEditorHasPendingChanges()||state.midiInput.recording||state.midiInput.starting)throw Error('lyrics-unsaved-or-stale-state')};guard();
      const project=await target.get(id);guard();const updated=adoptLyricsAssignment(project,preview);automaticEditRecord(project,updated,'lyrics-editor');
      if(typeof target.compareAndPut!=='function')throw Error('lyrics-atomic-save-unavailable');
      await target.compareAndPut(updated,preview.baseline,guard);
      if(repository!==target||lyricsEditor.projectId!==id||lyricsEditor.preview!==preview||JSON.stringify(state.projects.find(p=>p.projectId===id))!==preview.baseline)return{ok:true,committed:true,refreshPending:true,project:updated};
      state.projects=state.projects.map(p=>p.projectId===id?updated:p);lyricsEditor.preview=null;lyricsEditor.pending=false;lyricsEditor.message='歌詞の音符割付を保存しました。';return{ok:true,project:updated};
    }catch(e){lyricsEditor.message='保存できません：'+e.message;return{ok:false,error:e.message}}
    finally{lyricsEditor.busy=false;requestPaint()}
  }
  function openLyricsAssignment(id){if(state.dirty||midiEditorHasPendingChanges()){notice('編集中の変更を保存してから歌詞割付を開いてください。','info');return false}lyricsEditor.projectId=null;routeTo(`${HOME_ROUTE}/lyrics-notes/${encodeURIComponent(id)}`);return true}

  // Local bounded PCM editing. Originals live in project JSON; rendered candidates never overwrite them.
  const PCM_FORMAT='music-studio-pcm-mix',PCM_LIMIT=2000000,PCM_JSON_LIMIT=64*1024*1024;
  const pcmEditor={projectId:null,assetId:'',gainDb:0,preview:null,busy:false,message:'',generation:0};
  let pcmPlayback=null;
  function pcmValidate(pcm){
    if(!pcm||!Number.isInteger(pcm.sampleRate)||pcm.sampleRate<8000||pcm.sampleRate>192000||!Array.isArray(pcm.channels)||pcm.channels.length<1||pcm.channels.length>2)throw Error('invalid-pcm-format');
    const frames=pcm.channels[0]?.length;
    if(!Number.isSafeInteger(frames)||frames<1||frames*pcm.channels.length>PCM_LIMIT)throw Error('pcm-capacity-exceeded');
    for(const channel of pcm.channels){if(!Array.isArray(channel)||channel.length!==frames)throw Error('invalid-pcm-channels');for(const value of channel)if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>16)throw Error('invalid-pcm-sample')}
    return frames;
  }
  function pcmAnalyze(pcm){const frames=pcmValidate(pcm);let peak=0,sum=0,clipping=0;for(const channel of pcm.channels)for(const sample of channel){const a=Math.abs(sample);peak=Math.max(peak,a);sum+=sample*sample;if(a>=1)clipping++}const count=frames*pcm.channels.length,rms=Math.sqrt(sum/count);return{frames,channels:pcm.channels.length,sampleRate:pcm.sampleRate,seconds:frames/pcm.sampleRate,peak,peakDb:peak?20*Math.log10(peak):null,rms,rmsDb:rms?20*Math.log10(rms):null,clippingSamples:clipping};}
  function pcmGain(pcm,gainDb){pcmValidate(pcm);if(typeof gainDb!=='number'||!Number.isFinite(gainDb)||gainDb<-24||gainDb>24)throw Error('invalid-pcm-gain');const factor=10**(gainDb/20);const output={sampleRate:pcm.sampleRate,channels:pcm.channels.map(channel=>channel.map(value=>value*factor))};pcmValidate(output);return output;}
  // Pure local peaking EQ, based on the Audio EQ Cookbook biquad.
  function pcmEq(pcm,frequency,gainDb,q=1){
    pcmValidate(pcm);
    if(typeof frequency!=='number'||!Number.isFinite(frequency)||frequency<20||frequency>=pcm.sampleRate*0.45||
       typeof gainDb!=='number'||!Number.isFinite(gainDb)||gainDb < -18||gainDb>18||
       typeof q!=='number'||!Number.isFinite(q)||q<0.1||q>10)throw Error('invalid-pcm-eq');
    if(gainDb===0)return{sampleRate:pcm.sampleRate,channels:pcm.channels.map(channel=>channel.slice())};
    const A=10**(gainDb/40),w=2*Math.PI*frequency/pcm.sampleRate,alpha=Math.sin(w)/(2*q),cos=Math.cos(w),a0=1+alpha/A;
    const b0=(1+alpha*A)/a0,b1=(-2*cos)/a0,b2=(1-alpha*A)/a0,a1=(-2*cos)/a0,a2=(1-alpha/A)/a0;
    const output={sampleRate:pcm.sampleRate,channels:pcm.channels.map(channel=>{
      let z1=0,z2=0;return channel.map(x=>{const y=b0*x+z1;z1=b1*x-a1*y+z2;z2=b2*x-a2*y;return y;});
    })};
    pcmValidate(output);return output;
  }
  // Stereo-linked sample-peak compressor. Deterministic and local; independent from project storage.
  function pcmCompressorSetting(v){
    if(!v||typeof v.thresholdDb!=='number'||!Number.isFinite(v.thresholdDb)||v.thresholdDb< -60||v.thresholdDb>0||
      typeof v.ratio!=='number'||!Number.isFinite(v.ratio)||v.ratio<1||v.ratio>20||
      typeof v.attackMs!=='number'||!Number.isFinite(v.attackMs)||v.attackMs<.1||v.attackMs>200||
      typeof v.releaseMs!=='number'||!Number.isFinite(v.releaseMs)||v.releaseMs<1||v.releaseMs>2000)throw Error('invalid-pcm-compressor');
    return{thresholdDb:v.thresholdDb,ratio:v.ratio,attackMs:v.attackMs,releaseMs:v.releaseMs};
  }
  function pcmCompress(pcm,settings){
    pcmValidate(pcm);const v=pcmCompressorSetting(settings);
    if(v.ratio===1)return{sampleRate:pcm.sampleRate,channels:pcm.channels.map(ch=>ch.slice())};
    const attack=Math.exp(-1000/(pcm.sampleRate*v.attackMs)),release=Math.exp(-1000/(pcm.sampleRate*v.releaseMs));
    const out={sampleRate:pcm.sampleRate,channels:pcm.channels.map(ch=>Array(ch.length))};let envelope=0;
    for(let i=0;i<pcm.channels[0].length;i++){
      let peak=0;for(const ch of pcm.channels)peak=Math.max(peak,Math.abs(ch[i]));
      envelope=peak>envelope?attack*envelope+(1-attack)*peak:release*envelope+(1-release)*peak;
      const db=envelope>0?20*Math.log10(envelope):-Infinity;
      const reduction=db>v.thresholdDb?(v.thresholdDb+(db-v.thresholdDb)/v.ratio)-db:0;
      const factor=10**(reduction/20);
      for(let c=0;c<out.channels.length;c++)out.channels[c][i]=pcm.channels[c][i]*factor;
    }
    pcmValidate(out);return out;
  }
  // Attenuating stereo balance and mid/side width; never mutates input.
  function pcmSpatialSetting(v){
    if(!v||typeof v.balance!=='number'||!Number.isFinite(v.balance)||Math.abs(v.balance)>1||typeof v.width!=='number'||!Number.isFinite(v.width)||v.width<0||v.width>1)throw Error('invalid-pcm-spatial');
    return {balance:v.balance,width:v.width};
  }
  function pcmSpatial(pcm,v={balance:0,width:1}){
    pcmValidate(pcm);const setting=pcmSpatialSetting(v),out={sampleRate:pcm.sampleRate,channels:pcm.channels.map(c=>c.slice())};
    if(out.channels.length===1){if(setting.balance!==0||setting.width!==1)throw Error('spatial-stereo-required');return out}
    if(setting.balance===0&&setting.width===1)return out;
    for(let i=0;i<out.channels[0].length;i++){
      const l=pcm.channels[0][i],r=pcm.channels[1][i],m=(l+r)/2,d=(l-r)*setting.width/2;
      out.channels[0][i]=(m+d)*(1-Math.max(0,setting.balance));
      out.channels[1][i]=(m-d)*(1+Math.min(0,setting.balance));
    }
    return out;
  }
  // Stateful bounded DSP over independently supplied PCM chunks, without whole-song concatenation.
  // Each input/output chunk obeys PCM_LIMIT; the total stream may exceed it.
  function* pcmProcessChunks(chunks,options){
    if(!chunks||typeof chunks[Symbol.iterator]!=='function'||!options||
       !Number.isInteger(options.sampleRate)||options.sampleRate<8000||options.sampleRate>192000||
       ![1,2].includes(options.channelCount))throw Error('invalid-pcm-stream');
    const rate=options.sampleRate,count=options.channelCount;
    const gainDb=options.gainDb===undefined?0:options.gainDb;
    if(typeof gainDb!=='number'||!Number.isFinite(gainDb)||gainDb < -24||gainDb>24)throw Error('invalid-pcm-gain');
    const gainFactor=10**(gainDb/20),postFactor=10**(masterPostGain(options.postGainDb)/20);
    const eq=pcmEqValidate(options.eq||PCM_EQ_FLAT,rate),comp=pcmCompressorSetting(options.compressor||PCM_COMP_BYPASS);
    const useEq=eq.gainDb!==0,A=10**(eq.gainDb/40),w=2*Math.PI*eq.frequency/rate;
    const alpha=Math.sin(w)/(2*eq.q),cos=Math.cos(w),a0=1+alpha/A;
    const b0=(1+alpha*A)/a0,b1=(-2*cos)/a0,b2=(1-alpha*A)/a0;
    const a1=(-2*cos)/a0,a2=(1-alpha/A)/a0;
    const z1=Array(count).fill(0),z2=Array(count).fill(0);
    const useComp=comp.ratio!==1,attack=Math.exp(-1000/(rate*comp.attackMs)),release=Math.exp(-1000/(rate*comp.releaseMs));
    let env=0,totalFrames=0,seen=false;
    for(const chunk of chunks){
      const frames=pcmValidate(chunk);
      if(chunk.sampleRate!==rate||chunk.channels.length!==count)throw Error('pcm-stream-format-changed');
      if(!Number.isSafeInteger(totalFrames+frames))throw Error('pcm-stream-total-overflow');
      totalFrames+=frames;seen=true;
      const out={sampleRate:rate,channels:Array.from({length:count},()=>Array(frames))};
      for(let i=0;i<frames;i++){
        let peak=0;
        for(let c=0;c<count;c++){
          const x=chunk.channels[c][i]*gainFactor;
          let y=x;
          if(useEq){y=b0*x+z1[c];z1[c]=b1*x-a1*y+z2[c];z2[c]=b2*x-a2*y;}
          out.channels[c][i]=y;peak=Math.max(peak,Math.abs(y));
        }
        if(useComp){
          env=peak>env?attack*env+(1-attack)*peak:release*env+(1-release)*peak;
          const db=env>0?20*Math.log10(env):-Infinity;
          const reduction=db>comp.thresholdDb?(comp.thresholdDb+(db-comp.thresholdDb)/comp.ratio)-db:0;
          const factor=10**(reduction/20);
          for(let c=0;c<count;c++)out.channels[c][i]*=factor;
        }
      }
      pcmValidate(out);
      const result=options.spatial?pcmSpatial(out,options.spatial):out;
      if(postFactor!==1)for(const channel of result.channels)for(let i=0;i<frames;i++)channel[i]*=postFactor;
      pcmValidate(result);yield result;
    }
    if(!seen)throw Error('pcm-stream-empty');
  }
  // Read long WAV files by bounded Blob slices. Never expands a complete recording to PCM arrays.
  async function* pcmDecodeWavStream(file,framesPerChunk=16384){
    if(!file||!Number.isSafeInteger(file.size)||file.size<44||file.size>0xffffffff+8||
       typeof file.slice!=='function'||!Number.isInteger(framesPerChunk)||framesPerChunk<1||
       framesPerChunk>32768)throw Error('invalid-wav-stream');
    const read=async(start,length)=>{
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(length)||start<0||length<0||start+length>file.size)throw Error('truncated-wav-stream');
      const part=file.slice(start,start+length);
      if(!part||typeof part.arrayBuffer!=='function')throw Error('invalid-wav-stream');
      const bytes=await part.arrayBuffer();
      if(bytes.byteLength!==length)throw Error('short-wav-stream-read');
      return new DataView(bytes);
    };
    const four=(v,i)=>String.fromCharCode(v.getUint8(i),v.getUint8(i+1),v.getUint8(i+2),v.getUint8(i+3));
    const top=await read(0,12);
    if(four(top,0)!=='RIFF'||four(top,8)!=='WAVE'||top.getUint32(4,true)+8!==file.size)throw Error('invalid-wav-stream-header');
    let fmt=null,data=null,offset=12;
    while(offset<file.size){
      const header=await read(offset,8),type=four(header,0),size=header.getUint32(4,true);
      const start=offset+8,end=start+size,next=end+(size%2);
      if(end>file.size||next>file.size)throw Error('truncated-wav-stream');
      if(type==='fmt '){
        if(fmt||size<16||size>65536)throw Error('invalid-wav-stream-format');
        const view=await read(start,16);
        fmt={code:view.getUint16(0,true),channels:view.getUint16(2,true),rate:view.getUint32(4,true),
          byteRate:view.getUint32(8,true),align:view.getUint16(12,true),bits:view.getUint16(14,true)};
      }else if(type==='data'){
        if(data)throw Error('duplicate-wav-stream-data');
        data={start,size};
      }
      offset=next;
    }
    if(!fmt||!data||![1,2].includes(fmt.channels)||
       !((fmt.code===1&&[16,24,32].includes(fmt.bits))||(fmt.code===3&&fmt.bits===32))||
       fmt.rate<8000||fmt.rate>192000)throw Error('unsupported-wav-stream-format');
    const bytes=fmt.bits/8;
    if(fmt.align!==bytes*fmt.channels||fmt.byteRate!==fmt.rate*fmt.align||
       data.size%fmt.align!==0||data.size<fmt.align)throw Error('invalid-wav-stream-alignment');
    const frames=data.size/fmt.align;
    // Read ahead at most 1 MiB of encoded audio while retaining the public PCM
    // chunk limit. Blob/IndexedDB-backed files otherwise perform thousands of
    // small asynchronous reads on every analysis/render pass.
    const readFrames=Math.max(framesPerChunk,Math.floor(1048576/fmt.align));
    let buffered=null,bufferFirst=0,bufferFrames=0;
    for(let first=0;first<frames;first+=framesPerChunk){
      const count=Math.min(framesPerChunk,frames-first);
      if(!buffered||first+count>bufferFirst+bufferFrames){
        bufferFirst=first;bufferFrames=Math.min(readFrames,frames-first);
        buffered=await read(data.start+first*fmt.align,bufferFrames*fmt.align);
      }
      const view=new DataView(buffered.buffer,buffered.byteOffset+(first-bufferFirst)*fmt.align,count*fmt.align);
      const pcm={sampleRate:fmt.rate,bitDepth:fmt.bits,encoding:fmt.code,channels:Array.from({length:fmt.channels},()=>Array(count))};
      for(let i=0;i<count;i++)for(let c=0;c<fmt.channels;c++){
        const at=i*fmt.align+c*bytes;
        let sample;
        if(fmt.code===3)sample=view.getFloat32(at,true);
        else if(fmt.bits===16)sample=view.getInt16(at,true)/32768;
        else if(fmt.bits===32)sample=view.getInt32(at,true)/2147483648;
        else{let x=view.getUint8(at)|(view.getUint8(at+1)<<8)|(view.getUint8(at+2)<<16);
          if(x&0x800000)x-=0x1000000;sample=x/8388608;}
        pcm.channels[c][i]=sample;
      }
      pcmValidate(pcm);
      yield pcm;
    }
  }
  // Bind the real async Blob reader to one continuous stateful bounded DSP instance.
  // No whole-file PCM allocation and no resets at chunk boundaries.
  async function* pcmRenderLongWav(file,settings={},framesPerChunk=16384){
    if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('invalid-pcm-stream-settings');
    let processor=null,buffered=null,delivered=0;
    const queue={
      [Symbol.iterator](){return this},
      next(){if(!buffered)throw Error('pcm-stream-source-not-ready');const value=buffered;buffered=null;return{value,done:false}}
    };
    for await(const chunk of pcmDecodeWavStream(file,framesPerChunk)){
      if(!processor)processor=pcmProcessChunks(queue,{...settings,sampleRate:chunk.sampleRate,channelCount:chunk.channels.length});
      buffered=chunk;
      const result=processor.next();
      if(result.done||!result.value)throw Error('pcm-stream-unexpected-end');
      delivered++;yield result.value;
    }
    if(!delivered)throw Error('pcm-stream-empty');
  }
  // Incrementally encode the rendered PCM16 output. The complete WAV remains
  // a Blob of binary chunks, not an inline JSON array of every audio sample.
  async function pcmRenderLongWavBlob(file,settings={},framesPerChunk=16384,options={}){
    options.guard?.();
    const pieces=[];let frames=0,rate=null,channels=null;
    for await(const chunk of pcmRenderLongWav(file,settings,framesPerChunk)){
      options.guard?.();
      if(rate===null){rate=chunk.sampleRate;channels=chunk.channels.length;}
      if(rate!==chunk.sampleRate||channels!==chunk.channels.length)throw Error('pcm-stream-format-changed');
      const size=chunk.channels[0].length*channels*2;
      if(!Number.isSafeInteger(frames+chunk.channels[0].length)||((frames+chunk.channels[0].length)*channels*2)>0xffffffff-36)throw Error('wav-stream-size-exceeded');
      // pcmEncodeWav fails closed on clipping, never hard-clips or drops frames.
      const buffer=pcmEncodeWav(chunk);
      if(buffer.byteLength!==44+size)throw Error('wav-stream-encoded-size-mismatch');
      pieces.push(buffer.slice(44));frames+=chunk.channels[0].length;
      options.progress?.(frames);
      if(root.setTimeout)await new Promise(resolve=>root.setTimeout(resolve,0));
      options.guard?.();
    }
    if(!frames)throw Error('pcm-stream-empty');
    const header=new ArrayBuffer(44),view=new DataView(header);
    const write=(pos,value)=>[...value].forEach((v,i)=>view.setUint8(pos+i,v.charCodeAt(0)));
    write(0,'RIFF');view.setUint32(4,36+frames*channels*2,true);write(8,'WAVE');write(12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);
    view.setUint32(24,rate,true);view.setUint32(28,rate*channels*2,true);
    view.setUint16(32,channels*2,true);view.setUint16(34,16,true);write(36,'data');
    view.setUint32(40,frames*channels*2,true);
    return{blob:new Blob([header,...pieces],{type:'audio/wav'}),frames,channels,sampleRate:rate};
  }
  function pcmDecodeWav(buffer){
    if(!buffer||!Number.isSafeInteger(buffer.byteLength)||buffer.byteLength<44||buffer.byteLength>PCM_LIMIT*4+65536)throw Error('invalid-wav-size');
    const view=new DataView(buffer),tag=at=>String.fromCharCode(...[0,1,2,3].map(i=>view.getUint8(at+i)));
    if(tag(0)!=='RIFF'||tag(8)!=='WAVE'||view.getUint32(4,true)+8!==buffer.byteLength)throw Error('invalid-wav-header');
    let fmt=null,data=null,at=12;
    while(at<buffer.byteLength){if(at+8>buffer.byteLength)throw Error('truncated-wav-chunk');const kind=tag(at),size=view.getUint32(at+4,true),start=at+8,end=start+size;if(end>buffer.byteLength)throw Error('truncated-wav-chunk');if(kind==='fmt '){if(fmt||size<16)throw Error('invalid-wav-format');fmt={code:view.getUint16(start,true),channels:view.getUint16(start+2,true),rate:view.getUint32(start+4,true),byteRate:view.getUint32(start+8,true),align:view.getUint16(start+12,true),bits:view.getUint16(start+14,true)}}else if(kind==='data'){if(data)throw Error('duplicate-wav-data');data={start,size}}at=end+(size%2);if(at>buffer.byteLength)throw Error('missing-wav-padding')}
    if(!fmt||!data||![1,2].includes(fmt.channels)||!((fmt.code===1&&[16,24,32].includes(fmt.bits))||(fmt.code===3&&fmt.bits===32)))throw Error('unsupported-wav-format');
    const bytes=fmt.bits/8;if(fmt.align!==bytes*fmt.channels||fmt.byteRate!==fmt.rate*fmt.align||data.size%fmt.align)throw Error('invalid-wav-alignment');
    const frames=data.size/fmt.align;if(frames<1||frames*fmt.channels>PCM_LIMIT)throw Error('pcm-capacity-exceeded');
    const pcm={sampleRate:fmt.rate,channels:Array.from({length:fmt.channels},()=>Array(frames))};
    for(let i=0;i<frames;i++)for(let c=0;c<fmt.channels;c++){const pos=data.start+i*fmt.align+c*bytes;let value;if(fmt.code===3)value=view.getFloat32(pos,true);else if(fmt.bits===16)value=view.getInt16(pos,true)/32768;else if(fmt.bits===32)value=view.getInt32(pos,true)/2147483648;else{let x=view.getUint8(pos)|(view.getUint8(pos+1)<<8)|(view.getUint8(pos+2)<<16);if(x&0x800000)x-=0x1000000;value=x/8388608}pcm.channels[c][i]=value}
    pcmValidate(pcm);return pcm;
  }
  function pcmEncodeWav(pcm){const frames=pcmValidate(pcm),metrics=pcmAnalyze(pcm);if(metrics.peak>1)throw Error('wav-clipping-requires-lower-gain');const channels=pcm.channels.length,size=frames*channels*2,buffer=new ArrayBuffer(44+size),view=new DataView(buffer),tag=(at,s)=>[...s].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));tag(0,'RIFF');view.setUint32(4,36+size,true);tag(8,'WAVE');tag(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,pcm.sampleRate,true);view.setUint32(28,pcm.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);tag(36,'data');view.setUint32(40,size,true);for(let i=0;i<frames;i++)for(let c=0;c<channels;c++){const x=pcm.channels[c][i];view.setInt16(44+(i*channels+c)*2,Math.max(-32768,Math.min(32767,Math.round(x*32768))),true)}return buffer;}
  function pcmJsonBytes(value){const text=JSON.stringify(value);let bytes=0;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);bytes+=c<128?1:c<2048?2:3;if(c>=0xd800&&c<=0xdbff&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff){bytes++;i++}}return bytes;}
  function pcmMixValidate(mix){
    if(!mix||mix.format!==PCM_FORMAT||mix.version!==1||!Array.isArray(mix.assets)||mix.assets.length>32)throw Error('invalid-pcm-mix');let samples=0;const ids=new Set();
    for(const asset of mix.assets){pcmVersionsValidate(asset);if(!asset||typeof asset.id!=='string'||!asset.id||ids.has(asset.id)||typeof asset.name!=='string'||asset.name.length>240)throw Error('invalid-pcm-asset');ids.add(asset.id);samples+=pcmValidate(asset.original)*asset.original.channels.length;if(samples>PCM_LIMIT)throw Error('pcm-capacity-exceeded');if(!Array.isArray(asset.gains)||asset.gains.length<1||asset.gains.length>65||asset.gains[0]!==0||!Number.isInteger(asset.cursor)||asset.cursor<0||asset.cursor>=asset.gains.length)throw Error('invalid-pcm-history');for(const gain of asset.gains)if(typeof gain!=='number'||!Number.isFinite(gain)||gain<-24||gain>24)throw Error('invalid-pcm-gain');if(Object.hasOwn(asset,'eqHistory')){const h=asset.eqHistory;if(!h||!Array.isArray(h.settings)||h.settings.length<1||h.settings.length>65||!Number.isInteger(h.cursor)||h.cursor<0||h.cursor>=h.settings.length||JSON.stringify(h.settings[0])!==JSON.stringify(PCM_EQ_FLAT))throw Error('invalid-pcm-eq-history');for(const setting of h.settings)pcmEqValidate(setting,asset.original.sampleRate);}if(Object.hasOwn(asset,'compressorHistory')){const h=asset.compressorHistory;if(!h||!Array.isArray(h.settings)||h.settings.length<1||h.settings.length>65||!Number.isInteger(h.cursor)||h.cursor<0||h.cursor>=h.settings.length||JSON.stringify(h.settings[0])!==JSON.stringify(PCM_COMP_BYPASS))throw Error('invalid-pcm-compressor-history');for(const setting of h.settings)pcmCompressorSetting(setting);}if(Object.hasOwn(asset,'spatialHistory')){const h=asset.spatialHistory;if(!h||!Array.isArray(h.settings)||h.settings.length<1||h.settings.length>65||!Number.isInteger(h.cursor)||h.cursor<0||h.cursor>=h.settings.length||JSON.stringify(h.settings[0])!==JSON.stringify({balance:0,width:1}))throw Error('invalid-pcm-spatial-history');for(const setting of h.settings){const v=pcmSpatialSetting(setting);if(asset.original.channels.length!==2&&(v.balance!==0||v.width!==1))throw Error('spatial-stereo-required');}}}
    if(pcmJsonBytes(mix)>PCM_JSON_LIMIT)throw Error('pcm-json-capacity-exceeded');return mix;
  }
  // Each asset keeps an independent, bounded EQ history, preserving legacy Gain history.
  const PCM_EQ_FLAT={frequency:1000,gainDb:0,q:1};
  function pcmEqValidate(setting,rate){
    if(!setting||typeof setting.frequency!=='number'||!Number.isFinite(setting.frequency)||setting.frequency<20||setting.frequency>=rate*.45||
      typeof setting.gainDb!=='number'||!Number.isFinite(setting.gainDb)||setting.gainDb < -18||setting.gainDb>18||
      typeof setting.q!=='number'||!Number.isFinite(setting.q)||setting.q<.1||setting.q>10)throw Error('invalid-pcm-eq');
    return{frequency:setting.frequency,gainDb:setting.gainDb,q:setting.q};
  }
  function pcmSavedEq(asset){return asset.eqHistory?pcmEqValidate(asset.eqHistory.settings[asset.eqHistory.cursor],asset.original.sampleRate):PCM_EQ_FLAT;}
  function pcmRenderAsset(asset,gain=asset.gains[asset.cursor],eq=pcmSavedEq(asset),compressor=pcmSavedCompressor(asset),spatial=pcmSavedSpatial(asset)){
    const output=pcmGain(asset.original,gain),setting=pcmEqValidate(eq,output.sampleRate);
    const equalized=setting.gainDb===0?output:pcmEq(output,setting.frequency,setting.gainDb,setting.q);
    return pcmSpatial(pcmCompress(equalized,compressor),spatial);
  }
  function pcmEqAdopt(project,preview){
    if(preview?.kind!=='eq-preview-only'||preview.baseline!==JSON.stringify(project)||
       JSON.stringify(pcmEqPreview(project,preview.assetId,preview.eq))!==JSON.stringify(preview))throw Error('stale-or-modified-pcm-preview');
    const updated=clone(project),asset=pcmAsset(updated,preview.assetId),setting=pcmEqValidate(preview.eq,asset.original.sampleRate);
    if(JSON.stringify(pcmSavedEq(asset))===JSON.stringify(setting))throw Error('pcm-eq-no-change');
    if(!asset.eqHistory)asset.eqHistory={settings:[{...PCM_EQ_FLAT}],cursor:0};
    const history=asset.eqHistory;
    if(history.cursor>=64)throw Error('pcm-eq-history-capacity-exceeded');
    history.settings=history.settings.slice(0,history.cursor+1);
    history.settings.push(setting);history.cursor++;
    return pcmUpdated(updated);
  }
  function pcmEqHistory(project,id,direction){
    if(![-1,1].includes(direction))throw Error('invalid-pcm-history-direction');
    const updated=clone(project),asset=pcmAsset(updated,id),h=asset.eqHistory;
    if(!h||h.cursor+direction<0||h.cursor+direction>=h.settings.length)throw Error('pcm-eq-history-boundary');
    h.cursor+=direction;return pcmUpdated(updated);
  }
  const PCM_COMP_BYPASS={thresholdDb:-12,ratio:1,attackMs:10,releaseMs:100};
  function pcmSavedCompressor(asset){
    return asset.compressorHistory?pcmCompressorSetting(asset.compressorHistory.settings[asset.compressorHistory.cursor]):PCM_COMP_BYPASS;
  }
  function pcmCompressorPreview(project,assetId,settings){
    const checked=validateProject(project);if(!checked.valid)throw Error('invalid-pcm-project: '+checked.errors.join(';'));
    const asset=pcmAsset(project,assetId),compressor=pcmCompressorSetting(settings),before=pcmRenderAsset(asset);
    const after=pcmRenderAsset(asset,asset.gains[asset.cursor],pcmSavedEq(asset),compressor);
    return{format:PCM_FORMAT,kind:'compressor-preview',projectId:project.projectId,assetId,baseline:JSON.stringify(project),compressor,before:pcmAnalyze(before),after:pcmAnalyze(after)};
  }
  function pcmCompressorAdopt(project,preview){
    if(preview?.kind!=='compressor-preview'||preview.baseline!==JSON.stringify(project)||
      JSON.stringify(pcmCompressorPreview(project,preview.assetId,preview.compressor))!==JSON.stringify(preview))throw Error('stale-or-modified-pcm-preview');
    const updated=clone(project),asset=pcmAsset(updated,preview.assetId),setting=pcmCompressorSetting(preview.compressor);
    if(JSON.stringify(pcmSavedCompressor(asset))===JSON.stringify(setting))throw Error('pcm-compressor-no-change');
    if(!asset.compressorHistory)asset.compressorHistory={settings:[{...PCM_COMP_BYPASS}],cursor:0};
    const history=asset.compressorHistory;if(history.cursor>=64)throw Error('pcm-compressor-history-capacity-exceeded');
    history.settings=history.settings.slice(0,history.cursor+1);history.settings.push(setting);history.cursor++;
    return pcmUpdated(updated);
  }
  function pcmCompressorHistory(project,id,direction){
    if(![-1,1].includes(direction))throw Error('invalid-pcm-history-direction');
    const updated=clone(project),asset=pcmAsset(updated,id),h=asset.compressorHistory;
    if(!h||h.cursor+direction<0||h.cursor+direction>=h.settings.length)throw Error('pcm-compressor-history-boundary');
    h.cursor+=direction;return pcmUpdated(updated);
  }
  function pcmAsset(project,id){const mix=pcmMixValidate(project.pcmMix),asset=mix.assets.find(a=>a.id===id);if(!asset)throw Error('pcm-asset-not-found');return asset;}
  function pcmPreview(project,assetId,gainDb){const checked=validateProject(project);if(!checked.valid)throw Error('invalid-pcm-project: '+checked.errors.join(';'));const asset=pcmAsset(project,assetId),before=pcmRenderAsset(asset),after=pcmRenderAsset(asset,gainDb);return{format:PCM_FORMAT,projectId:project.projectId,baseline:JSON.stringify(project),assetId,gainDb,before:pcmAnalyze(before),after:pcmAnalyze(after)};}
  function pcmEqPreview(project,assetId,eq){
    const checked=validateProject(project);if(!checked.valid)throw Error('invalid-pcm-project: '+checked.errors.join(';'));
    const asset=pcmAsset(project,assetId),before=pcmRenderAsset(asset);
    const setting=pcmEqValidate(eq,asset.original.sampleRate),after=pcmRenderAsset(asset,asset.gains[asset.cursor],setting);
    return{format:PCM_FORMAT,kind:'eq-preview-only',projectId:project.projectId,assetId,baseline:JSON.stringify(project),eq:setting,before:pcmAnalyze(before),after:pcmAnalyze(after)};
  }
  function pcmAdopt(project,preview){if(preview?.baseline!==JSON.stringify(project)||JSON.stringify(pcmPreview(project,preview.assetId,preview.gainDb))!==JSON.stringify(preview))throw Error('stale-or-modified-pcm-preview');const updated=clone(project),asset=pcmAsset(updated,preview.assetId);if(asset.gains[asset.cursor]===preview.gainDb)throw Error('pcm-no-change');if(asset.cursor>=64)throw Error('pcm-history-capacity-exceeded');asset.gains=asset.gains.slice(0,asset.cursor+1);asset.gains.push(preview.gainDb);asset.cursor++;return pcmUpdated(updated);}
  function pcmUpdated(project){pcmMixValidate(project.pcmMix);if(pcmJsonBytes(project)>PCM_JSON_LIMIT)throw Error('pcm-json-capacity-exceeded');project.revision++;project.updatedAt=now();if(project.aiWorkspace)project.aiWorkspace=rebindAIWorkspace(project.aiWorkspace,project.projectId,project.revision);if(!validateProject(project).valid)throw Error('invalid-pcm-project');return project;}
  function pcmImport(project,pcm,name){pcmValidate(pcm);if(typeof name!=='string'||!name.trim()||name.length>240)throw Error('invalid-pcm-name');const updated=clone(project);if(!updated.pcmMix)updated.pcmMix={format:PCM_FORMAT,version:1,assets:[]};pcmMixValidate(updated.pcmMix);updated.pcmMix.assets.push({id:uuid(),name,original:clone(pcm),gains:[0],cursor:0});return pcmUpdated(updated);}
  function pcmHistory(project,id,direction){if(![-1,1].includes(direction))throw Error('invalid-pcm-history-direction');const updated=clone(project),asset=pcmAsset(updated,id),cursor=asset.cursor+direction;if(cursor<0||cursor>=asset.gains.length)throw Error('pcm-history-boundary');asset.cursor=cursor;return pcmUpdated(updated);}
  function pcmStop(){finalStop();if(pcmPlayback){try{pcmPlayback.source.stop()}catch(_){}pcmPlayback.context.close()?.catch?.(()=>{});pcmPlayback=null}}
  function pcmCancel(){pcmEditor.generation++;productionCancel();pcmStop();pcmEditor.preview=null;pcmEditor.message='候補を取り消しました。元音声は保持しています。';requestPaint()}
  function pcmOpen(id){if(vocalBusy()||state.dirty||midiEditorHasPendingChanges())return false;longMixCancel();pcmCancel();pcmEditor.projectId=id;pcmEditor.assetId='';routeTo(`${HOME_ROUTE}/mixing/${encodeURIComponent(id)}`);return true;}
  function pcmChange(){if(pcmEditor.busy)return;pcmStop();const f=root.document?.querySelector('#musicPcmForm');if(!f)return;pcmEditor.assetId=f.elements.assetId.value;pcmEditor.gainDb=Number(f.elements.gainDb.value);pcmEditor.preview=null;pcmEditor.generation++;requestPaint()}
  function pcmShowCompressorPreview(event,id){
    event?.preventDefault?.();if(pcmEditor.busy)return;
    try{
      const form=root.document?.querySelector('#musicPcmCompressorForm');if(!form)throw Error('pcm-compressor-form-unavailable');
      const settings={thresholdDb:Number(form.elements.thresholdDb.value),ratio:Number(form.elements.ratio.value),attackMs:Number(form.elements.attackMs.value),releaseMs:Number(form.elements.releaseMs.value)};
      pcmEditor.preview=pcmCompressorPreview(state.projects.find(p=>p.projectId===id),pcmEditor.assetId,settings);
      pcmEditor.message='Compressionの実音声候補です。A/B比較後に保存してください。';
    }catch(e){pcmEditor.preview=null;pcmEditor.message=e.message}requestPaint();
  }
  function pcmShowEqPreview(event,id){
    event?.preventDefault?.();if(pcmEditor.busy)return;
    try{
      const form=root.document?.querySelector('#musicPcmEqForm');if(!form)throw Error('pcm-eq-form-unavailable');
      const eq={frequency:Number(form.elements.frequency.value),gainDb:Number(form.elements.eqGain.value),q:Number(form.elements.q.value)};
      pcmEditor.preview=pcmEqPreview(state.projects.find(p=>p.projectId===id),pcmEditor.assetId,eq);
      pcmEditor.message='EQの音声処理候補です。A/Bで確認してから保存してください。';
    }catch(e){pcmEditor.preview=null;pcmEditor.message=e.message}requestPaint();
  }
  function pcmShowPreview(event,id){event?.preventDefault?.();if(pcmEditor.busy)return;try{pcmEditor.preview=pcmPreview(state.projects.find(p=>p.projectId===id),pcmEditor.assetId,pcmEditor.gainDb);pcmEditor.message='実音声の処理候補です。A/Bで確認してから保存してください。'}catch(e){pcmEditor.preview=null;pcmEditor.message=e.message}requestPaint()}
  async function pcmCommit(id,operation,token=pcmEditor.generation,extraGuard=()=>{}){
    if(pcmEditor.busy)return{ok:false,error:'pcm-save-busy'};const target=repository,baseline=JSON.stringify(state.projects.find(p=>p.projectId===id));pcmEditor.busy=true;pcmStop();requestPaint();
    try{const guard=()=>{extraGuard();if(repository!==target||pcmEditor.projectId!==id||pcmEditor.generation!==token||JSON.stringify(state.projects.find(p=>p.projectId===id))!==baseline||state.dirty||midiEditorHasPendingChanges()||state.midiInput.recording||state.midiInput.starting)throw Error('pcm-unsaved-or-stale-state')};guard.registerAbort=extraGuard.registerAbort;guard.clearAbort=extraGuard.clearAbort;guard();if(typeof target.compareAndPut!=='function')throw Error('pcm-atomic-save-unavailable');const current=await target.get(id);guard();if(JSON.stringify(current)!==baseline)throw Error('pcm-storage-conflict');const updated=operation(current);automaticEditRecord(current,updated,'audio-editor');await target.compareAndPut(updated,baseline,guard);if(repository!==target||pcmEditor.projectId!==id||pcmEditor.generation!==token||JSON.stringify(state.projects.find(p=>p.projectId===id))!==baseline)return{ok:true,committed:true,refreshPending:true,project:updated};state.projects=state.projects.map(p=>p.projectId===id?updated:p);pcmEditor.preview=null;pcmEditor.message='音声と処理設定を保存しました。';return{ok:true,project:updated};}catch(e){pcmEditor.message='保存できません：'+e.message;return{ok:false,error:e.message}}finally{pcmEditor.busy=false;requestPaint()}
  }
  async function longWavDigest(blob,guard=()=>{}){
    if(!root.crypto?.subtle)throw Error('long-wav-integrity-unavailable');
    const hashes=[];
    for(let at=0;at<blob.size;at+=1048576){guard();const bytes=await blob.slice(at,Math.min(blob.size,at+1048576)).arrayBuffer();
      hashes.push(Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join(''));guard();}
    return hashes;
  }
  const archiveTransfer={busy:false,preview:null,generation:0};
  function cancelArchiveTransfer(){archiveTransfer.generation++;archiveTransfer.preview=null;requestPaint();return{cancelled:true}}
  const LONG_ARCHIVE_FORMAT='nova-long-wav-archive-v1';
  const REFERENCE_FIELDS=['midiAssets','audioAssets','fileReferences'];
  function referenceBinaries(project){
    const result=[];
    for(const field of REFERENCE_FIELDS){
      if(project[field]!==undefined&&!Array.isArray(project[field]))throw Error('reference-list-invalid');
      for(const reference of project[field]||[]){
        const b=reference?.binary;
        if(!b||b.format!=='nova-reference-binary-v1'||typeof b.id!=='string'||!b.id||!Number.isSafeInteger(b.size)||b.size<1||!Array.isArray(b.hashes)||b.hashes.length!==Math.ceil(b.size/1048576)||b.hashes.some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h))||typeof b.name!=='string'||!b.name||b.name.length>240||typeof b.type!=='string')throw Error('archive-external-binaries-not-supported');
        result.push(b);
      }
    }return result;
  }
  function archiveBinaries(project){return[project,...versionSnapshots(project)].flatMap(p=>[...(p.longWavAssets||[]),...referenceBinaries(p)])}
  function hasArchiveFiles(project){return [project,...versionSnapshots(project)].some(p=>Boolean(p.longWavAssets?.length||REFERENCE_FIELDS.some(k=>p[k]?.length)))}
  async function retainReferenceFile(projectId,field,index,file){
    if(!file)return{ok:false,cancelled:true};
    if(archiveTransfer.busy||pcmEditor.busy)return{ok:false,error:'reference-transfer-busy'};
    const target=repository,baseline=JSON.stringify(state.projects.find(p=>p.projectId===projectId)),token=++archiveTransfer.generation;
    archiveTransfer.busy=true;requestPaint();
    const guard=()=>{archiveGuard(target);if(token!==archiveTransfer.generation||JSON.stringify(state.projects.find(p=>p.projectId===projectId))!==baseline)throw Error('reference-transfer-stale')};
    try{
      guard();if(target.kind!=='indexeddb'||!target.putLongWav)throw Error('reference-durable-storage-required');
      if(!REFERENCE_FIELDS.includes(field)||!Number.isInteger(index)||index< -1||(index===-1&&field!=='fileReferences'))throw Error('reference-target-invalid');
      if(typeof file.name!=='string'||!file.name.trim()||file.name.length>240||!Number.isSafeInteger(file.size)||file.size<1||typeof file.slice!=='function')throw Error('reference-file-invalid');
      const blob=new Blob([file],{type:file.type||'application/octet-stream'}),hashes=await longWavDigest(blob,guard);guard();
      const current=await target.get(projectId);guard();if(!current||JSON.stringify(current)!==baseline)throw Error('reference-storage-conflict');
      const updated=clone(current),items=updated[field]||[];
      if(!Array.isArray(items)||index>=items.length)throw Error('reference-target-missing');
      const id=uuid(),binary={format:'nova-reference-binary-v1',id,size:blob.size,hashes,name:file.name,type:blob.type};
      if(index===-1)items.push({id:uuid(),name:file.name,binary,storage:{kind:'external-file',reference:file.name,requiresReselection:false}});
      else{const old=items[index];if(!old||typeof old!=='object')throw Error('reference-target-invalid');items[index]={...old,binary,missing:false,storage:{...(old.storage||{}),requiresReselection:false}}}
      updated[field]=items;updated.revision++;updated.updatedAt=now();if(updated.aiWorkspace)updated.aiWorkspace=rebindAIWorkspace(updated.aiWorkspace,projectId,updated.revision);automaticEditRecord(current,updated,'audio-editor');
      if(!validateProject(updated).valid)throw Error('reference-project-invalid');
      await target.putLongWav(updated,{id,blob,hashes},baseline,guard);
      state.projects=state.projects.map(p=>p.projectId===projectId?updated:p);notice('選択したファイル本体を保存しました。完全Backupに含まれます。','success');return{ok:true,project:updated,binaryId:id};
    }catch(e){notice('ファイル本体を保存できません：'+e.message,'error');return{ok:false,error:e.message}}finally{archiveTransfer.busy=false;requestPaint()}
  }
  async function loadReferenceFile(projectId,field,index){
    if(!REFERENCE_FIELDS.includes(field)||!Number.isInteger(index)||index<0)throw Error('reference-target-invalid');
    const target=repository,p=await target.get(projectId),b=p?.[field]?.[index]?.binary;
    if(!b)throw Error('reference-bytes-missing');referenceBinaries({[field]:[p[field][index]]});
    const record=await target.getLongWav?.(b.id);
    if(!record?.blob||record.blob.size!==b.size||JSON.stringify(await longWavDigest(record.blob))!==JSON.stringify(b.hashes))throw Error('reference-bytes-corrupt-or-missing');
    if(repository!==target||JSON.stringify(await target.get(projectId))!==JSON.stringify(p))throw Error('reference-read-stale');
    return{blob:record.blob,name:b.name,type:b.type};
  }
  async function downloadReferenceFile(projectId,field,index){
    try{const result=await loadReferenceFile(projectId,field,index);if(!root.document||!root.URL?.createObjectURL)return{ok:true,...result};
      const url=root.URL.createObjectURL(result.blob),a=root.document.createElement('a');a.href=url;a.download=safeFileName(result.name);root.document.body.appendChild(a);a.click();a.remove();root.setTimeout?.(()=>root.URL.revokeObjectURL(url),1000);return{ok:true};
    }catch(e){notice('元ファイルを書き出せません：'+e.message,'error');return{ok:false,error:e.message}}
  }
  function referenceFilesView(p){
    const id="decodeURIComponent('"+escapeHtml(encodeURIComponent(p.projectId).replace(/'/g,'%27'))+"')",busy=archiveTransfer.busy?' disabled':'';
    return `<section class="music-project-panel music-original-files"><h2>Original files（元ファイル）</h2><p>MIDI・音声の元ファイルを保存し、完全Backupに含めます。ファイル本体の保持です。選択したファイルの音楽解析・編集は別操作です。</p><label>Add file（元ファイルを追加）<input type="file"${busy} onchange="MusicStudio.retainReferenceFile(${id},'fileReferences',-1,this.files[0])"></label>${REFERENCE_FIELDS.flatMap(field=>(p[field]||[]).map((r,i)=>`<div class="music-auto-backup-row"><div><b>${escapeHtml(r.name||r.fileName||r.assetId||r.id||field)}</b><small>${r.binary?'保存済み · '+byteLabel(r.binary.size):'本体未保存 · ファイルを選択してください'}</small></div><label>${r.binary?'Replace file（本体を再選択）':'Retain file（本体を保存）'}<input type="file"${busy} onchange="MusicStudio.retainReferenceFile(${id},'${field}',${i},this.files[0])"></label>${r.binary?`<button class="music-secondary" onclick="MusicStudio.downloadReferenceFile(${id},'${field}',${i})">Original（元ファイル）</button>`:''}</div>`)).join('')}<button class="music-secondary" onclick="MusicStudio.cancelArchiveTransfer()">Cancel（取消）</button></section>`;
  }

  function archiveGuard(target,signal){
    if(signal?.aborted)throw Error('archive-cancelled');
    if(repository!==target||vocalBusy()||state.dirty||midiEditorHasPendingChanges()||pcmEditor.busy||state.midiInput.recording||state.midiInput.starting||state.midiInput.countingIn||state.midiInput.stopping||shutdownPromise)throw Error('archive-stale-or-unsaved');
  }
  function archiveValidateProjects(projects){
    if(!Array.isArray(projects))throw Error('archive-projects-invalid');
    const ids=new Set(),assets=new Map();
    for(const original of projects){
      for(const p of [original,...versionSnapshots(original)]){
      if(!validateProject(p).valid||p===original&&ids.has(p.projectId))throw Error('archive-project-invalid');ids.add(p.projectId);
      const midi=validateRestoredMidi(p);if(midi.errors.length)throw Error('archive-project-invalid: '+midi.errors.join('; '));
      // Never claim a full archive when external referenced bytes are absent.
      const references=referenceBinaries(p);for(const b of references){const identity=JSON.stringify([b.size,b.hashes,'reference']);if(assets.has(b.id)&&assets.get(b.id)!==identity)throw Error('archive-shared-asset-conflict');assets.set(b.id,identity)}
      if(p.longWavAssets!==undefined&&!Array.isArray(p.longWavAssets))throw Error('archive-assets-invalid');
      if(p.audioSeparationHistory!==undefined){
        if(!Array.isArray(p.audioSeparationHistory))throw Error('archive-separation-history-invalid');
        const available=new Set((p.longWavAssets||[]).map(a=>a?.id));
        for(const row of p.audioSeparationHistory){
          if(!row||!Array.isArray(row.assetIds)||!row.assetIds.length||new Set(row.assetIds).size!==row.assetIds.length)throw Error('archive-separation-history-invalid');
          if(row.assetIds.some(id=>typeof id!=='string'||!available.has(id)))throw Error('archive-separation-history-asset-missing');
        }
      }
      for(const a of p.longWavAssets||[]){
        if(a?.mixHistory)longMixHistory(a);if(a?.vocalTake)vocalHistory(a);
        if(!a||typeof a.id!=='string'||!a.id||!Number.isSafeInteger(a.size)||a.size<44||!Array.isArray(a.hashes)||a.hashes.length!==Math.ceil(a.size/1048576)||a.hashes.some(h=>typeof h!=='string'||! /^[a-f0-9]{64}$/.test(h)))throw Error('archive-asset-invalid');
        const identity=JSON.stringify([a.size,a.hashes,a.frames,a.sampleRate,a.channels]);
        if(assets.has(a.id)&&assets.get(a.id)!==identity)throw Error('archive-shared-asset-conflict');assets.set(a.id,identity);
      }
      }
    }
  }
  function recoveryBinaries(p){
    // Legacy references without authenticated bytes remain visible and untouched.
    // They must not prevent repair of an independently authenticated source.
    if(!validateProject(p).valid)throw Error('reference-project-invalid');
    const snapshots=[p,...versionSnapshots(p)].map(snapshot=>{
      const copy={...snapshot};delete copy.songVersions;
      for(const field of REFERENCE_FIELDS){
        if(copy[field]!==undefined&&!Array.isArray(copy[field]))throw Error('reference-list-invalid');
        if(copy[field])copy[field]=copy[field].filter(r=>r?.binary);
      }
      return copy;
    });
    // Validate shared identities across the flattened snapshots as one graph.
    // Different project IDs only prevent the validator's duplicate-project rule;
    // no persisted snapshot or reference is rebound here.
    snapshots.forEach((snapshot,i)=>{snapshot.projectId='recovery-inspection-'+i;if(snapshot.aiWorkspace)snapshot.aiWorkspace={...snapshot.aiWorkspace,projectId:snapshot.projectId}});
    archiveValidateProjects(snapshots);return snapshots.flatMap(archiveBinaries);
  }
  const dependencyReports=new Map();
  // Read bytes from durable storage, including history-only references. A failed
  // or cancelled scan never publishes a partial healthy report or changes a song.
  async function inspectStoredDependencies(projectId,options={}){
    if(archiveTransfer.busy||versionPanel.busy)return{ok:false,error:'reference-transfer-busy'};
    const target=repository,p=state.projects.find(p=>p.projectId===projectId),baseline=JSON.stringify(p),token=++archiveTransfer.generation;
    const guard=()=>{archiveGuard(target,options.signal);if(token!==archiveTransfer.generation||versionPanel.busy||JSON.stringify(state.projects.find(p=>p.projectId===projectId))!==baseline)throw Error('reference-inspection-stale')};
    dependencyReports.delete(projectId);archiveTransfer.busy=true;requestPaint();
    try{
      guard();if(!p||!target.getLongWav)throw Error('reference-durable-storage-required');
      if(target.get&&JSON.stringify(await target.get(projectId))!==baseline)throw Error('reference-inspection-storage-conflict');guard();
      const rows=[],known=new Map(),snapshots=[p,...versionSnapshots(p)];
      for(let si=0;si<snapshots.length;si++){
        const snapshot=snapshots[si],location=si===0?'current':'history:'+si;
        for(const field of REFERENCE_FIELDS)for(const [index,r] of (snapshot[field]||[]).entries()){
          if(!r?.binary)rows.push({id:null,name:r?.name||r?.fileName||field,status:'unverified-legacy',locations:[location+':'+field+':'+index]});
        }
        // Validate each descriptor independently so one legacy reference does not
        // hide authenticated dependencies elsewhere in the project/history.
        for(const b of [...(snapshot.longWavAssets||[]),...REFERENCE_FIELDS.flatMap(f=>(snapshot[f]||[]).filter(r=>r?.binary).flatMap(r=>referenceBinaries({[f]:[r]})))]){
          if(!b||typeof b.id!=='string'||!Number.isSafeInteger(b.size)||!Array.isArray(b.hashes)||b.hashes.length!==Math.ceil(b.size/1048576)||b.hashes.some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)))throw Error('reference-inspection-descriptor-invalid');
          const identity=JSON.stringify([b.size,b.hashes]),prior=known.get(b.id);
          if(prior){prior.locations.push(location);if(prior.identity!==identity)prior.status='identity-conflict';continue}
          const row={id:b.id,name:b.name||b.id,size:b.size,hashes:clone(b.hashes),identity,locations:[location],status:'pending'};known.set(b.id,row);rows.push(row);
        }
      }
      for(const row of known.values()){
        guard();if(row.status==='identity-conflict')continue;
        const record=await target.getLongWav(row.id);guard();
        row.status=!record?'missing':!record.blob||record.blob.size!==row.size||JSON.stringify(record.hashes)!==JSON.stringify(row.hashes)?'corrupt':JSON.stringify(await longWavDigest(record.blob,guard))===JSON.stringify(row.hashes)?'verified':'corrupt';guard();
      }
      if(target.get&&JSON.stringify(await target.get(projectId))!==baseline)throw Error('reference-inspection-storage-conflict');
      const report={checkedAt:now(),rows:rows.map(({identity,...row})=>row),baseline};guard();dependencyReports.set(projectId,report);return{ok:true,report};
    }catch(e){notice('依存ファイルを確認できません：'+e.message,'error');return{ok:false,error:e.message}}finally{archiveTransfer.busy=false;requestPaint()}
  }
  // Restore an absent historical dependency using authenticated original bytes.
  // Snapshots and descriptors stay immutable; no guessed path or sound fallback.
  async function recoverMissingBinary(projectId,binaryId,file,options={}){
    if(!file)return{ok:false,cancelled:true};
    if(archiveTransfer.busy||versionPanel.busy)return{ok:false,error:'reference-transfer-busy'};
    const target=repository,p=state.projects.find(p=>p.projectId===projectId),baseline=JSON.stringify(p),token=++archiveTransfer.generation;
    const guard=()=>{archiveGuard(target,options.signal);if(token!==archiveTransfer.generation||versionPanel.busy||JSON.stringify(state.projects.find(p=>p.projectId===projectId))!==baseline)throw Error('reference-recovery-stale')};
    archiveTransfer.busy=true;requestPaint();
    try{
      guard();if(!p||target.kind!=='indexeddb'||!target.putLongWav||!target.getLongWav)throw Error('reference-durable-storage-required');
      const descriptor=recoveryBinaries(p).find(a=>a.id===binaryId);if(!descriptor)throw Error('reference-recovery-unknown');
      if(file.size!==descriptor.size||typeof file.slice!=='function')throw Error('reference-recovery-size');
      const hashes=await longWavDigest(file,guard);guard();if(JSON.stringify(hashes)!==JSON.stringify(descriptor.hashes))throw Error('reference-recovery-hash');
      const existing=await target.getLongWav(binaryId);guard();
      if(existing){if(!existing.blob||existing.blob.size!==descriptor.size||JSON.stringify(await longWavDigest(existing.blob,guard))!==JSON.stringify(hashes))throw Error('reference-recovery-existing-conflict');guard();return{ok:true,alreadyPresent:true}}
      await archiveCapacity(descriptor.size+pcmJsonBytes(p),guard);guard();
      const next=versionTouch(clone(p)),blob=new Blob([file],{type:descriptor.type||'audio/wav'});
      automaticEditRecord(p,next,'dependency-recovery');
      if(!validateProject(next).valid)throw Error('reference-project-invalid');
      await target.putLongWav(next,{id:binaryId,blob,hashes},baseline,guard);guard();
      state.projects=state.projects.map(x=>x.projectId===projectId?next:x);finalInvalidate();notice('一致する元ファイルを復旧しました。候補版と履歴は保持しています。','success');return{ok:true,project:next};
    }catch(e){notice('元ファイルを復旧できません：'+e.message,'error');return{ok:false,error:e.message}}finally{archiveTransfer.busy=false;requestPaint()}
  }
  function recoverMissingBinarySubmit(event,projectId){const f=event.currentTarget;return recoverMissingBinary(projectId,f.elements.recoveryBinary.value,f.elements.recoveryFile.files?.[0]).finally(()=>{f.elements.recoveryFile.value=''})}
  function binaryRecoveryView(p){
    const report=dependencyReports.get(p.projectId),fresh=report?.baseline===JSON.stringify(p),h=escapeHtml,id=JSON.stringify(p.projectId),inspection=`<button class="music-secondary"${archiveTransfer.busy||versionPanel.busy?' disabled':''} onclick="${h(`MusicStudio.inspectStoredDependencies(${id})`)}">Check dependencies（本体・履歴を照合）</button><button class="music-secondary" onclick="MusicStudio.cancelArchiveTransfer()">Cancel（取消）</button>${fresh?`<p>Checked（照合日時）: ${h(report.checkedAt)}</p><ul>${report.rows.map(r=>`<li>${h(r.name)} · ${h({'verified':'一致','missing':'欠落・元ファイルを再指定','corrupt':'破損・既存本体を保護','identity-conflict':'識別情報が衝突','unverified-legacy':'旧参照・本体未照合'}[r.status])} · ${h(r.locations.join('、'))}</li>`).join('')}</ul>`:report?'<p>曲が変わりました。再照合してください。</p>':''}`;
    let list;try{list=[...new Map(recoveryBinaries(p).map(a=>[a.id,a])).values()]}catch(e){return`${inspection}<p>Dependency recovery（依存ファイル復旧）: ${escapeHtml(e.message)}。識別情報のない旧参照は元のファイル欄から明示的に再選択してください。</p>`}
    if(!list.length)return inspection;
    return`<details class="music-project-details"${fresh?' open':''}><summary>Recover source（履歴の元ファイルを復旧）</summary>${inspection}<p>現在の曲・過去候補版・部分採用履歴が参照するファイルを選べます。欠落した本体だけを復旧し、サイズとSHA-256が一致しないファイルは拒否します。既存本体は置換しません。</p><form onsubmit="event.preventDefault();${h(`MusicStudio.recoverMissingBinarySubmit(event,${id})`)}"><label>Source（依存ファイル）<select name="recoveryBinary">${list.map(a=>`<option value="${h(a.id)}">${h(a.name||a.id)} · ${h(a.size)} bytes</option>`).join('')}</select></label><label>Original file（元ファイル）<input type="file" name="recoveryFile" required></label><button class="music-secondary"${archiveTransfer.busy||versionPanel.busy?' disabled':''}>Recover（照合して復旧）</button></form></details>`;
  }
  function archiveMidiHistories(value){
    if(value===undefined)return{exports:[],imports:[]}; // Archives created before history support.
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('archive-midi-history-invalid');
    for(const key of ['exports','imports']){
      if(!Array.isArray(value[key]))throw Error('archive-midi-history-invalid');
      const ids=new Set();for(const row of value[key]){
        if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.id!=='string'||!row.id||ids.has(row.id)||typeof row.projectId!=='string'||!row.projectId)throw Error('archive-midi-history-invalid');
        ids.add(row.id);
      }
    }
    return value;
  }
  async function readArchiveMidiHistories(target){
    if(!target.listMidiHistory||!target.listMidiImportHistory)throw Error('archive-midi-history-unavailable');
    return archiveMidiHistories({exports:await target.listMidiHistory(),imports:await target.listMidiImportHistory()});
  }
  function vocalJournalMetadata(m){
    if(!m||m.format!=='nova-vocal-journal-v1'||typeof m.id!=='string'||!m.id||m.id.length>100||typeof m.owner!=='string'||!Number.isInteger(m.rate)||m.rate<8000||m.rate>192000||!Number.isSafeInteger(m.next)||m.next<0||m.next>90000||!Number.isSafeInteger(m.frames)||m.frames<0||m.frames>m.rate*VOCAL_CAPTURE_MAX_SECONDS||!Number.isSafeInteger(m.consumed)||m.consumed<0||m.consumed>m.frames||!Number.isSafeInteger(m.startTick)||m.startTick<0||m.startTick>100000000||!Number.isFinite(m.latencyMs)||Math.abs(m.latencyMs)>2000||typeof m.closed!=='boolean'||!Number.isFinite(m.updatedAt))throw Error('vocal-journal-metadata-invalid');
    if(m.encoding!==undefined&&(!['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus','audio/ogg'].includes(m.encoding)||!Number.isSafeInteger(m.encodedBytes)||m.encodedBytes<0||m.encodedBytes>VOCAL_MAX_BYTES||m.frames!==0||m.consumed!==0||m.takeFrames!==undefined))throw Error('vocal-journal-encoding-invalid');
    if(m.recoveredAt!==undefined||m.recoveredFrames!==undefined){if(!m.encoding||!Number.isFinite(m.recoveredAt)||m.recoveredAt<0||!Number.isSafeInteger(m.recoveredFrames)||m.recoveredFrames<1||m.recoveredFrames>192000*VOCAL_CAPTURE_MAX_SECONDS)throw Error('vocal-journal-recovery-marker-invalid')}
    if(m.recordingPlan||m.cycle)vocalHistory({frames:1,sampleRate:m.rate,channels:1,vocalTake:{format:'nova-vocal-take-v1',cursor:0,waveform:[],edits:[{first:0,end:1,gainDb:0,startTick:m.startTick,latencyMs:m.latencyMs}],recordingPlan:m.recordingPlan,cycle:m.cycle}});
    if(m.recordingPlan&&(m.recordingPlan.startTick!==m.startTick||m.recordingPlan.latencyMs!==m.latencyMs))throw Error('vocal-journal-plan-mismatch');
    if(m.takeFrames!==undefined&&(!Number.isSafeInteger(m.takeFrames)||m.takeFrames<1||m.takeFrames>m.rate*VOCAL_CAPTURE_MAX_SECONDS||!m.recordingPlan?.gapless||!m.cycle||m.consumed%m.takeFrames))throw Error('vocal-journal-cycle-boundary-invalid');
    return m;
  }
  async function archiveVocalJournals(target,projects,guard,preserveDamage=false){
    const metadata=await target.listVocalJournals?.()||[],result=[];guard();
    for(const m of metadata){vocalJournalMetadata(m);if(!projects.some(p=>p.projectId===m.owner))throw Error('archive-journal-owner-missing');if(!m.closed&&Date.now()-m.updatedAt<30000)throw Error('archive-journal-may-be-active-wait-30s');const chunks=[];let frames=0;
      let damaged=false;
      for(let i=0;i<m.next;i++){const c=await target.getVocalJournalChunk(m.id+':'+i);guard();
        if(!c){if(!preserveDamage)throw Error('archive-journal-corrupt');chunks.push(null);damaged=true;continue}
        if(!(c.bytes instanceof ArrayBuffer)||c.bytes.byteLength>1048576)throw Error('archive-journal-corrupt');
        const bytes=c.bytes.slice(0),observed=await longWavDigest(new Blob([bytes]),guard);
        if(bytes.byteLength<(m.encoding?1:2)||bytes.byteLength>(m.encoding?1048576:8192)||(!m.encoding&&bytes.byteLength%2)||JSON.stringify(observed)!==JSON.stringify(c.hash))damaged=true;
        frames+=m.encoding?bytes.byteLength:bytes.byteLength/2;if(frames*(m.encoding?1:2)>VOCAL_MAX_BYTES)throw Error('archive-journal-capacity');chunks.push({...c,bytes,observed});
      }
      if(frames!==(m.encoding?m.encodedBytes:m.frames))damaged=true;
      if(damaged&&!preserveDamage)throw Error('archive-journal-corrupt');result.push({meta:m,chunks,damaged});
    }
    if(JSON.stringify(await target.listVocalJournals?.()||[])!==JSON.stringify(metadata))throw Error('archive-journal-conflict');return result;
  }
  async function createLongWavArchive(options={}){
    const target=repository,baseline=JSON.stringify([state.projects,state.settings]),guard=archiveStateGuard(target,options.signal,archiveTransfer.generation,baseline);guard(true);
    if(target.kind!=='indexeddb'||!target.getLongWav)throw Error('archive-durable-storage-required');
    const projects=await target.list();guard(true);archiveValidateProjects(projects);
    const storedSettings=await target.getSettings(),settings=preserveRestoreSettings(storedSettings||state.settings||defaultSettings()),parts=[],entries=[],packed=new Set();
    const histories=await readArchiveMidiHistories(target);guard(true);
    const journals=await archiveVocalJournals(target,projects,guard,options.preserveDamagedJournals===true),journalEntries=[];
    for(const p of projects)for(const a of archiveBinaries(p)){
      guard();if(packed.has(a.id))continue;packed.add(a.id);const record=await target.getLongWav(a.id);
      if(!record?.blob||record.blob.size!==a.size||JSON.stringify(record.hashes)!==JSON.stringify(a.hashes)||JSON.stringify(await longWavDigest(record.blob,guard))!==JSON.stringify(a.hashes))throw Error('archive-binary-corrupt-or-missing');
      // Verify the same audio contract as Restore before publishing a backup.
      // A checksum alone cannot detect a descriptor with incorrect WAV metadata.
      if(a.format!=='nova-reference-binary-v1'){
        let frames=0,sampleRate=0,channels=0;
        for await(const chunk of pcmDecodeWavStream(record.blob)){guard();frames+=chunk.channels[0].length;sampleRate=chunk.sampleRate;channels=chunk.channels.length}
        if(frames!==a.frames||sampleRate!==a.sampleRate||channels!==a.channels)throw Error('archive-wav-metadata-mismatch');
      }
      guard();parts.push(record.blob);entries.push({id:a.id,size:a.size});
    }
    if(JSON.stringify(await target.list())!==JSON.stringify(projects)||JSON.stringify(await target.getSettings())!==JSON.stringify(storedSettings))throw Error('archive-export-conflict');guard(true);
    if(JSON.stringify(await readArchiveMidiHistories(target))!==JSON.stringify(histories))throw Error('archive-export-history-conflict');guard(true);
    for(const j of journals){journalEntries.push({meta:j.meta,...(j.damaged?{preservation:'observed-v1'}:{}),chunks:j.chunks.map(c=>c?({size:c.bytes.byteLength,hash:c.hash,...(j.damaged?{observed:c.observed}:{})}):({missing:true}))});for(const c of j.chunks)if(c)parts.push(c.bytes);}
    if(JSON.stringify((await target.listVocalJournals?.())||[])!==JSON.stringify(journals.map(j=>j.meta)))throw Error('archive-journal-conflict');
    const manifest=new Blob([JSON.stringify({format:LONG_ARCHIVE_FORMAT,projects,settings,entries,midiHistories:histories,vocalJournals:journalEntries})]);
    if(manifest.size>PCM_JSON_LIMIT)throw Error('archive-manifest-capacity');
    const header=new ArrayBuffer(12),v=new DataView(header);v.setUint32(0,0x4e4f5641);v.setUint32(4,1,true);v.setUint32(8,manifest.size,true);
    guard(true);return new Blob([header,manifest,...parts],{type:'application/octet-stream'});
  }
  function archiveStateGuard(target,signal,token,baseline){
    let last=-Infinity;
    return(force=false)=>{
      archiveGuard(target,signal);if(token!==archiveTransfer.generation)throw Error('archive-cancelled');
      const clock=root.performance?.now?.()??Date.now();
      // Bound repeated multi-megabyte metadata serialization during chunk reads.
      // Transaction/publication boundaries always force an exact comparison.
      if(force===true||clock<last||clock-last>=50){
        if(JSON.stringify([state.projects,state.settings])!==baseline)throw Error('archive-state-conflict');
        last=root.performance?.now?.()??Date.now();
      }
    };
  }
  async function archiveCapacity(bytes,guard=()=>{}){
    if(!Number.isSafeInteger(bytes)||bytes<0)throw Error('archive-capacity-invalid');
    const estimate=await root.navigator?.storage?.estimate?.();guard();
    if(!estimate||!Number.isFinite(estimate.quota)||!Number.isFinite(estimate.usage))return{status:'unavailable',requiredBytes:bytes};
    const available=Math.max(0,estimate.quota-estimate.usage),required=Math.ceil(bytes*1.1);
    if(required>available)throw Error('archive-insufficient-storage');
    return{status:'estimated',requiredBytes:required,availableBytes:available};
  }
  async function restoreLongWavArchive(file,options={}){
    if(archiveTransfer.busy)return{ok:false,error:'archive-transfer-busy'};
    const token=++archiveTransfer.generation;archiveTransfer.busy=true;requestPaint();
    const target=repository,baseline=JSON.stringify([state.projects,state.settings]),guard=archiveStateGuard(target,options.signal,token,baseline);
    let committedResult;
    try{
      guard();if(target.kind!=='indexeddb'||!target.restoreLongArchive)throw Error('archive-durable-storage-required');
      const baselineSettings=JSON.stringify(await target.getSettings());guard();
      if(!file||file.size<12)throw Error('archive-truncated');
      const header=new DataView(await file.slice(0,12).arrayBuffer());guard();
      const length=header.getUint32(8,true);
      if(header.getUint32(0)!==0x4e4f5641||header.getUint32(4,true)!==1||!length||length>PCM_JSON_LIMIT||length>file.size-12)throw Error('archive-header-invalid');
      const manifest=JSON.parse(await file.slice(12,12+length).text());guard();
      if(manifest.format!==LONG_ARCHIVE_FORMAT||!validateSettings(manifest.settings).valid||!Array.isArray(manifest.entries))throw Error('archive-manifest-invalid');
      archiveValidateProjects(manifest.projects);
      const sourceHistories=archiveMidiHistories(manifest.midiHistories);
      const expected=[...new Map(manifest.projects.flatMap(p=>archiveBinaries(p)).map(a=>[a.id,a])).values()];
      if(expected.length!==manifest.entries.length)throw Error('archive-binary-count');
      const sourceJournals=manifest.vocalJournals===undefined?[]:manifest.vocalJournals;
      if(!Array.isArray(sourceJournals)||sourceJournals.length>10000||new Set(sourceJournals.map(j=>j?.meta?.id)).size!==sourceJournals.length)throw Error('archive-journals-invalid');
      let journalBytes=0;for(const j of sourceJournals){vocalJournalMetadata(j.meta);if(!manifest.projects.some(p=>p.projectId===j.meta.owner)||!Array.isArray(j.chunks)||j.chunks.length!==j.meta.next||(j.preservation!==undefined&&j.preservation!=='observed-v1'))throw Error('archive-journals-invalid');
        const preserved=j.preservation==='observed-v1';let total=0;
        for(const c of j.chunks){if(preserved&&c?.missing===true)continue;if(!c||!Number.isSafeInteger(c.size)||c.size<(preserved?0:j.meta.encoding?1:2)||c.size>(preserved?1048576:j.meta.encoding?1048576:8192)||(!preserved&&!j.meta.encoding&&c.size%2))throw Error('archive-journal-chunk-invalid');journalBytes+=c.size;total+=j.meta.encoding?c.size:c.size/2;}
        if(!preserved&&total!==(j.meta.encoding?j.meta.encodedBytes:j.meta.frames))throw Error('archive-journal-frame-mismatch');
        if(total*(j.meta.encoding?1:2)>VOCAL_MAX_BYTES)throw Error('archive-journal-capacity');
      }
      const capacity=await archiveCapacity(expected.reduce((n,a)=>n+a.size,0)+length+journalBytes,guard);guard();
      const records=[],mapping=new Map();let offset=12+length;
      for(let i=0;i<expected.length;i++){
        guard();const a=expected[i],entry=manifest.entries[i];
        if(entry.id!==a.id||entry.size!==a.size||!Number.isSafeInteger(offset+a.size)||offset+a.size>file.size)throw Error('archive-binary-missing');
        const blob=file.slice(offset,offset+a.size,a.format==='nova-reference-binary-v1'?a.type:'audio/wav');offset+=a.size;
        if(JSON.stringify(await longWavDigest(blob,guard))!==JSON.stringify(a.hashes))throw Error('archive-binary-corrupt');guard();
        let frames=0,sampleRate=0,channels=0;
        if(a.format!=='nova-reference-binary-v1')for await(const chunk of pcmDecodeWavStream(blob)){guard();frames+=chunk.channels[0].length;sampleRate=chunk.sampleRate;channels=chunk.channels.length;}
        if(a.format!=='nova-reference-binary-v1'&&(frames!==a.frames||sampleRate!==a.sampleRate||channels!==a.channels))throw Error('archive-wav-metadata-mismatch');
        const id=uuid();mapping.set(a.id,id);records.push({id,blob,hashes:clone(a.hashes)});
      }
      const restoredJournals=[];for(const j of sourceJournals){const id=uuid(),chunks=[];for(let i=0;i<j.chunks.length;i++){const c=j.chunks[i];if(j.preservation==='observed-v1'&&c.missing===true)continue;if(offset+c.size>file.size)throw Error('archive-journal-truncated');const bytes=await file.slice(offset,offset+c.size).arrayBuffer();offset+=c.size;if(JSON.stringify(await longWavDigest(new Blob([bytes]),guard))!==JSON.stringify(j.preservation==='observed-v1'?c.observed:c.hash))throw Error('archive-journal-corrupt');chunks.push({id:id+':'+i,bytes,hash:c.hash});}restoredJournals.push({meta:{...clone(j.meta),id,closed:true},chunks});}
      if(offset!==file.size)throw Error('archive-trailing-bytes');
      // New identities prevent overwriting songs, even when restoring on the source device.
      const projectMapping=new Map(manifest.projects.map(p=>[p.projectId,uuid()]));
      for(const j of restoredJournals)j.meta.owner=projectMapping.get(j.meta.owner);
      const projects=manifest.projects.map(source=>{const p=clone(source);p.projectId=projectMapping.get(source.projectId);p.projectName+='（復元）';p.updatedAt=now();
        versionRebind(p,'（復元）');const restored=p;for(const p of [restored,...versionSnapshots(restored)]){p.projectId=restored.projectId;
        p.longWavAssets=(p.longWavAssets||[]).map(a=>({...a,id:mapping.get(a.id)}));
        if(p.audioSeparationHistory)p.audioSeparationHistory=p.audioSeparationHistory.map(row=>({...row,assetIds:row.assetIds.map(id=>mapping.get(id))}));
        const remapPlan=plan=>plan?{...plan,routes:plan.routes.map(r=>({...r,key:r.key.startsWith('wav:')?'wav:'+(mapping.get(r.key.slice(4))||r.key.slice(4)):r.key}))}:plan;
        p.finalExportPlan=remapPlan(p.finalExportPlan);
        if(Array.isArray(p.integrations?.logicPro))p.integrations.logicPro=p.integrations.logicPro.map(link=>({...link,...(link.kind==='audio-return'&&mapping.has(link.assetId)?{assetId:mapping.get(link.assetId)}:{}),...(projectMapping.has(link.sourceProjectId)?{sourceProjectId:projectMapping.get(link.sourceProjectId),originalSourceProjectId:link.originalSourceProjectId||link.sourceProjectId}:{})}));
        if(p.vocalWorkspace?.selectedAssetId)p.vocalWorkspace={...p.vocalWorkspace,selectedAssetId:mapping.get(p.vocalWorkspace.selectedAssetId)};
        if(p.longMasterWorkspace?.selectedAssetId)p.longMasterWorkspace={...p.longMasterWorkspace,selectedAssetId:mapping.get(p.longMasterWorkspace.selectedAssetId)};
        if(p.finalExportHistory)p.finalExportHistory=p.finalExportHistory.map(h=>({...h,projectId:p.projectId,plan:remapPlan(h.plan)}));
        p.masteringNotes=(p.masteringNotes||[]).map(n=>n.format==='nova-long-master-result-v1'?{...n,sourceAssetId:mapping.get(n.sourceAssetId)||n.sourceAssetId}:n);
        for(const field of REFERENCE_FIELDS)p[field]=(p[field]||[]).map(r=>({...r,binary:{...r.binary,id:mapping.get(r.binary.id)}}));
        if(p.aiWorkspace)p.aiWorkspace=rebindAIWorkspace(p.aiWorkspace,p.projectId,p.revision);}
        return p});
      if(projects.some(p=>!validateProject(p).valid))throw Error('archive-remapped-project-invalid');
      const historyProjectMapping=new Map(projectMapping);
      const remapHistory=row=>{if(!historyProjectMapping.has(row.projectId))historyProjectMapping.set(row.projectId,uuid());return{...clone(row),id:uuid(),projectId:historyProjectMapping.get(row.projectId)}};
      const histories={exports:sourceHistories.exports.map(remapHistory),imports:sourceHistories.imports.map(remapHistory)};
      const preservedRecordings=sourceJournals.filter(j=>j.preservation==='observed-v1').length;
      if(options.previewOnly){guard(true);archiveTransfer.preview={file,projectCount:manifest.projects.length,assetCount:expected.length,preservedRecordings,size:file.size,settingsIncluded:true,capacity};requestPaint();return{ok:true,preview:archiveTransfer.preview}}
      guard(true);await target.restoreLongArchive(projects,records,options.settings===false?null:preserveRestoreSettings(manifest.settings),guard,baselineSettings,histories,restoredJournals);
      // A completed transaction cannot be rolled back by a later cancellation
      // or repository switch. Keep its receipt, but never publish into a new UI.
      committedResult={projects,preservedRecordings};guard(true);
      state.projects=[...state.projects,...projects];if(options.settings!==false){state.settings=preserveRestoreSettings(manifest.settings);state.settingsDraft=clone(state.settings)}archiveTransfer.preview=null;configureAutosave();
      await loadMidiHistory();await loadMidiImportHistory();await vocalDiscoverRecovery();
      notice('元ファイル・プロジェクト・設定の復元が完了しました。既存曲は保持しています。'+(preservedRecordings?'破損・欠落を保持した未完了録音 '+preservedRecordings+' 件は、音声修復できたものではありません。':''),'success');
      return{ok:true,committed:true,projects,preservedRecordings};
    }catch(e){if(committedResult){
      if(repository===target)archiveTransfer.preview=null;
      notice('アーカイブは保存済みです。表示の更新が必要です：'+e.message,'warning');
      return{ok:true,committed:true,...committedResult,viewRefreshPending:true,staleAfterCommit:true,message:e.message};
    }notice('復元できません：'+e.message,'error');return{ok:false,committed:false,error:e.message}}finally{archiveTransfer.busy=false;requestPaint()}
  }
  async function previewLongWavArchive(file){
    if(!file)return{ok:false,error:'archive-file-required'};
    archiveTransfer.preview=null;
    return restoreLongWavArchive(file,{previewOnly:true});
  }
  async function restorePreviewedArchive(){
    const preview=archiveTransfer.preview;
    if(!preview)return{ok:false,error:'archive-preview-required'};
    const settings=root.document?.querySelector('#archiveRestoreSettings')?.checked!==false;
    return restoreLongWavArchive(preview.file,{settings});
  }
  async function exportLongWavArchive(){
    if(archiveTransfer.busy)return{ok:false,error:'archive-transfer-busy'};
    const token=++archiveTransfer.generation;archiveTransfer.busy=true;requestPaint();
    try{const blob=await createLongWavArchive({preserveDamagedJournals:true,signal:{get aborted(){return token!==archiveTransfer.generation}}});
      if(!root.document||!root.URL?.createObjectURL)return{ok:true,blob};
      const url=root.URL.createObjectURL(blob),link=root.document.createElement('a');link.href=url;link.download=`music-studio-full-wav_${now().slice(0,10)}.nova`;root.document.body.appendChild(link);link.click();link.remove();root.setTimeout?.(()=>root.URL.revokeObjectURL(url),1000);
      notice('元ファイル・プロジェクト・設定を含むアーカイブを書き出しました。未完了録音の破損・欠落はそのまま保持され、音声修復を保証しません。','success');return{ok:true};
    }catch(e){notice('書き出せません：'+e.message,'error');return{ok:false,error:e.message}}finally{archiveTransfer.busy=false;requestPaint()}
  }
  async function pcmImportLongFile(file,id){
    if(pcmEditor.busy)return{ok:false,error:'pcm-save-busy'};
    const target=repository,token=pcmEditor.generation,baseline=JSON.stringify(state.projects.find(p=>p.projectId===id));
    pcmEditor.busy=true;requestPaint();
    try{
      const guard=()=>{if(target!==repository||token!==pcmEditor.generation||pcmEditor.projectId!==id||JSON.stringify(state.projects.find(p=>p.projectId===id))!==baseline||state.dirty||midiEditorHasPendingChanges()||state.midiInput.recording||state.midiInput.starting)throw Error('long-wav-stale-import')};
      guard();if(target.kind!=='indexeddb'||!target.putLongWav)throw Error('long-wav-durable-storage-required');
      if(!file||typeof file.name!=='string'||!file.name.trim()||file.name.length>240)throw Error('invalid-pcm-name');
      let frames=0,sampleRate=0,channels=0;
      // Validate every sample through bounded slices, without reading the whole WAV.
      for await(const chunk of pcmDecodeWavStream(file)){guard();frames+=chunk.channels[0].length;sampleRate=chunk.sampleRate;channels=chunk.channels.length;}
      const blob=new Blob([file],{type:'audio/wav'}),hashes=await longWavDigest(blob);guard();
      const current=await target.get(id);guard();if(JSON.stringify(current)!==baseline)throw Error('long-wav-storage-conflict');
      const updated=clone(current),assetId=uuid(),record={id:assetId,blob,hashes};
      if(updated.longWavAssets!==undefined&&!Array.isArray(updated.longWavAssets))throw Error('invalid-long-wav-assets');
      updated.longWavAssets=[...(updated.longWavAssets||[]),{id:assetId,name:file.name,size:blob.size,frames,sampleRate,channels,hashes}];
      updated.revision++;updated.updatedAt=now();if(updated.aiWorkspace)updated.aiWorkspace=rebindAIWorkspace(updated.aiWorkspace,id,updated.revision);automaticEditRecord(current,updated,'audio-editor');
      if(!validateProject(updated).valid)throw Error('invalid-pcm-project');
      await target.putLongWav(updated,record,baseline,guard);
      if(repository!==target||pcmEditor.projectId!==id||pcmEditor.generation!==token||JSON.stringify(state.projects.find(p=>p.projectId===id))!==baseline)return{ok:true,committed:true,refreshPending:true,project:updated,assetId};
      state.projects=state.projects.map(p=>p.projectId===id?updated:p);pcmEditor.preview=null;
      pcmEditor.message='元WAV本体を保存しました。長時間音声のGain・EQ・Compressionの候補、保存履歴、加工済みWAV書出しに対応します。Full WAV Archiveはバックアップ画面で利用できます。';
      return{ok:true,project:updated,assetId};
    }catch(e){pcmEditor.message='保存できません：'+e.message;return{ok:false,error:e.message}}
    finally{pcmEditor.busy=false;requestPaint()}
  }
  async function pcmLoadLongWav(id,assetId,guard=()=>{}){
    guard();
    const target=repository,project=await target.get(id),asset=project?.longWavAssets?.find(a=>a.id===assetId);
    if(!asset||!target.getLongWav)throw Error('long-wav-asset-missing');
    longMixHistory(asset);
    const record=await target.getLongWav(assetId);
    if(!record?.blob)throw Error('long-wav-corrupt-or-missing: record');
    if(record.blob.size!==asset.size)throw Error('long-wav-corrupt-or-missing: size');
    if(JSON.stringify(record.hashes)!==JSON.stringify(asset.hashes))throw Error('long-wav-corrupt-or-missing: hash-metadata');
    if(JSON.stringify(await longWavDigest(record.blob,guard))!==JSON.stringify(asset.hashes))throw Error('long-wav-corrupt-or-missing: bytes');
    if(repository!==target||JSON.stringify(await target.get(id))!==JSON.stringify(project))throw Error('long-wav-stale-read');
    guard();return record.blob;
  }
  async function pcmDownloadLongOriginal(id,assetId){
    try{const blob=await pcmLoadLongWav(id,assetId),project=await repository.get(id),asset=project.longWavAssets.find(a=>a.id===assetId);
      if(root.document&&root.URL?.createObjectURL){const url=root.URL.createObjectURL(blob),link=root.document.createElement('a');link.href=url;link.download=safeFileName(asset.name);link.click();root.setTimeout(()=>root.URL.revokeObjectURL(url),1000)}return{ok:true,blob};
    }catch(e){pcmEditor.message='書出しできません：'+e.message;requestPaint();return{ok:false,error:e.message}}
  }

  // Vocal-only capture. Stop acknowledges success only after authenticated bytes
  // and project metadata commit together; failed saves keep a retryable take.
  const vocalCycle={active:false,groupId:'',index:0,total:1,options:null,projectId:'',saved:[]};
  const vocal={phase:'idle',projectId:'',generation:0,message:'',stream:null,recorder:null,pending:null,devices:[],audio:null,url:null,stopPromise:null};
  const VOCAL_CAPTURE_MAX_SECONDS=480;
  const VOCAL_MAX_SECONDS=120,VOCAL_MAX_BYTES=64*1024*1024;
  function vocalBusy(){return Boolean(vocalCycle.active)||Boolean(vocal.finishing)||!['idle','saved','error'].includes(vocal.phase)||Boolean(vocal.pending)}
  function vocalInputLevel(samples){
    if(!samples?.length)throw Error('vocal-meter-empty');let peak=0,sum=0,clipped=0;
    for(const x of samples){if(!Number.isFinite(x))throw Error('vocal-meter-nonfinite');peak=Math.max(peak,Math.abs(x));sum+=x*x;if(Math.abs(x)>=1)clipped++}
    const rms=Math.sqrt(sum/samples.length),db=x=>x>0?20*Math.log10(x):-120;
    return{peak,rms,peakDb:Math.max(-120,db(peak)),rmsDb:Math.max(-120,db(rms)),clipped};
  }
  function vocalMonitor(enabled,gainDb=-12){
    if(typeof enabled!=='boolean'||!Number.isFinite(gainDb)||gainDb< -60||gainDb>0)return{ok:false,error:'vocal-monitor-setting-invalid'};
    if(enabled&&(!vocal.inputGraph||vocal.phase!=='recording'))return{ok:false,error:'vocal-monitor-not-recording'};
    vocal.monitorEnabled=enabled;vocal.monitorGainDb=gainDb;
    if(vocal.inputGraph)vocal.inputGraph.gain.gain.setValueAtTime(enabled?Math.pow(10,gainDb/20):0,vocal.context.currentTime);
    return{ok:true};
  }
  function vocalInputGraph(stream,context){
    if(!context.createAnalyser||!context.createGain||!context.createMediaStreamSource)return false;
    const input=context.createMediaStreamSource(stream),analyser=context.createAnalyser(),gain=context.createGain();
    analyser.fftSize=2048;gain.gain.setValueAtTime(0,context.currentTime);input.connect(analyser);analyser.connect(gain);gain.connect(context.destination);
    const samples=new Float32Array(analyser.fftSize);vocal.inputGraph={input,analyser,gain};vocal.monitorEnabled=false;vocal.monitorGainDb=-12;vocal.level=null;
    const poll=()=>{if(!vocal.inputGraph||vocal.phase!=='recording')return;try{analyser.getFloatTimeDomainData(samples);vocal.level=vocalInputLevel(samples);const meter=root.document?.querySelector('[data-vocal-meter]'),label=root.document?.querySelector('[data-vocal-level]');if(meter)meter.value=Math.min(1,vocal.level.peak);if(label)label.textContent=`Peak ${vocal.level.peakDb.toFixed(1)} dBFS / RMS ${vocal.level.rmsDb.toFixed(1)} dBFS${vocal.level.clipped?' / clipping':''}`;vocal.meterTimer=root.setTimeout?.(poll,100)}catch(e){vocalMonitor(false);vocal.message='入力メーター停止：'+e.message}};
    vocal.pollInput=poll;return true;
  }
  function vocalInputRelease(){root.clearTimeout?.(vocal.meterTimer);vocal.meterTimer=null;vocal.pollInput=null;vocal.monitorEnabled=false;const graph=vocal.inputGraph;vocal.inputGraph=null;for(const node of graph?Object.values(graph):[])try{node.disconnect()}catch(_){}vocal.level=null}
  function vocalRelease(){vocalLyricStop();vocal.transportSynth?.dispose();vocal.transportSynth=null;vocal.transportStart=null;vocalInputRelease();root.clearTimeout?.(vocal.timer);vocal.timer=null;for(const t of vocal.stream?.getTracks?.()||[]){t.onended=null;t.onmute=null;t.stop()}vocal.stream=null;if(vocal.context)vocal.context.onstatechange=null}
  function vocalPlaybackStop(){vocal.playGeneration=(vocal.playGeneration||0)+1;vocal.source?.stop();vocal.source=null;vocal.audio?.pause();if(vocal.audio){vocal.audio.removeAttribute('src');vocal.audio.load()}vocal.audio=null;if(vocal.url)root.URL?.revokeObjectURL(vocal.url);vocal.url=null;vocal.synth?.dispose();vocal.synth=null}
  function vocalDiscard(){vocalCalibrationCancel();vocalCycle.active=false;root.clearTimeout?.(vocalCycle.timer);if(vocal.finishing)return false;if(vocal.phase==='saving'||vocal.phase==='stopping')return false;vocal.generation++;vocal.pendingQueue=[];vocalRelease();vocal.context?.close?.().catch(()=>{});vocal.context=null;if(['recording','paused'].includes(vocal.recorder?.state)){vocal.recorder.onstop=null;vocal.recorder.stop()}vocal.recorder=null;vocal.pending=null;vocal.journalId=null;vocal.phase='idle';vocal.message='未保存テイクの操作を終了しました。永続保存済みの録音は再起動後に復旧を試せます。';vocalPlaybackStop();requestPaint();return true}
  function vocalPosition(project,tick){
    if(!Number.isSafeInteger(tick)||tick<0||tick>100000000)throw Error('vocal-start-tick-invalid');
    const ppq=project.midiData?.ppq||480,bpm=Number(project.musicalSettings?.bpm)||120;
    const map=normalizeProjectTempoMap(project.midiData?.tempoMap,bpm);let first=0,tempo=bpm,seconds=0;
    for(const e of map){if(e.tick>tick)break;seconds+=(e.tick-first)*60/(tempo*ppq);first=e.tick;tempo=e.bpm}
    return seconds+(tick-first)*60/(tempo*ppq);
  }
  // Saved, current lyric assignments only; track identity is always explicit.
  function vocalLyricRows(project,trackId){
    if(!trackId)return [];
    const tracks=(project.midiData?.tracks||[]).filter(t=>t.id===trackId);
    if(tracks.length!==1)throw Error('vocal-lyric-track-required');
    const rows=lyricsSavedRows(project).filter(r=>r.trackId===trackId&&!r.stale).flatMap(r=>r.assignments);
    const seen=new Set();
    for(const r of rows){if(seen.has(r.noteId))throw Error('vocal-lyric-assignment-ambiguous');seen.add(r.noteId)}
    return rows.map(r=>({noteId:r.noteId,token:r.extendsPrevious?'〜':r.token,start:vocalPosition(project,r.startTick),end:vocalPosition(project,r.startTick+r.durationTicks)})).sort((a,b)=>a.start-b.start);
  }
  function vocalLyricAt(rows,seconds){
    if(!Number.isFinite(seconds))return -1;
    return rows.findIndex(r=>seconds>=r.start&&seconds<r.end);
  }
  function vocalLyricStop(){root.clearTimeout?.(vocal.lyricTimer);vocal.lyricTimer=null;vocal.lyricClock=null;vocal.lyricIndex=-1;
    const panel=root.document?.querySelector('[data-vocal-lyrics]');
    for(const item of panel?.querySelectorAll('[data-lyric-index]')||[]){item.classList.remove('is-current');item.removeAttribute('aria-current')}
  }
  function vocalLyricFollow(rows,clock){
    vocalLyricStop();vocal.lyricRows=rows;vocal.lyricClock=clock;let last=-2,lastItem=null;
    const update=()=>{if(vocal.lyricClock!==clock)return;const seconds=clock(),index=vocalLyricAt(rows,seconds);vocal.lyricIndex=index;
      const panel=root.document?.querySelector('[data-vocal-lyrics]');
      if(panel){const items=panel.querySelectorAll('[data-lyric-index]');for(const item of items){const active=Number(item.dataset.lyricIndex)===index;item.classList.toggle('is-current',active);if(active)item.setAttribute('aria-current','true');else item.removeAttribute('aria-current')}
        const item=index>=0?items[index]:null;
        if(item&&(last!==index||lastItem!==item))panel.scrollTop=Math.max(0,item.offsetTop-panel.offsetTop-panel.clientHeight/2+item.offsetHeight/2);
        lastItem=item;
        const time=panel.parentElement.querySelector('[data-lyric-clock]');if(time)time.textContent=seconds<0?'録音開始待ち':`曲位置 ${seconds.toFixed(1)} 秒`;
      }last=index;vocal.lyricTimer=root.setTimeout?.(update,50);
    };update();
  }
  function vocalLyricView(p,folded=false){
    const preset=[...(p.longWavAssets||[])].reverse().find(a=>a.vocalTake?.recordingPlan)?.vocalTake.recordingPlan||{},trackId=vocal.projectId===p.projectId&&vocal.lyricRows?.length?vocal.lyricTrackId:preset.lyricTrackId||'';let rows=[];
    try{rows=vocalLyricRows(p,trackId)}catch(e){return `<p>${escapeHtml(e.message)}</p>`}
    const html=`<div class="music-vocal-lyric-follow"><h3>Lyric Follow（歌詞を追う）</h3><p data-lyric-clock>保存済みの音符割付を曲の時間に合わせて表示します。</p><div data-vocal-lyrics tabindex="0" aria-label="歌詞・音符の時間表示">${rows.map((r,i)=>`<span data-lyric-index="${i}" class="${vocal.lyricIndex===i?'is-current':''}">${escapeHtml(r.token)} <small>${r.start.toFixed(2)}s</small></span>`).join('')||'<p>録音設定で歌詞トラックを選択してください。未割付・音符変更後の割付は表示できません。</p>'}</div></div>`;
    return folded&&!rows.length?`<details class="music-vocal-lyrics-fold" onkeydown="MusicStudio.vocalDisclosureKey(event,this)"><summary>Lyrics（歌詞同期・設定）</summary>${html}</details>`:html;
  }
  function vocalPeakPlan(pcm,setting,targetDb=-1){
    if(!Number.isFinite(targetDb)||targetDb< -24||targetDb>0)throw Error('vocal-normalize-target-invalid');
    const rendered=vocalProcessPCM(pcm,setting);let peak=0;
    for(const channel of rendered.channels)for(const x of channel){if(!Number.isFinite(x))throw Error('vocal-normalize-nonfinite');peak=Math.max(peak,Math.abs(x))}
    if(peak===0)throw Error('vocal-normalize-silent');
    const measuredDb=20*Math.log10(peak),gainDb=setting.gainDb+targetDb-measuredDb;
    if(gainDb< -24||gainDb>12)throw Error('vocal-normalize-gain-out-of-range');
    return{measuredDb,targetDb,setting:{...setting,gainDb}};
  }
  async function vocalNormalizePreview(id,assetId,targetDb=-1){
    if(vocalBusy()||pcmEditor.busy||state.dirty||midiEditorHasPendingChanges()||archiveTransfer.busy)return{ok:false,error:'vocal-analysis-busy'};
    const generation=++vocalCorrection.generation,p=state.projects.find(x=>x.projectId===id),baseline=JSON.stringify(p),target=repository;
    const guard=()=>{if(generation!==vocalCorrection.generation||target!==repository||state.dirty||midiEditorHasPendingChanges()||baseline!==JSON.stringify(state.projects.find(x=>x.projectId===id)))throw Error('vocal-normalize-stale')};
    vocal.phase='analyzing';vocalCorrection.preview=null;requestPaint();
    try{const pcm=await vocalReadPCM(id,assetId,guard),h=vocalHistory(pcm.asset),setting=h.edits[h.cursor],plan=vocalPeakPlan(pcm,setting,targetDb);guard();
      vocalCorrection.preview={id,assetId,baseline,analysis:[],candidates:[{first:setting.first,end:setting.end,semitones:0,ratio:1,noteId:'Peak Normalize（ピーク音量を揃える）',count:1}],selected:[0],setting,pcm,normalization:plan,trackId:'',timing:false};
      vocal.phase='saved';vocal.message=`ピーク ${plan.measuredDb.toFixed(2)} → ${targetDb.toFixed(2)} dBFS。Before / Afterで確認して採用してください。LUFS・True Peak処理ではありません。`;vocalCorrection.openAssets.add(assetId);return{ok:true,measuredDb:plan.measuredDb,targetDb,gainDb:plan.setting.gainDb};
    }catch(e){if(generation===vocalCorrection.generation){vocal.phase='error';vocal.message=e.message}return{ok:false,error:e.message}}finally{requestPaint()}
  }

  function vocalTransportPlan(project,options={}){
    const startTick=Number(options.startTick||0),transportTick=options.transportTick===undefined?startTick:Number(options.transportTick),countInBeats=Number(options.countInBeats||0),cycles=Number(options.cycles||1);
    vocalPosition(project,startTick);vocalPosition(project,transportTick);
    if(options.lyricTrackId!==undefined&&typeof options.lyricTrackId!=='string')throw Error('vocal-lyric-track-required');
    vocalLyricRows(project,options.lyricTrackId||'');
    if(!Number.isInteger(countInBeats)||countInBeats<0||countInBeats>16||transportTick>startTick||!Number.isInteger(cycles)||cycles<1||cycles>8)throw Error('vocal-transport-plan-invalid');
    if(cycles>1&&options.endTick===undefined)throw Error('vocal-cycle-end-required');
    const windowSeconds=vocalRecordingWindow(project,startTick,options.endTick);
    if(options.gapless!==undefined&&typeof options.gapless!=='boolean')throw Error('vocal-gapless-choice-invalid');
    if(options.gapless&&(cycles<2||windowSeconds*cycles>VOCAL_CAPTURE_MAX_SECONDS))throw Error('vocal-gapless-total-limit-480s');
    const map=normalizeProjectTempoMap(project.midiData?.tempoMap,Number(project.musicalSettings?.bpm)||120);let bpm=Number(project.musicalSettings?.bpm)||120;for(const e of map){if(e.tick>transportTick)break;bpm=e.bpm}
    const beatSeconds=60/bpm,delaySeconds=countInBeats*beatSeconds+vocalPosition(project,startTick)-vocalPosition(project,transportTick);
    if(delaySeconds>120)throw Error('vocal-preroll-too-long');
    return{gapless:options.gapless===true,windowSeconds,enabled:countInBeats>0||Boolean(options.accompaniment)||cycles>1||transportTick<startTick,transportTick,startTick,countInBeats,cycles,beatSeconds,delaySeconds,accompaniment:Boolean(options.accompaniment),lyricTrackId:options.lyricTrackId||''};
  }
  async function vocalCycleStart(id,options={}){
    if(vocalBusy()||vocalCycle.active)return{ok:false,error:'vocal-cycle-busy'};
    try{const p=state.projects.find(p=>p.projectId===id),plan=vocalTransportPlan(p,options);vocalCycle.active=plan.cycles>1;vocalCycle.groupId=uuid();vocalCycle.index=1;vocalCycle.total=plan.cycles;vocalCycle.saved=[];vocalCycle.options=clone(options);vocalCycle.projectId=id;const result=await vocalStart(id,vocalCycle.options,vocalCycle.options);if(!result.ok)vocalCycle.active=false;return result}catch(e){vocalCycle.active=false;vocal.message=e.message;requestPaint();return{ok:false,error:e.message}}
  }
  function vocalSetting(asset,value){
    if(!value||!Number.isSafeInteger(value.first)||!Number.isSafeInteger(value.end)||value.first<0||value.end>asset.frames||value.end<=value.first||!Number.isFinite(value.gainDb)||value.gainDb< -24||value.gainDb>12||!Number.isFinite(value.latencyMs)||Math.abs(value.latencyMs)>2000||!Number.isSafeInteger(value.startTick)||value.startTick<0||value.startTick>100000000)throw Error('vocal-edit-invalid');
    const result={first:value.first,end:value.end,gainDb:value.gainDb,latencyMs:value.latencyMs,startTick:value.startTick};
    if(value.regions!==undefined)result.regions=vocalRegions(asset,value.regions);
    if(result.regions?.some(r=>r.first<value.first||r.end>value.end))throw Error('vocal-region-outside-trim');
    if(value.lyricOffsets!==undefined){if(!Array.isArray(value.lyricOffsets)||value.lyricOffsets.length>4096||new Set(value.lyricOffsets.map(x=>(x.trackId||'')+':'+x.noteId)).size!==value.lyricOffsets.length||value.lyricOffsets.some(x=>(x.trackId!==undefined&&typeof x.trackId!=='string')||typeof x.noteId!=='string'||!x.noteId||!Number.isFinite(x.seconds)||Math.abs(x.seconds)>10))throw Error('vocal-lyric-offset-invalid');result.lyricOffsets=value.lyricOffsets.map(x=>({...((x.trackId!==undefined)?{trackId:x.trackId}:{}),noteId:x.noteId,seconds:x.seconds}))}return result;
  }
  function vocalHistory(asset){
    const t=asset?.vocalTake;if(!Number.isSafeInteger(asset?.frames)||asset.frames<1||!Number.isInteger(asset.sampleRate)||asset.sampleRate<8000||asset.sampleRate>192000||![1,2].includes(asset.channels))throw Error('vocal-asset-format-invalid');if(!t||!['nova-vocal-take-v1','nova-vocal-take-v2','nova-vocal-take-v3'].includes(t.format)||!Number.isInteger(t.cursor)||!Array.isArray(t.edits)||t.edits.length<1||t.edits.length>100||t.cursor<0||t.cursor>=t.edits.length||!Array.isArray(t.waveform)||t.waveform.length>240||t.waveform.some(x=>!Number.isFinite(x)||x<0||x>1))throw Error('vocal-history-invalid');
    if(t.scoreSource!==undefined){const x=t.scoreSource;if(x?.trimOriginFrame!==undefined&&(!Number.isSafeInteger(x.trimOriginFrame)||x.trimOriginFrame<0||x.trimOriginFrame>=asset.frames))throw Error('vocal-score-trim-origin-invalid');if(!x||x.format!=='nova-score-vocal-source-v1'||!['score-zero','first-note'].includes(x.origin)||typeof x.recordId!=='string'||!x.recordId||typeof x.trackId!=='string'||!x.trackId||typeof x.scoreXML!=='string'||x.scoreXML.length>4000000||!x.scoreXML.startsWith('<?xml'))throw Error('vocal-score-source-invalid')}
    if(t.recordingPlan){const r=t.recordingPlan;if(r.gapless!==undefined&&typeof r.gapless!=='boolean')throw Error('vocal-gapless-choice-invalid');if(r.useInputProfile!==undefined&&typeof r.useInputProfile!=='boolean')throw Error('vocal-input-profile-choice-invalid');if(r.inputCompensation!==undefined){const c=r.inputCompensation;if(!c||!['manual','saved-manual'].includes(c.method)||!Number.isFinite(c.latencyMs)||Math.abs(c.latencyMs)>2000||c.latencyMs!==r.latencyMs||(c.deviceId!==undefined&&(typeof c.deviceId!=='string'||!c.deviceId||c.deviceId.length>512)))throw Error('vocal-input-compensation-invalid')}if(r.format!=='nova-vocal-recording-plan-v1'||(r.latencyMs!==undefined&&(!Number.isFinite(r.latencyMs)||Math.abs(r.latencyMs)>2000))||!Number.isSafeInteger(r.startTick)||r.startTick<0||r.startTick>100000000||!Number.isSafeInteger(r.transportTick)||r.transportTick<0||r.transportTick>r.startTick||!Number.isInteger(r.countInBeats)||r.countInBeats<0||r.countInBeats>16||!Number.isInteger(r.cycles)||r.cycles<1||r.cycles>8||typeof r.accompaniment!=='boolean'||(r.lyricTrackId!==undefined&&typeof r.lyricTrackId!=='string')||(r.endTick!==undefined&&(!Number.isSafeInteger(r.endTick)||r.endTick<=r.startTick||r.endTick>100000000))||(r.cycles>1&&r.endTick===undefined))throw Error('vocal-recording-plan-invalid')}
    if(t.cycle){const c=t.cycle;if(c.format!=='nova-vocal-cycle-v1'||typeof c.groupId!=='string'||!c.groupId||c.groupId.length>100||!Number.isInteger(c.index)||!Number.isInteger(c.total)||c.total<2||c.total>8||c.index<1||c.index>c.total||!Number.isSafeInteger(c.startTick)||!Number.isSafeInteger(c.endTick)||c.startTick<0||c.endTick<=c.startTick||c.endTick>100000000||!Number.isInteger(c.countInBeats)||c.countInBeats<0||c.countInBeats>16)throw Error('vocal-cycle-metadata-invalid')}
    if(t.format!=='nova-vocal-take-v3'&&t.edits.some(x=>x.regions?.some(r=>r.gainDb!==undefined)))throw Error('vocal-history-version-requires-v3');return{cursor:t.cursor,edits:t.edits.map(x=>vocalSetting(asset,x))};
  }
  function vocalDecodedWav(buffer){
    // Never discard extra channels or accept unequal decoder output silently.
    if(!buffer||![1,2].includes(buffer.numberOfChannels))throw Error('vocal-decoded-channels-invalid');
    return vocalWav(Array.from({length:buffer.numberOfChannels},(_,c)=>buffer.getChannelData(c)),buffer.sampleRate);
  }
  function vocalWav(channels,rate){
    const frames=channels[0]?.length;if(!frames||channels.length<1||channels.length>2||channels.some(c=>c.length!==frames)||!Number.isInteger(rate)||rate<8000||rate>192000||frames>rate*(VOCAL_MAX_SECONDS+5))throw Error('vocal-decoded-size-invalid');
    const pieces=[],waveform=Array(240).fill(0);let clipped=0;
    for(let first=0;first<frames;first+=16384){const count=Math.min(16384,frames-first),c=channels.map(a=>Array.from(a.slice(first,first+count)));for(let i=0;i<count;i++)for(let j=0;j<c.length;j++){let x=c[j][i];if(!Number.isFinite(x))throw Error('vocal-nonfinite-sample');if(Math.abs(x)>=1)clipped++;c[j][i]=Math.max(-1,Math.min(1,x));const bin=Math.min(239,Math.floor((first+i)*240/frames));waveform[bin]=Math.max(waveform[bin],Math.abs(c[j][i]))}pieces.push(pcmEncodeWav({sampleRate:rate,channels:c}).slice(44))}
    const header=pcmEncodeWav({sampleRate:rate,channels:channels.map(()=>[0])}).slice(0,44),v=new DataView(header);v.setUint32(4,36+frames*channels.length*2,true);v.setUint32(40,frames*channels.length*2,true);
    return{blob:new Blob([header,...pieces],{type:'audio/wav'}),frames,sampleRate:rate,channels:channels.length,waveform,clipped};
  }
  function vocalGaplessTakes(channels,rate,takeFrames,total,template){
    if(!Number.isSafeInteger(takeFrames)||takeFrames<1||!Number.isInteger(total)||total<2||total>8||!channels?.length||channels.some(c=>c.length!==channels[0].length)||channels[0].length>takeFrames*total)throw Error('vocal-gapless-frames-invalid');
    const takes=[];
    for(let first=0,index=1;first<channels[0].length;first+=takeFrames,index++){
      const end=Math.min(first+takeFrames,channels[0].length),wav=vocalWav(channels.map(c=>c.slice(first,end)),rate);
      takes.push({...template,...wav,name:`Vocal-${template.cycle.groupId.slice(0,8)}-Take-${index}.wav`,cycle:{...template.cycle,index},recordingPlan:{...template.recordingPlan}});
    }
    if(!takes.length)throw Error('vocal-recording-empty');return takes;
  }
  // Worklet WAV is already canonical PCM16. Inspect bounded slices and retain
  // its exact bytes instead of decoding the whole take through AudioContext.
  async function vocalCapturedWav(blob,guard=()=>{}){
    guard();if(!blob||blob.size<46||blob.size>VOCAL_MAX_BYTES)throw Error('vocal-capture-size');
    const v=new DataView(await blob.slice(0,44).arrayBuffer()),four=at=>String.fromCharCode(...new Uint8Array(v.buffer,at,4));
    if(four(0)!=='RIFF'||four(8)!=='WAVE'||four(12)!=='fmt '||v.getUint32(16,true)!==16||v.getUint16(20,true)!==1||four(36)!=='data'||v.getUint16(34,true)!==16||v.getUint32(4,true)+8!==blob.size||v.getUint32(40,true)+44!==blob.size)throw Error('vocal-capture-format');
    const channels=v.getUint16(22,true),sampleRate=v.getUint32(24,true),frames=(blob.size-44)/(channels*2),waveform=Array(240).fill(0);
    if(![1,2].includes(channels)||!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000||!Number.isSafeInteger(frames)||frames<1||frames>sampleRate*VOCAL_CAPTURE_MAX_SECONDS)throw Error('vocal-decoded-size-invalid');
    let position=0,clipped=0;
    for await(const chunk of pcmDecodeWavStream(blob)){guard();if(chunk.sampleRate!==sampleRate||chunk.channels.length!==channels)throw Error('vocal-capture-format');for(let i=0;i<chunk.channels[0].length;i++){const bin=Math.min(239,Math.floor((position+i)*240/frames));for(const c of chunk.channels){const x=c[i];waveform[bin]=Math.max(waveform[bin],Math.abs(x));if(Math.abs(x)>=1)clipped++}}position+=chunk.channels[0].length}
    guard();if(position!==frames)throw Error('vocal-capture-frames');return{blob,frames,sampleRate,channels,waveform,clipped};
  }
  async function vocalCapturedTakes(wav,takeFrames,total,template,guard=()=>{}){
    if(!Number.isSafeInteger(takeFrames)||takeFrames<1||!Number.isInteger(total)||total<2||total>8||wav.frames>takeFrames*total)throw Error('vocal-gapless-frames-invalid');
    const takes=[];
    for(let first=0,index=1;first<wav.frames;first+=takeFrames,index++){
      guard();const frames=Math.min(takeFrames,wav.frames-first),size=frames*wav.channels*2,header=await wav.blob.slice(0,44).arrayBuffer(),v=new DataView(header);v.setUint32(4,size+36,true);v.setUint32(40,size,true);
      const blob=new Blob([header,wav.blob.slice(44+first*wav.channels*2,44+(first+frames)*wav.channels*2)],{type:'audio/wav'}),part=await vocalCapturedWav(blob,guard);
      takes.push({...template,...part,name:`Vocal-${template.cycle.groupId.slice(0,8)}-Take-${index}.wav`,cycle:{...template.cycle,index},recordingPlan:{...template.recordingPlan}});
    }
    guard();if(!takes.length)throw Error('vocal-recording-empty');return takes;
  }
  const vocalRecovery={items:[],error:''};
  async function vocalDiscoverRecovery(){try{vocalRecovery.items=await repository.listVocalJournals?.()||[];vocalRecovery.error=''}catch(e){vocalRecovery.error=e.message}requestPaint();return vocalRecovery.items}
  async function vocalRecoverJournal(journalId,options={}){
    if(vocalBusy()||state.dirty||midiEditorHasPendingChanges()||archiveTransfer.busy||shutdownPromise)return{ok:false,error:'vocal-recovery-busy'};
    const target=repository;vocal.phase='stopping';requestPaint();
    try{const m=await target.getVocalJournal(journalId);if(m?.encoding)return await vocalRecoverEncodedJournal(m,target,options);const p=state.projects.find(x=>x.projectId===m?.owner);
      if(!m||m.format!=='nova-vocal-journal-v1'||!p||!Number.isInteger(m.rate)||m.rate<8000||m.rate>192000||!Number.isSafeInteger(m.next)||m.next<1||m.next>90000||!Number.isSafeInteger(m.frames)||m.frames<1||m.frames>m.rate*VOCAL_CAPTURE_MAX_SECONDS||!Number.isSafeInteger(m.consumed)||m.consumed<0||m.consumed>=m.frames||!Number.isSafeInteger(m.startTick)||m.startTick<0||!Number.isFinite(m.latencyMs)||Math.abs(m.latencyMs)>2000)throw Error('vocal-journal-metadata-invalid');
      vocalJournalMetadata(m);
      if(!m.closed&&Date.now()-m.updatedAt<30000)throw Error('vocal-journal-may-be-active-wait-30s');
      const baseline=JSON.stringify(p),guard=()=>{if(repository!==target||state.dirty||midiEditorHasPendingChanges()||JSON.stringify(state.projects.find(x=>x.projectId===p.projectId))!==baseline)throw Error('vocal-recovery-conflict')};
      await target.sealVocalJournal(m.id,m);guard();const pieces=[];let frames=0,damage='';
      for(let i=0;i<m.next;i++){guard();const c=await target.getVocalJournalChunk(m.id+':'+i);
        if(!c||!(c.bytes instanceof ArrayBuffer)||c.bytes.byteLength<2||c.bytes.byteLength>8192||c.bytes.byteLength%2||JSON.stringify(await longWavDigest(new Blob([c.bytes]),guard))!==JSON.stringify(c.hash)){damage='vocal-journal-corrupt-prefix-only';break}
        const n=c.bytes.byteLength/2;if(frames+n>m.frames){damage='vocal-journal-frame-mismatch';break}
        if(frames+n>m.consumed)pieces.push(c.bytes.slice(Math.max(0,m.consumed-frames)*2));frames+=n;
      }
      if(frames!==m.frames&&!damage)damage='vocal-journal-frame-mismatch';
      if(frames<=m.consumed)throw Error('vocal-journal-no-valid-unsaved-audio');
      const remaining=frames-m.consumed,header=pcmEncodeWav({sampleRate:m.rate,channels:[[0]]}).slice(0,44),v=new DataView(header);v.setUint32(4,36+remaining*2,true);v.setUint32(40,remaining*2,true);
      const wav=await vocalCapturedWav(new Blob([header,...pieces],{type:'audio/wav'}),guard);guard();
      const template={...wav,name:'Recovered-'+m.id+'.wav',captureMime:'audio/wav',startTick:m.startTick,latencyMs:m.latencyMs,...(m.recordingPlan?{recordingPlan:clone(m.recordingPlan)}:{}),...(m.cycle?{cycle:clone(m.cycle)}:{})};
      const pending=m.takeFrames?await vocalCapturedTakes(wav,m.takeFrames,m.recordingPlan.cycles,template,guard):[template];
      if(m.takeFrames)for(let i=0;i<pending.length;i++)pending[i].cycle.index=1+m.consumed/m.takeFrames+i;
      Object.assign(vocal,{projectId:p.projectId,target,baseline,journalId:m.id,journalConsumed:m.consumed,journalExpectedNext:m.next,journalRetain:Boolean(damage||frames!==m.frames),pendingQueue:pending.slice(1),pending:pending[0],phase:'pending'});
      // Corrupt tails remain available for inspection; consume only verified frames.
      const result=await vocalSave();if(result.ok){vocal.message='中断した録音の有効な音声を復旧しました。'+(damage?'破損した後続部分は復旧できません。':'');result.warning=damage}await vocalDiscoverRecovery();return result;
    }catch(e){vocal.phase='error';vocal.message='復旧できません：'+e.message;return{ok:false,error:e.message}}finally{requestPaint()}
  }
  async function vocalRecoverEncodedJournal(m,target,options={}){
    let context;try{
      vocalJournalMetadata(m);if(m.recoveredAt!==undefined)throw Error('vocal-encoded-journal-already-recovered-source-retained');const p=state.projects.find(p=>p.projectId===m.owner);if(!p||!m.next)throw Error('vocal-journal-no-valid-unsaved-audio');if(!m.closed&&Date.now()-m.updatedAt<30000)throw Error('vocal-journal-may-be-active-wait-30s');
      const baseline=JSON.stringify(p),guard=()=>{if(repository!==target||state.dirty||midiEditorHasPendingChanges()||JSON.stringify(state.projects.find(x=>x.projectId===p.projectId))!==baseline)throw Error('vocal-recovery-conflict')};await target.sealVocalJournal(m.id,m);guard();const pieces=[];let size=0;
      let excluded=0;
      for(let i=0;i<m.next;i++){const c=await target.getVocalJournalChunk(m.id+':'+i);guard();if(!c||!(c.bytes instanceof ArrayBuffer)||c.bytes.byteLength<1||c.bytes.byteLength>1048576||JSON.stringify(await longWavDigest(new Blob([c.bytes]),guard))!==JSON.stringify(c.hash)){
        if(options.salvageTail!==true||!pieces.length)throw Error('vocal-encoded-journal-corrupt');excluded=m.next-i;break;
      }size+=c.bytes.byteLength;pieces.push(c.bytes);}
      if(!excluded&&size!==m.encodedBytes)throw Error('vocal-encoded-journal-size-mismatch');const Context=root.AudioContext||root.webkitAudioContext;if(!Context)throw Error('vocal-audio-decoder-unavailable');context=new Context();let buffer,dropped=excluded;try{buffer=await context.decodeAudioData(await new Blob(pieces,{type:m.encoding}).arrayBuffer())}catch(error){
        // Explicit salvage only: bounded prefix probes never rewrite/delete the source.
        if(options.salvageTail!==true)throw error;
        let budget=0;for(let n=1;n<=Math.min(8,pieces.length-1);n++){
          guard();const prefix=new Blob(pieces.slice(0,-n),{type:m.encoding});budget+=prefix.size;if(budget>33554432)break;
          try{buffer=await context.decodeAudioData(await prefix.arrayBuffer());dropped=excluded+n;break}catch(_){}
        }
        if(!buffer)throw Error('vocal-encoded-tail-salvage-unavailable-source-retained');
      }guard();const wav=vocalDecodedWav(buffer);
      Object.assign(vocal,{projectId:p.projectId,target,baseline,journalId:m.id,journalConsumed:0,journalExpectedNext:m.next,journalRetain:true,pendingQueue:[],pending:{...wav,name:(dropped?'Recovered-prefix-':'Recovered-')+m.id+'.wav',captureMime:m.encoding,startTick:m.startTick,latencyMs:m.latencyMs,recordingPlan:m.recordingPlan,...(m.cycle?{cycle:clone(m.cycle)}:{})},phase:'pending'});
      const result=await vocalSave();if(result.ok){result.warning=dropped?'vocal-encoded-prefix-only-source-retained':'vocal-encoded-completeness-unverified-source-retained';result.excludedTailChunks=dropped;vocal.message='デコードできた音声を保存しました。圧縮音声全体の完全性は確認できないため、元データを保持しました。必要なら退避できます。'+(dropped?'末尾 '+dropped+' チャンクを除いた部分復旧です。':'')}await vocalDiscoverRecovery();return result;
    }catch(e){vocal.phase='error';vocal.message='互換録音を復旧できません（元データは保持）：'+e.message;return{ok:false,error:e.message}}finally{await context?.close?.().catch(()=>{});requestPaint()}
  }
  async function vocalJournalAction(journalId,remove=false,diagnose=false){
    if(vocalBusy()||state.dirty||midiEditorHasPendingChanges()||archiveTransfer.busy||shutdownPromise)return{ok:false,error:'vocal-recovery-busy'};
    const target=repository,previousPhase=vocal.phase;vocal.phase='stopping';requestPaint();
    try{
      const m=await target.getVocalJournal(journalId);if(!m||!Number.isSafeInteger(m.next)||m.next<0||m.next>90000)throw Error('vocal-journal-metadata-invalid');
      if(!m.closed&&Date.now()-m.updatedAt<30000)throw Error('vocal-journal-may-be-active-wait-30s');
      const current=()=>{if(repository!==target)throw Error('vocal-journal-conflict')};const guard=async()=>{current();const observed=await target.getVocalJournal(journalId);current();if(JSON.stringify(observed)!==JSON.stringify(m))throw Error('vocal-journal-conflict')};
      if(remove){
        if(!(root.confirm?.('この未完了録音を完全に削除しますか？復元できません。必要なら先に「元データを退避」を実行してください。保存済みTakeは削除されません。')??false))return{ok:false,cancelled:true};
        await guard();await target.deleteVocalJournal(journalId,m,current);current();vocal.message='未完了録音を削除しました。';
      }else{
        // Rescue container preserves observed bytes, including corrupt chunks. It is not a verified audio backup.
        const parts=[],entries=[];let offset=0;
        for(let i=0;i<m.next;i++){const c=await target.getVocalJournalChunk(m.id+':'+i);if(!c||!(c.bytes instanceof ArrayBuffer)){entries.push({seq:i,missing:true});continue}if(c.bytes.byteLength>1048576||offset+c.bytes.byteLength>VOCAL_MAX_BYTES)throw Error('vocal-journal-rescue-capacity');const observed=await longWavDigest(new Blob([c.bytes]),()=>{});entries.push({seq:i,offset,size:c.bytes.byteLength,expected:c.hash,observed,verified:JSON.stringify(observed)===JSON.stringify(c.hash)});parts.push(c.bytes);offset+=c.bytes.byteLength;}
        await guard();if(diagnose){
          vocalJournalMetadata(m);let prefixFrames=0,prefix=true;
          for(const e of entries){const valid=e.verified&&!e.missing&&e.size>=2&&e.size<=8192&&e.size%2===0;if(!valid)prefix=false;if(prefix)prefixFrames+=e.size/2;}
          const report={encoding:m.encoding||'pcm16',chunks:m.next,bytes:offset,verified:entries.filter(e=>e.verified).length,missing:entries.filter(e=>e.missing).length,damaged:entries.filter(e=>!e.missing&&!e.verified).length,unsavedPrefixFrames:m.encoding?null:Math.max(0,Math.min(prefixFrames,m.frames)-m.consumed),decodedCompleteness:'unverified',recovered:m.recoveredAt!==undefined};
          vocal.message='録音診断：照合一致 '+report.verified+' / 欠落 '+report.missing+' / 照合不一致 '+report.damaged+' チャンク。'+(m.encoding?'圧縮音声の復号・末尾の完全性は未確認です。':'復旧候補 '+report.unsavedPrefixFrames+' PCMフレーム。')+'原本は変更していません。';return{ok:true,report};
        }const header=new Blob([JSON.stringify({format:'nova-vocal-rescue-v1',metadata:m,entries})]),length=new ArrayBuffer(4);new DataView(length).setUint32(0,header.size,true);const blob=new Blob([length,header,...parts],{type:'application/octet-stream'});
        if(root.document&&root.URL?.createObjectURL){const url=root.URL.createObjectURL(blob),link=root.document.createElement('a');try{link.href=url;link.download=safeFileName(m.id)+'.nova-recording';root.document.body.appendChild(link);link.click();link.remove()}finally{root.setTimeout?.(()=>root.URL.revokeObjectURL(url),1000)}}
        vocal.message='元データを退避しました。破損・欠落を含む調査用データで、音声の復旧は保証されません。';return{ok:true,blob,entries};
      }
      return{ok:true};
    }catch(e){vocal.message='操作できません（元データは保持）：'+e.message;return{ok:false,error:e.message}}finally{vocal.phase=previousPhase;await vocalDiscoverRecovery();requestPaint()}
  }
  async function vocalImportRescue(file,projectId){
    if(vocalBusy()||state.dirty||midiEditorHasPendingChanges()||archiveTransfer.busy||shutdownPromise)return{ok:false,error:'vocal-recovery-busy'};
    const target=repository,p=state.projects.find(p=>p.projectId===projectId),baseline=JSON.stringify(p),previousPhase=vocal.phase;
    const guard=()=>{if(repository!==target||state.dirty||midiEditorHasPendingChanges()||JSON.stringify(state.projects.find(p=>p.projectId===projectId))!==baseline)throw Error('vocal-recovery-conflict')};
    vocal.phase='stopping';requestPaint();
    try{
      if(!p||!target.importVocalJournal)throw Error('vocal-durable-storage-required');
      if(!file||file.size<4||file.size>VOCAL_MAX_BYTES+16777220)throw Error('vocal-rescue-size-invalid');
      const length=new DataView(await file.slice(0,4).arrayBuffer()).getUint32(0,true);guard();
      if(!length||length>16777216||4+length>file.size)throw Error('vocal-rescue-header-invalid');
      const h=JSON.parse(await file.slice(4,4+length).text());guard();
      if(h.format!=='nova-vocal-rescue-v1')throw Error('vocal-rescue-format-invalid');vocalJournalMetadata(h.metadata);
      if(!Array.isArray(h.entries)||h.entries.length!==h.metadata.next)throw Error('vocal-rescue-entries-invalid');
      const id=uuid(),chunks=[];let offset=0,damaged=0;
      for(let i=0;i<h.entries.length;i++){
        const e=h.entries[i];if(!e||e.seq!==i)throw Error('vocal-rescue-order-invalid');
        if(e.missing===true){damaged++;continue}
        if(e.offset!==offset||!Number.isSafeInteger(e.size)||e.size<0||e.size>1048576||offset+e.size>VOCAL_MAX_BYTES||4+length+offset+e.size>file.size)throw Error('vocal-rescue-chunk-invalid');
        const bytes=await file.slice(4+length+offset,4+length+offset+e.size).arrayBuffer();offset+=e.size;
        const observed=await longWavDigest(new Blob([bytes]),guard);guard();
        if(JSON.stringify(observed)!==JSON.stringify(e.observed))throw Error('vocal-rescue-integrity-failed');
        if(JSON.stringify(observed)!==JSON.stringify(e.expected))damaged++;
        // Preserve the original expected hash: damaged input must never become trusted audio.
        chunks.push({id:id+':'+i,bytes,hash:e.expected});
      }
      if(4+length+offset!==file.size)throw Error('vocal-rescue-trailing-data');
      await archiveCapacity(file.size,guard);guard();
      const meta={...clone(h.metadata),id,owner:projectId,closed:true};
      await target.importVocalJournal(meta,chunks,baseline,guard);
      vocal.message='退避録音を取り込みました。「取得済み音声を復旧」で復旧できます。破損・欠落 '+damaged+' 件。';return{ok:true,journalId:id,damaged};
    }catch(e){vocal.message='取り込めません（既存データは保持）：'+e.message;return{ok:false,error:e.message}}
    finally{vocal.phase=previousPhase;await vocalDiscoverRecovery();requestPaint()}
  }
  function vocalRecoveryView(p){return `<label>退避録音を取り込む <input type="file" accept=".nova-recording" onchange="${escapeHtml('MusicStudio.vocalImportRescue(this.files[0],'+JSON.stringify(p.projectId)+')')}" ${vocalBusy()?'disabled':''}></label>`+vocalRecovery.items.filter(m=>m.owner===p.projectId).map(m=>`<p>未完了録音（${escapeHtml(m.id)}）${m.recoveredAt!==undefined?"デコード済み音声を保存済み・元の圧縮データを保持中。":""}${[['vocalRecoverJournal','取得済み音声を復旧',''],...(m.encoding?[['vocalRecoverJournal','末尾を除いた復旧を試す（原本保持）',',{salvageTail:true}']]:[]),['vocalJournalAction','録音データを診断',',false,true'],['vocalJournalAction','元データを退避',''],['vocalJournalAction','完全に削除',',true']].filter(([action])=>m.recoveredAt===undefined||action!=='vocalRecoverJournal').map(([action,label,arg])=>`<button type="button" onclick="${escapeHtml('MusicStudio.'+action+'('+JSON.stringify(m.id)+arg+')')}" ${vocalBusy()?'disabled':''}>${label}</button>`).join('')}</p>`).join('')+(vocalRecovery.error?`<p>${escapeHtml(vocalRecovery.error)}</p>`:'')}

  async function vocalPCMRecorder(stream,context,active,recordSeconds=VOCAL_CAPTURE_MAX_SECONDS){
    await context.audioWorklet.addModule('./music-studio-vocal-worklet.js?v=1.0.4');if(!active())throw Error('vocal-worklet-start-cancelled');
    const node=new root.AudioWorkletNode(context,'nova-vocal-pcm',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:1,channelCountMode:'explicit',processorOptions:{maxFrames:Math.max(1,Math.floor(context.sampleRate*recordSeconds))}}),input=context.createMediaStreamSource(stream),pieces=[];
    let frames=0,done=false;const recorder={pcm16:true,clippedSamples:0,state:'inactive',mimeType:'audio/wav',frames:0,pause(){if(this.state!=='recording')return;this.state='paused';node.port.postMessage('pause')},resume(){if(this.state!=='paused')return;this.state='recording';node.port.postMessage('resume')},start(atFrame){this.state='recording';node.port.postMessage(atFrame===undefined?'start':{type:'start',atFrame})},stop(){if(this.state==='inactive')return;this.state='inactive';node.port.postMessage('stop');root.clearTimeout?.(recorder.flushTimer);recorder.flushTimer=root.setTimeout?.(()=>finish(Error('vocal-worklet-flush-timeout')),5000)}};
    const finish=async error=>{if(done)return;done=true;recorder.state='inactive';root.clearTimeout?.(recorder.flushTimer);input.disconnect();node.disconnect();node.port.close();await recorder.journalTail;if(recorder.journalId)try{await recorder.journalTarget.closeVocalJournal(recorder.journalId)}catch(e){error=error||e}if(error&&frames===0)recorder.onerror?.({error});else{
      // Retain the validated PCM prefix when the processor/flush is interrupted.
      // Incomplete input is explicitly marked; the normal atomic Take save owns persistence.
      if(error)recorder.interruption=error.message;
      const header=pcmEncodeWav({sampleRate:context.sampleRate,channels:[[0]]}).slice(0,44),v=new DataView(header);v.setUint32(4,36+frames*2,true);v.setUint32(40,frames*2,true);recorder.ondataavailable?.({data:new Blob([header,...pieces],{type:'audio/wav'})});
    }pieces.length=0;recorder.onstop?.()};
    node.port.onmessage=e=>{if(done)return;try{const data=e.data;if(data.type==='armed'){recorder.onarmed?.(data);return}if(data.type==='schedule-error')throw Error('vocal-schedule-invalid');if(data.type==='started'){recorder.onstart?.(data);return}if(data.type==='pcm'){
      if(!(data.samples instanceof Float32Array)||data.samples.length<1||data.samples.length>4096)throw Error('vocal-worklet-pcm-invalid');const nextFrames=frames+data.samples.length;if(nextFrames>context.sampleRate*VOCAL_CAPTURE_MAX_SECONDS||44+nextFrames*2>VOCAL_MAX_BYTES)throw Error('vocal-worklet-duration-limit');const samples=Array.from(data.samples,x=>{if(!Number.isFinite(x))throw Error('vocal-worklet-sample-invalid');if(Math.abs(x)>=1)recorder.clippedSamples++;return Math.max(-1,Math.min(1,x))});pieces.push(new Blob([pcmEncodeWav({sampleRate:context.sampleRate,channels:[samples]}).slice(44)]));frames=nextFrames;recorder.frames=frames;
      if(recorder.journalId){const seq=recorder.journalSeq++,piece=pieces[pieces.length-1];recorder.journalQueued+=samples.length;
        if(recorder.journalQueued>context.sampleRate*2)throw Error('vocal-journal-too-slow');
        recorder.journalTail=recorder.journalTail.then(async()=>{if(recorder.journalFailed)return;const bytes=await piece.arrayBuffer(),hash=await longWavDigest(new Blob([bytes]));await recorder.journalTarget.appendVocalJournal(recorder.journalId,seq,bytes,hash);recorder.journalQueued-=samples.length}).catch(e=>{recorder.journalFailed=true;recorder.interruption=e.message;finish(e)});
      }const status=root.document?.querySelector('[data-vocal-status]');if(status&&vocal.phase==='recording')status.textContent=`PCM録音中 ${(frames/context.sampleRate).toFixed(1)}s${vocal.gaplessFrames?' / Take '+Math.min(vocal.gaplessTotal,Math.floor(frames/vocal.gaplessFrames)+1)+'/'+vocal.gaplessTotal:''} / clipping ${recorder.clippedSamples}`;
    }else if(data.type==='stopped'){if(data.frames!==frames||data.sampleRate!==context.sampleRate)throw Error('vocal-worklet-flush-mismatch');finish()}}catch(error){finish(error)}};
    node.onprocessorerror=()=>finish(Error('vocal-worklet-processor-failed'));input.connect(node);node.connect(context.destination);return recorder;
  }

  async function vocalStart(id,options={},cycleToken=null){
    editorStopCandidateAudition();
    const cycleContinuation=vocalCycle.active&&cycleToken===vocalCycle.options&&!vocal.finishing&&!vocal.pending&&['idle','saved','error'].includes(vocal.phase);
    if((vocalBusy()&&!cycleContinuation)||shutdownPromise||state.dirty||midiEditorHasPendingChanges()||state.midiInput.recording||state.midiInput.starting||pcmEditor.busy||archiveTransfer.busy)return{ok:false,error:'vocal-operation-busy-or-unsaved'};
    const target=repository,p=state.projects.find(x=>x.projectId===id),baseline=JSON.stringify(p),token=++vocal.generation;let stream,context;
    vocalPlaybackStop();vocal.phase='permission';vocal.projectId=id;vocal.message='マイクの許可を確認しています。';requestPaint();
    const active=()=>token===vocal.generation&&target===repository&&baseline===JSON.stringify(state.projects.find(x=>x.projectId===id))&&!state.dirty&&!midiEditorHasPendingChanges();
    try{
      if(!p||target.kind!=='indexeddb'||!target.putLongWav)throw Error('vocal-durable-storage-required');
      const startTick=Number(options.startTick||0);let recordSeconds=vocalRecordingWindow(p,startTick,options.endTick);const plan=vocalTransportPlan(p,options);if(plan.gapless&&(!vocalCycle.active||cycleToken!==vocalCycle.options))throw Error('vocal-gapless-session-required');vocalPosition(p,startTick);vocalInputCompensation(p,options,'');
      if(!root.navigator?.mediaDevices?.getUserMedia||(!root.MediaRecorder&&!root.AudioWorkletNode))throw Error('vocal-microphone-unavailable-use-secure-origin');
      const Context=root.AudioContext||root.webkitAudioContext;if(!Context)throw Error('vocal-audio-decoder-unavailable');context=new Context({sampleRate:48000});vocal.context=context;await context.resume();if(plan.enabled&&(!context.audioWorklet||!root.AudioWorkletNode))throw Error('vocal-transport-requires-pcm-worklet');
      stream=await root.navigator.mediaDevices.getUserMedia({video:false,audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false,...(options.deviceId?{deviceId:{exact:options.deviceId}}:{})}});
      if(!active())throw Error('vocal-start-cancelled-or-stale');vocal.stream=stream;const resolvedDeviceId=stream.getAudioTracks?.()[0]?.getSettings?.().deviceId||options.deviceId||'',compensation=vocalInputCompensation(p,options,resolvedDeviceId),latencyMs=compensation.latencyMs;vocalInputGraph(stream,context);
      const types=['audio/webm;codecs=opus','audio/mp4','audio/webm'],mime=types.find(t=>root.MediaRecorder?.isTypeSupported?.(t));
      const pcmCapture=Boolean(context.audioWorklet&&root.AudioWorkletNode);if(!pcmCapture){if(options.endTick!==undefined&&recordSeconds>VOCAL_MAX_SECONDS)throw Error('vocal-long-recording-requires-pcm-worklet');recordSeconds=Math.min(recordSeconds,VOCAL_MAX_SECONDS)}
      const captureSeconds=plan.gapless?Math.round(recordSeconds*context.sampleRate)*plan.cycles/context.sampleRate:recordSeconds;if(captureSeconds>(pcmCapture?VOCAL_CAPTURE_MAX_SECONDS:VOCAL_MAX_SECONDS))throw Error('vocal-capture-duration-limit');
      const expectedBytes=44+Math.ceil(captureSeconds*context.sampleRate)*2;if(pcmCapture&&expectedBytes>VOCAL_MAX_BYTES)throw Error('vocal-capture-byte-limit');
      if(root.navigator?.storage?.estimate){const estimate=await root.navigator.storage.estimate();if(!active())throw Error('vocal-start-cancelled-or-stale');const free=estimate.quota-estimate.usage;if(Number.isFinite(free)&&free<expectedBytes*(pcmCapture?3:1)+1048576)throw Error('vocal-storage-capacity')}
      const recorder=context.audioWorklet&&root.AudioWorkletNode?await vocalPCMRecorder(stream,context,active,captureSeconds):new root.MediaRecorder(stream,mime?{mimeType:mime}:{}),chunks=[];let bytes=0,failure=null;
      vocal.recorder=recorder;vocal.lyricTrackId=plan.lyricTrackId;vocal.lyricRows=vocalLyricRows(p,plan.lyricTrackId);vocal.lyricIndex=-1;vocal.baseline=baseline;vocal.target=target;vocal.startTick=startTick;vocal.latencyMs=latencyMs;vocal.startedAt=null;vocal.recordSeconds=captureSeconds;vocal.gaplessFrames=plan.gapless?Math.round(recordSeconds*context.sampleRate):0;vocal.gaplessTotal=plan.gapless?plan.cycles:0;vocal.pendingQueue=[];vocal.elapsedSeconds=0;vocal.transportEnabled=plan.enabled;vocal.currentCycle=vocalCycle.active?{format:'nova-vocal-cycle-v1',groupId:vocalCycle.groupId,index:vocalCycle.index,total:vocalCycle.total,startTick,endTick:options.endTick,countInBeats:plan.countInBeats}:null;
      vocal.journalId=null;vocal.journalConsumed=0;vocal.journalRetain=false;vocal.journalExpectedNext=undefined;
      const recordingPlan={format:'nova-vocal-recording-plan-v1',gapless:plan.gapless,startTick,latencyMs,inputCompensation:compensation,useInputProfile:options.useInputProfile===true,transportTick:plan.transportTick,countInBeats:plan.countInBeats,cycles:plan.cycles,accompaniment:plan.accompaniment,...(plan.lyricTrackId?{lyricTrackId:plan.lyricTrackId}:{}),...(options.endTick!==undefined?{endTick:options.endTick}:{})};
      {const journalId=uuid();await target.createVocalJournal({id:journalId,format:'nova-vocal-journal-v1',owner:id,rate:context.sampleRate||48000,...(!recorder.pcm16?{encoding:recorder.mimeType||mime,encodedBytes:0}:{}),startTick,latencyMs,recordingPlan,...(vocal.currentCycle?{cycle:clone(vocal.currentCycle)}:{}),...(plan.gapless?{takeFrames:Math.round(recordSeconds*context.sampleRate)}:{}),next:0,frames:0,consumed:0,updatedAt:Date.now(),closed:false});if(!active())throw Error('vocal-start-cancelled-or-stale');
        Object.assign(recorder,{journalId,journalTarget:target,journalSeq:0,journalQueued:0,journalTail:Promise.resolve()});vocal.journalId=journalId;
      }
      recorder.ondataavailable=e=>{if(token!==vocal.generation)return;if(e.data?.size){bytes+=e.data.size;if(bytes>VOCAL_MAX_BYTES){failure=Error('vocal-encoded-limit-exceeded');vocalStop()}else{chunks.push(e.data);if(!recorder.pcm16){const data=e.data;recorder.journalQueued+=data.size;if(recorder.journalQueued>4194304){failure=Error('vocal-journal-too-slow');vocalStop();return;}recorder.journalTail=recorder.journalTail.then(async()=>{for(let offset=0;offset<data.size;offset+=1048576){const bytes=await data.slice(offset,offset+1048576).arrayBuffer(),hash=await longWavDigest(new Blob([bytes]));await target.appendVocalJournal(recorder.journalId,recorder.journalSeq++,bytes,hash);}recorder.journalQueued-=data.size;}).catch(e=>{failure=e;vocalCycle.active=false;vocalStop()});}}}};
      recorder.onerror=e=>{failure=Error(e.error?.message||'vocal-capture-failed');vocalStop()};
      recorder.onarmed=()=>{if(!active()||recorder.state!=='recording')return;vocal.phase='armed';vocal.message='Count-in / Punch（録音待機中）・ヘッドホンを使用してください。';requestPaint()};
      recorder.onstart=ack=>{if(plan.enabled&&ack?.atFrame!==vocal.scheduledFrame){failure=Error('vocal-transport-frame-mismatch');vocalStop();return}if(recorder.state!=='recording')return;if(!active()){vocalDiscard();return}vocal.phase='recording';vocal.startedAt=Date.now();vocal.pollInput?.();vocal.timer=plan.enabled?null:root.setTimeout?.(()=>vocalStop(true),recordSeconds*1000);vocal.message='ボーカル録音中。Stopで保存します（PCM最大8分／互換録音最大120秒）。';requestPaint()};
      vocal.completion=new Promise(resolve=>{recorder.onstop=async()=>{let savedResult;vocal.finishing=true;vocalRelease();vocal.phase='stopping';requestPaint();try{
        await recorder.journalTail;if(!recorder.pcm16){try{const m=await target.getVocalJournal(recorder.journalId);await target.sealVocalJournal(recorder.journalId,m)}catch(e){recorder.interruption=e.message}if(failure){recorder.interruption=failure.message;failure=null}}if(failure)throw failure;if(!active())throw Error('vocal-recording-stale');if(!chunks.length)throw Error('vocal-recording-empty');
        const encoded=new Blob(chunks,{type:recorder.mimeType||chunks[0].type}),captureGuard=()=>{if(!active())throw Error('vocal-recording-stale')};
        let buffer,wav;if(recorder.pcm16)wav=await vocalCapturedWav(encoded,captureGuard);else{buffer=await context.decodeAudioData(await encoded.arrayBuffer());captureGuard();wav=vocalDecodedWav(buffer)}captureGuard();
        wav.clipped=recorder.clippedSamples??wav.clipped;vocal.pending={...wav,name:vocal.currentCycle?`Vocal-${vocal.currentCycle.groupId.slice(0,8)}-Take-${vocal.currentCycle.index}.wav`:'Vocal-'+new Date().toISOString().replace(/[:.]/g,'-')+'.wav',captureMime:encoded.type,startTick,latencyMs,recordingPlan:clone(recordingPlan),...(vocal.currentCycle?{cycle:clone(vocal.currentCycle)}:{})};if(plan.gapless){if(recorder.pcm16)vocal.pendingQueue=await vocalCapturedTakes(wav,Math.round(recordSeconds*wav.sampleRate),plan.cycles,vocal.pending,captureGuard);else{const channels=Array.from({length:Math.min(2,buffer.numberOfChannels)},(_,c)=>buffer.getChannelData(c));vocal.pendingQueue=vocalGaplessTakes(channels,buffer.sampleRate,Math.round(recordSeconds*buffer.sampleRate),plan.cycles,vocal.pending)}vocal.pending=vocal.pendingQueue.shift();vocalCycle.active=false;}vocal.phase='pending';if(recorder.interruption)vocalCycle.active=false;savedResult=await vocalSave();if(recorder.interruption&&savedResult?.ok){vocal.message='録音が中断しました。取得済み音声を保存しました：'+recorder.interruption;savedResult.interruption=recorder.interruption;}
      }catch(e){vocal.phase='error';vocal.message='録音できません：'+e.message;savedResult={ok:false,error:e.message}}finally{await context.close().catch(()=>{});vocal.context=null;vocal.recorder=null;vocal.finishing=false;resolve(savedResult);if(savedResult?.ok&&vocalCycle.active){vocalCycle.saved.push(savedResult.assetId);if(vocalCycle.index<vocalCycle.total){vocalCycle.index++;const continuation=vocalCycle.options;vocalCycle.timer=root.setTimeout?.(()=>{if(vocalCycle.active&&vocalCycle.options===continuation)vocalStart(id,continuation,continuation)},0)}else vocalCycle.active=false}else if(!savedResult?.ok)vocalCycle.active=false;requestPaint()}}});
      context.onstatechange=()=>{if(context.state==='suspended'&&['recording','armed'].includes(vocal.phase)){if(plan.enabled){vocal.message='音声処理が中断しました。取得済みテイクを保存し、繰り返しを終了します。';vocalStop()}else vocalPause()}};for(const t of stream.getAudioTracks()){t.onmute=()=>{if(['recording','armed'].includes(vocal.phase)){if(plan.enabled){vocal.message='マイク入力が休止しました。取得済みテイクを保存し、繰り返しを終了します。';vocalStop()}else vocalPause()}};t.onended=()=>{vocal.message='マイクが切断されました。取得済み音声を保存します。';vocalStop()}};
      if(plan.enabled){vocal.transportSynth=root.MusicStudioAudio?.createSynth({context});prepareInstruments(vocal.transportSynth,p);if(!vocal.transportSynth)throw Error('vocal-transport-synth-unavailable');await vocal.transportSynth.unlock();if(!active())throw Error('vocal-start-cancelled-or-stale');const origin=context.currentTime+.15;vocal.scheduledFrame=Math.ceil((origin+plan.delaySeconds)*context.sampleRate);vocal.transportStart=vocal.scheduledFrame/context.sampleRate;for(let i=0;i<plan.countInBeats;i++)vocal.transportSynth.metronomeClick(i===0,origin+i*plan.beatSeconds);if(plan.accompaniment)vocal.transportSynth.playTracks(p.midiData?.tracks||[],{ppq:p.midiData?.ppq||480,tempo:Number(p.musicalSettings?.bpm)||120,tempoMap:p.midiData?.tempoMap,startTick:plan.transportTick,endTick:options.endTick,startTime:origin+plan.countInBeats*plan.beatSeconds});if(plan.gapless&&plan.accompaniment)for(let cycle=1;cycle<plan.cycles;cycle++)vocal.transportSynth.playTracks(p.midiData?.tracks||[],{ppq:p.midiData?.ppq||480,tempo:Number(p.musicalSettings?.bpm)||120,tempoMap:p.midiData?.tempoMap,append:true,startTick,endTick:options.endTick,startTime:vocal.transportStart+cycle*Math.round(recordSeconds*context.sampleRate)/context.sampleRate});recorder.start(vocal.scheduledFrame)}else if(recorder.pcm16)recorder.start();else recorder.start(1000);
      if(plan.lyricTrackId)vocalLyricFollow(vocal.lyricRows,()=>{if(plan.enabled)return vocalPosition(p,startTick)+(plan.gapless?(context.currentTime-vocal.transportStart)%(vocal.gaplessFrames/context.sampleRate):context.currentTime-vocal.transportStart);const elapsed=Number.isFinite(recorder.frames)?recorder.frames/context.sampleRate:vocal.elapsedSeconds+(vocal.phase==='recording'?(Date.now()-vocal.startedAt)/1000:0);return vocalPosition(p,startTick)+elapsed});
      try{vocal.devices=(await root.navigator.mediaDevices.enumerateDevices()).filter(x=>x.kind==='audioinput').map(x=>({id:x.deviceId,name:x.label||'Microphone'}))}catch(_){}
      return{ok:true};
    }catch(e){for(const t of stream?.getTracks?.()||[])t.stop();await context?.close?.().catch(()=>{});if(token===vocal.generation){vocalCycle.active=false;vocalRelease();vocal.phase='error';vocal.context=null;vocal.message='開始できません：'+e.message;requestPaint()}return{ok:false,error:e.message}}
  }
  function vocalPause(){
    if(vocal.transportEnabled)return{ok:false,error:'vocal-transport-pause-use-stop-to-preserve-timeline'};
    if(vocal.phase!=='recording'||typeof vocal.recorder?.pause!=='function')return{ok:false,error:'vocal-pause-unavailable'};
    try{vocal.recorder.pause();vocal.elapsedSeconds+=(Date.now()-vocal.startedAt)/1000;root.clearTimeout?.(vocal.timer);root.clearTimeout?.(vocal.meterTimer);vocalMonitor(false);vocal.phase='paused';vocal.message='一時停止中。休止区間は音声に含まれません。Resumeで続行、Stopで取得済みテイクを保存します。';requestPaint();return{ok:true}}catch(e){return{ok:false,error:e.message}}
  }
  async function vocalResume(){
    if(vocal.phase!=='paused'||typeof vocal.recorder?.resume!=='function')return{ok:false,error:'vocal-resume-unavailable'};
    const token=vocal.generation,target=vocal.target,recorder=vocal.recorder,guard=()=>token===vocal.generation&&target===repository&&recorder===vocal.recorder&&vocal.phase==='paused'&&!state.dirty&&!midiEditorHasPendingChanges()&&vocal.baseline===JSON.stringify(state.projects.find(p=>p.projectId===vocal.projectId));
    try{if(!guard())throw Error('vocal-resume-stale');await vocal.context.resume();if(!guard())throw Error('vocal-resume-stale');const elapsed=Number.isFinite(recorder.frames)?recorder.frames/vocal.context.sampleRate:vocal.elapsedSeconds,remaining=vocal.recordSeconds-elapsed;if(remaining<=0)return await vocalStop(true);recorder.resume();vocal.phase='recording';vocal.startedAt=Date.now();vocal.timer=root.setTimeout?.(()=>vocalStop(true),remaining*1000);vocal.pollInput?.();vocal.message='ボーカル録音を再開しました。モニターはOFFです。';requestPaint();return{ok:true}}catch(e){vocal.message=e.message;requestPaint();return{ok:false,error:e.message}}
  }
  function vocalStop(naturalCompletion=false){if(vocalCalibration){vocalCalibrationCancel();return Promise.resolve({ok:false,error:'vocal-calibration-cancelled'})}if(!naturalCompletion){vocalCycle.active=false;root.clearTimeout?.(vocalCycle.timer);}if(vocal.stopPromise)return vocal.stopPromise;if(vocal.phase==='permission'){vocalDiscard();return Promise.resolve({ok:false,error:'vocal-permission-cancelled'})}if(!vocal.recorder)return Promise.resolve({ok:!vocal.pending});vocal.phase='stopping';vocalMonitor(false);root.clearTimeout?.(vocal.meterTimer);root.clearTimeout?.(vocal.timer);if(vocal.recorder.state!=='inactive')vocal.recorder.stop();requestPaint();const promise=vocal.completion;vocal.stopPromise=promise;promise.finally(()=>{if(vocal.stopPromise===promise)vocal.stopPromise=null});return promise}
  async function vocalSave(){
    if(!vocal.pending||vocal.phase==='saving')return{ok:false,error:'vocal-no-pending-take'};
    const target=vocal.target,id=vocal.projectId,baseline=vocal.baseline,token=vocal.generation,take=vocal.pending;
    const guard=()=>{if(repository!==target||token!==vocal.generation||vocal.pending!==take||state.dirty||midiEditorHasPendingChanges()||JSON.stringify(state.projects.find(x=>x.projectId===id))!==baseline)throw Error('vocal-save-conflict')};
    vocal.phase='saving';requestPaint();try{guard();const hashes=await longWavDigest(take.blob,guard),p=await target.get(id);guard();if(JSON.stringify(p)!==baseline)throw Error('vocal-storage-conflict');
      const assetId=uuid(),asset={id:assetId,name:take.name,size:take.blob.size,frames:take.frames,sampleRate:take.sampleRate,channels:take.channels,hashes,vocalTake:{format:'nova-vocal-take-v1',recordedAt:now(),...(take.cycle?{cycle:clone(take.cycle)}:{}),...(take.recordingPlan?{recordingPlan:clone(take.recordingPlan)}:{}),captureMime:take.captureMime,clippedSamples:take.clipped,waveform:take.waveform,cursor:0,edits:[{first:0,end:take.frames,gainDb:0,startTick:take.startTick,latencyMs:take.latencyMs}]}};
      vocalHistory(asset);const updated=clone(p);updated.longWavAssets=[...(updated.longWavAssets||[]),asset];updated.vocalWorkspace={...vocalWorkspace(updated),selectedAssetId:assetId};updated.revision++;updated.updatedAt=now();if(updated.aiWorkspace)updated.aiWorkspace=rebindAIWorkspace(updated.aiWorkspace,id,updated.revision);automaticEditRecord(p,updated,'vocal-editor');if(!validateProject(updated).valid)throw Error('vocal-project-invalid');
      await target.putLongWav(updated,{id:assetId,blob:take.blob,hashes,...(vocal.journalId?{journalId:vocal.journalId,journalConsumed:vocal.journalConsumed||0,journalFrames:take.frames,journalExpectedNext:vocal.journalExpectedNext,journalComplete:!vocal.pendingQueue?.length&&!vocal.journalRetain}: {})},baseline,guard);if(vocal.journalId){vocal.journalConsumed=(vocal.journalConsumed||0)+take.frames;if(!vocal.pendingQueue?.length)vocal.journalId=null;}
      state.projects=state.projects.map(x=>x.projectId===id?updated:x);vocal.pending=null;vocal.baseline=JSON.string…93992 tokens truncated…" autocomplete="off"><label><span>AI instruction（AIへの指示）</span><select name="intent" ${canPreview?'':'disabled'}>${intentOptions}</select></label><label class="music-partial-edit-instruction"><span>Supplemental instruction（任意）</span><textarea name="instruction" maxlength="200" ${canPreview?'':'disabled'}>${escapeHtml(runtime.text)}</textarea></label><label><span>Provider（AI提供元）</span><select name="provider" ${canPreview?'':'disabled'}><option value="openai" ${runtime.provider==='openai'?'selected':''}>OpenAI</option><option value="gemini" ${runtime.provider==='gemini'?'selected':''}>Gemini</option></select></label><label><span>Model（モデル）</span><input name="model" value="${escapeHtml(runtime.model)}" required ${canPreview?'':'disabled'}></label><label><span>Runtime API Key（実行環境のAPIキー）</span><input name="apiKey" type="password" value="" required autocomplete="new-password" ${canPreview?'':'disabled'}></label><button class="music-primary" type="submit" ${canPreview?'':'disabled'}>${runtime.status==='loading'?'Running…':'Run Provider'}</button></form><p class="music-partial-edit-provider-status is-${escapeHtml(runtime.status)}" role="status" aria-live="polite">${escapeHtml(providerStatus)}</p><div class="music-partial-edit-actions"><button class="music-primary" onclick="MusicStudio.editorStartPartialEdit()" ${active?'disabled':''}>Start Edit（編集開始）</button><button class="music-secondary" onclick="MusicStudio.editorPreviewPartialEditPitchUp()" ${canPreview?'':'disabled'}>Pitch +1 Preview（Local）</button><button class="music-primary" onclick="MusicStudio.editorApplyPartialEdit()" ${canApply?'':'disabled'}>Apply（採用）</button><button class="music-secondary" onclick="MusicStudio.editorCancelPartialEdit()" ${active?'':'disabled'}>Cancel / Preview破棄</button></div><dl class="music-partial-edit-summary" aria-label="Partial Edit summary"><div><dt>Updated（更新）</dt><dd>${summary.updated}</dd></div><div><dt>Added（追加）</dt><dd>${summary.added}</dd></div><div><dt>Deleted（削除）</dt><dd>${summary.deleted}</dd></div><div><dt>Unchanged（変更なし）</dt><dd>${summary.unchanged}</dd></div></dl><p class="music-assist-description">ProviderとLocal Previewは既存の安全境界を共有します。Apply前はProjectを変更しません。</p></div></section>`
  }
  let noteLengthPresets='';
  function editorBottomBarMarkup(session,track,selectionCount){
    const editableSelectionCount=root.MusicStudioEditor.editableNotes(editorSelectedNotes(session)).length;noteLengthPresets=['1/1','1/2','1/4','1/8','1/16','1/32'].map(value=>`<button class="music-secondary" onclick="MusicStudio.editorSetSelectedNoteLength('${value}')" ${editableSelectionCount?'':'disabled'}>${value}</button>`).join('');
    const loop=editorLoop(session),transport=editorTransportSettings(session),transportActive=state.midiInput.countingIn||state.midiInput.recording||state.melodyAudio.playing||state.melodyAudio.starting,midiReady=state.midiInput.supported!==false&&state.midiInput.inputs.length>0,melody=session.part==='melody',hasPlaybackNotes=editorActivePlaybackTracks(session).some(item=>item.notes.length),playback=`<div class="music-transport-main"><button class="music-secondary" onclick="MusicStudio.editorToggleMidiRecording()" ${midiReady?'aria-disabled="false"':'disabled aria-disabled="true"'} aria-pressed="${state.midiInput.countingIn||state.midiInput.recording}"><span class="music-record-dot" aria-hidden="true">●</span> Record（録音）</button><button class="music-primary" onclick="MusicStudio.editorToggleMelodyPlayback()" ${hasPlaybackNotes&&!state.midiInput.recording&&!state.midiInput.countingIn?'':'disabled'} aria-pressed="${state.melodyAudio.playing||state.melodyAudio.starting}">▶ Play（再生）</button><button class="music-secondary" onclick="MusicStudio.editorStopTransport()" ${transportActive?'':'disabled'}>■ Stop（停止）</button>${melody?`<button class="${loop.enabled?'music-primary':'music-secondary'} music-loop-toggle" onclick="MusicStudio.editorToggleLoop()" aria-pressed="${loop.enabled}">Loop ${loop.enabled?'ON（ループON）':'OFF（ループOFF）'}</button><button class="music-secondary" onclick="MusicStudio.editorClearLoop()" ${loop.specified?'':'disabled'}>Clear Loop（ループ解除）</button>`:''}</div><div class="music-count-in-group"><div class="music-count-in-options"><button class="${transport.countInEnabled?'music-primary':'music-secondary'}" onclick="MusicStudio.editorToggleCountIn()" aria-pressed="${transport.countInEnabled}" ${transportActive?'disabled':''}>Count-in ${transport.countInEnabled?'ON':'OFF'}</button><span>1 Bar（1小節）</span></div>${countInBeatDisplay(session)}</div><div class="music-metronome-group"><button class="${transport.metronomeEnabled?'music-primary':'music-secondary'}" onclick="MusicStudio.editorToggleMetronome()" aria-pressed="${transport.metronomeEnabled}" ${transportActive?'disabled':''}>Metronome ${transport.metronomeEnabled?'ON':'OFF'}</button></div>`;
    const zoom=Math.max(1,Math.min(30,Number(session.view?.zoom)||1)),snap=editorSnapValue(session),snapEnabled=editorSnapEnabled(session),snapOptions=[['measure','1小節'],['1/2','1/2'],['1/4','1/4'],['1/8','1/8'],['1/16','1/16'],['1/32','1/32']].map(([value,label])=>`<option value="${value}" ${snap===value?'selected':''}>${label}</option>`).join(''),quantizeEnabled=session.view?.quantizeEnabled===true,quantize=QUANTIZE_VALUES.includes(session.view?.quantize)?session.view.quantize:'1/16',quantizeOptions=QUANTIZE_VALUES.map(value=>`<option value="${value}" ${quantize===value?'selected':''}>${value}</option>`).join('');
    return`<div class="music-editor-bottom" aria-label="エディター下部ツール"><section><h2>編集ツール</h2><div class="music-edit-tool-groups"><div class="music-edit-tool-group music-edit-mode-group"><button class="music-secondary" onclick="MusicStudio.editorToggleMultiSelect(this)" aria-pressed="${Boolean(state.midiMultiSelect)}">Select（選択）：${state.midiMultiSelect?'複数':'単一'}</button><button class="music-primary" onclick="MusicStudio.editorAddNote()">Add Note（ノート追加）</button><button class="music-secondary" onclick="MusicStudio.editorDeleteNote()" ${selectionCount?'':'disabled'}>Eraser（消しゴム）</button></div><div class="music-edit-tool-group music-lock-group"><!--music-lock-controls--></div><div class="music-edit-tool-group music-clipboard-group"><button class="music-secondary" onclick="MusicStudio.editorCopy()" ${selectionCount?'':'disabled'}>Copy（コピー）</button><button class="music-secondary" onclick="MusicStudio.editorPaste()" ${session.clipboard.length?'':'disabled'}>Paste（貼り付け）</button><button class="music-secondary" onclick="MusicStudio.editorDuplicate()" ${selectionCount?'':'disabled'}>Duplicate（複製）</button></div><div class="music-edit-tool-group music-selection-group"><button class="music-secondary" onclick="MusicStudio.editorSelectAllNotes()" ${track.notes.length?'':'disabled'}>Select All（全選択）</button></div><div class="music-edit-tool-group music-note-length-group"><button class="music-secondary" onclick="MusicStudio.editorMatchDuration()" ${selectionCount>1?'':'disabled'}>Match Length（長さを揃える）</button><!--music-note-length-controls--></div><div class="music-edit-tool-group music-velocity-group"><button class="music-secondary" onclick="MusicStudio.editorMatchVelocity()" ${selectionCount>1?'':'disabled'}>Match Velocity（Velocityを揃える）</button></div></div></section><section class="music-display-assist"><h2>表示・編集補助</h2><div class="music-assist-layout"><div class="music-assist-block music-assist-snap"><div class="music-assist-snap-controls"><button class="${snapEnabled?'music-primary':'music-secondary'}" onclick="MusicStudio.editorToggleSnap()" aria-pressed="${snapEnabled}">Snap ${snapEnabled?'ON（スナップON）':'OFF（スナップOFF）'}</button><label><span>グリッド</span><select onchange="MusicStudio.editorSetSnap(this.value)" ${snapEnabled?'':'disabled'}>${snapOptions}</select></label></div><p class="music-assist-description">ノート位置・長さをGridへ合わせます<span>｜4/4目安：1/4＝1拍、1/8＝1/2拍、1/16＝1/4拍、1/32＝1/8拍</span></p></div><div class="music-assist-block music-assist-quantize"><div class="music-assist-quantize-controls"><button class="${quantizeEnabled?'music-primary':'music-secondary'}" onclick="MusicStudio.editorToggleQuantize()" aria-pressed="${quantizeEnabled}">Quantize ${quantizeEnabled?'ON':'OFF'}</button><label><span>補正グリッド</span><select onchange="MusicStudio.editorSetQuantize(this.value)">${quantizeOptions}</select></label><button class="music-secondary" onclick="MusicStudio.editorApplyQuantize()" ${quantizeEnabled?'':'disabled'}>適用</button></div><p class="music-assist-description">選択ノートの開始位置を最寄りGridへ補正。<span>Snap＝手動編集、Quantize＝録音済み／既存ノートの後補正。</span></p></div><div class="music-assist-block music-assist-zoom"><button class="music-secondary" onclick="MusicStudio.editorZoom(1)" ${zoom>=30?'disabled':''}>＋ Zoom（ズーム）</button><b class="music-assist-zoom-value">時間軸 Zoom：${zoom}x</b><button class="music-secondary" onclick="MusicStudio.editorZoom(-1)" ${zoom<=1?'disabled':''}>− Zoom（ズーム）</button></div><div class="music-assist-range-grid"><div class="music-assist-card"><button class="music-secondary" onclick="MusicStudio.editorFitPitchRange()">↕ Fit Range（音域を表示）</button><p class="music-assist-description">使用音域を画面内に収めます。</p></div><div class="music-assist-card"><div class="music-measure-length-controls"><button class="music-secondary" onclick="MusicStudio.editorAddMeasures()">＋ Add Measure（小節を追加）</button><button class="music-secondary" onclick="MusicStudio.editorRemoveMeasures()" title="曲末尾の空の1小節を削除" aria-label="Remove Measure（1小節削除）">− Remove Measure（小節削除）</button></div><p class="music-assist-description">末尾へ4小節追加／空の末尾1小節を削除します。</p></div></div></div></section><section><h2>再生</h2><div class="music-transport-controls">${playback||'<p>Melodyパートで再生できます。</p>'}</div></section></div>`;
  }
  function editorBottomBar(session,track,selectionCount){const markup=editorBottomBarMarkup(session,track,selectionCount),selected=editorSelectedNotes(session),lockedCount=selected.filter(note=>root.MusicStudioEditor.isNoteLocked(note)).length,unlockedCount=selected.length-lockedCount,controls=`<button class="music-secondary" onclick="MusicStudio.editorLockSelectedNotes()" ${unlockedCount?'':'disabled'} title="選択ノートを編集から保護">🔒 Lock（固定）</button><button class="music-secondary" onclick="MusicStudio.editorUnlockSelectedNotes()" ${lockedCount?'':'disabled'} title="選択ノートの編集保護を解除">🔓 Unlock（固定解除）</button>`,lengthControls=`<span class="music-note-length-label">Note Length（音符の長さ）</span>${noteLengthPresets}`,range=root.MusicStudioEditor.normalizeEditRange(session.editRange,session.midiData.editor.measureCount),rangeNotes=root.MusicStudioEditor.notesInRange(session,range),editableRangeNotes=root.MusicStudioEditor.editableNotesInRange(session,range),rangeControls=`<section class="music-edit-range" aria-label="編集対象の小節"><h2>編集対象の小節</h2><div class="music-edit-range-content"><div class="music-edit-range-fields"><label><span>開始小節</span><input type="number" min="1" max="${session.midiData.editor.measureCount}" step="1" value="${range.startMeasure}" aria-label="編集対象の開始小節" onchange="MusicStudio.editorSetEditRange(this.value,null)"></label><label><span>終了小節</span><input type="number" min="1" max="${session.midiData.editor.measureCount}" step="1" value="${range.endMeasure}" aria-label="編集対象の終了小節" onchange="MusicStudio.editorSetEditRange(null,this.value)"></label></div><p>Edit Range: Measure ${range.startMeasure}–${range.endMeasure}｜${session.part} ${rangeNotes.length}ノート（編集可能 ${editableRangeNotes.length}）</p></div></section>${partialEditControls()}`;return markup.replace('<!--music-lock-controls-->',controls).replace('<!--music-note-length-controls-->',lengthControls).replace('<section><h2>再生</h2>',`${rangeControls}<section><h2>再生</h2>`)}
  function externalAssignmentDraft(session){const tracks=root.MusicStudioEditor.externalReviewTracks(session?.midiData||{});if(!state.externalTrackAssignmentDraft||state.externalTrackAssignmentDraft.projectId!==session?.projectId)state.externalTrackAssignmentDraft={projectId:session?.projectId||'',assignments:Object.fromEntries(tracks.map(track=>[track.id,track.roleAssignment]))};return state.externalTrackAssignmentDraft}
  function externalTrackReviewHtml(session){const core=root.MusicStudioEditor,tracks=core.externalReviewTracks(session?.midiData||{});if(!tracks.length)return'';const draft=externalAssignmentDraft(session),labels={unassigned:'Unassigned',melody:'Melody',drums:'Drums',bass:'Bass'},rows=tracks.map(track=>`<div class="music-external-track-row" data-track-id="${escapeHtml(track.id)}"><div class="music-external-track-summary"><b>${escapeHtml(track.name)}</b><span>ID ${escapeHtml(track.id)}</span><span>Channel ${escapeHtml(track.channel??'—')}</span>${track.program==null?'':`<span>Program ${track.program}</span>`}<span>${track.noteCount} notes</span><span>Current: ${escapeHtml(track.roleAssignment)}</span></div><label>Assignment（割付）<select aria-label="${escapeHtml(track.name)} assignment" onchange="MusicStudio.editorDraftExternalTrackAssignment(this.closest('[data-track-id]').dataset.trackId,this.value)">${core.EXTERNAL_TRACK_ROLES.map(role=>`<option value="${role}" ${draft.assignments[track.id]===role?'selected':''}>${labels[role]}</option>`).join('')}</select></label></div>`).join('');return`<dialog class="music-editor-popover music-external-track-review" id="externalTrackReviewDialog" aria-labelledby="externalTrackReviewTitle"><header class="music-external-track-review-head"><div><b id="externalTrackReviewTitle">External Track Review / Assignment（外部トラック確認・割付）</b><span>${tracks.length} Tracks · manual only</span></div><button class="music-secondary" type="button" onclick="MusicStudio.editorCancelExternalTrackAssignments()" aria-label="External Track Reviewを閉じる">× Close（閉じる）</button></header><div class="music-external-track-review-body"><p>Track IDと演奏データを維持したままAssignment metadataだけを変更します。固定Trackへの転記や自動分類は行いません。</p><div class="music-external-track-list">${rows}</div><div class="music-external-track-actions"><button class="music-primary" type="button" onclick="MusicStudio.editorApplyExternalTrackAssignments()">Apply Assignment（割付を採用）</button><button class="music-secondary" type="button" onclick="MusicStudio.editorCancelExternalTrackAssignments()">Cancel（取消）</button></div></div></dialog>`}
  function editorDraftExternalTrackAssignment(trackId,role){const session=state.midiEditor,draft=externalAssignmentDraft(session),validation=root.MusicStudioEditor.validateExternalTrackAssignments(session?.midiData||{},{...draft.assignments,[trackId]:role});draft.assignments[trackId]=role;if(!validation.ok&&validation.errors.includes('duplicate-role'))notice('同じAssignmentへ複数のexternal Trackは割り当てられません。Apply前に選択を変更してください。','error');return validation}
  function editorCancelExternalTrackAssignments(){state.externalTrackAssignmentDraft=null;notice('Assignment変更をキャンセルしました。Projectは変更していません。','info');repaintEditor();return{cancelled:true}}
  async function editorApplyExternalTrackAssignments(){const session=state.midiEditor,core=root.MusicStudioEditor;if(!session)return{ok:false};const draft=externalAssignmentDraft(session),result=core.applyExternalTrackAssignments(session,draft.assignments);if(!result.applied){notice(`Assignmentを適用できません：${result.errors.includes('duplicate-role')?'同じroleへの重複割当があります。':'入力が不正です。'} Trackは変更していません。`,'error');repaintEditor();return{ok:false,...result}}const saved=await saveMidiEditor({silent:true});if(!saved.ok){notice('Assignmentを保存できませんでした。既存Trackとnoteは削除していません。','error');repaintEditor();return{ok:false,saveFailed:true}}state.externalTrackAssignmentDraft=null;notice(`${result.changed}件のAssignmentを保存しました。Track IDとnoteは維持しています。`,'success');repaintEditor();return{ok:true,...result}}
  function midiEditorView(id){
    const project=editorProject(id),core=root.MusicStudioEditor;if(!id)return `<main class="music-studio-shell music-project-page">${backButton()}<div class="music-empty"><h1>MIDIエディターを開けません</h1><p>プロジェクトIDが空です。</p></div></main>`;if(!project)return `<main class="music-studio-shell music-project-page">${backButton()}<div class="music-empty"><h1>MIDIエディターを開けません</h1><p>対象のMusic Studioプロジェクトが見つかりません。</p><button class="music-primary" onclick="MusicStudio.goProjects()">プロジェクトを選ぶ</button></div></main>`;if(!core)return `<main class="music-studio-shell music-project-page">${backButton()}<div class="music-empty"><h1>MIDIエディターを開けません</h1><p>編集モジュールを読み込めませんでした。ページを再読み込みしてください。</p></div></main>`;let session;try{session=ensureEditor(id)}catch(error){console.error('Music Studio editor session could not be created',error);return `<main class="music-studio-shell music-project-page">${backButton()}<div class="music-empty"><h1>MIDIエディターを開けません</h1><p>プロジェクトの編集セッション生成中にエラーが発生しました。</p></div></main>`}if(!session)return `<main class="music-studio-shell music-project-page">${backButton()}<div class="music-empty"><h1>MIDIエディターを開けません</h1><p>プロジェクトの編集セッションを開始できませんでした。</p></div></main>`;
    const track=core.currentTrack(session),selectionCount=editorSelectedNotes(session).length;
    const soloByTrackId=state.melodyAudio.playbackState.soloByTrackId||{},playbackTracks=editorPlaybackTracks(session),partButtons=Object.values(core.PARTS).map(part=>{const item=playbackTracks.find(track=>track.part===part.id),muted=item?.muted===true,solo=item?soloByTrackId[item.id]===true:false,trackId=escapeHtml(item?.id||part.id);return`<div class="music-part-tab-group" data-track-id="${trackId}"><button class="music-part-tab ${session.part===part.id?'music-primary':'music-secondary'}" onclick="MusicStudio.editorSelectPart('${part.id}')" aria-pressed="${session.part===part.id}">${part.name}</button><button class="${muted?'music-primary':'music-secondary'}" onclick="MusicStudio.editorSetTrackMuted('${trackId}',${!muted})" aria-pressed="${muted}" aria-label="${escapeHtml(part.name)} Mute">M</button><button class="${solo?'music-primary':'music-secondary'}" onclick="MusicStudio.editorSetTrackSolo('${trackId}',${!solo})" aria-pressed="${solo}" aria-label="${escapeHtml(part.name)} Solo">S</button></div>`}).join('');
    const undoIcon='<svg class="music-history-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h8.5a6 6 0 0 1 6 6"/></svg>',redoIcon='<svg class="music-history-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 7 4.5 4.5L15 16"/><path d="M19 11.5h-8.5a6 6 0 0 0-6 6"/></svg>';
    const historyControls=`<div class="music-history-controls" aria-label="編集履歴"><button class="music-secondary" onclick="MusicStudio.editorUndo()" ${session.undo.length?'':'disabled'} title="元に戻す" aria-label="元に戻す">${undoIcon}<span>戻る</span></button><button class="music-secondary" onclick="MusicStudio.editorRedo()" ${session.redo.length?'':'disabled'} title="やり直す" aria-label="やり直す">${redoIcon}<span>進む</span></button></div>`;
    const aiPanel=root.MusicStudioAIAssistantPanel?.render?.(project,session,core)||'';
    return`<main class="music-studio-shell music-midi-editor-page${currentRoute().startsWith(HOME_ROUTE+'/ai-editor/')?' music-ai-focused':''}" aria-labelledby="midiEditorTitle"><button class="music-secondary music-back" onclick="MusicStudio.openProject('${escapeHtml(id)}')">← Back（プロジェクトへ戻る）</button>${noticeView()}<header class="music-editor-heading"><h1 id="midiEditorTitle">${escapeHtml(core.PARTS[session.part].name)}制作</h1></header>${editorTopBar(project,session)}${externalTrackReviewHtml(session)}<nav class="music-part-tabs" aria-label="MIDIパート切替"><div class="music-part-tab-list">${partButtons}</div>${historyControls}</nav><div class="music-editor-layout">${editorTimeline(session)}</div>${aiPanel}${localizedEditorButtons(editorBottomBar(session,track,selectionCount))}</main>`;
  }
  function signatureLabel(signature){return`${signature.numerator}/${signature.denominator}`}
  function repaintEditor(options={}){
    const view=state.midiEditor?.view,viewport=root.document?.querySelector?.('.music-piano-viewport'),pianoScroll=root.document?.querySelector?.('.music-piano-scroll'),menu=root.document?.querySelector?.('.music-correction-menu'),popover=menu?.querySelector?.('.music-correction-popover'),cleanupMenu=root.document?.querySelector?.('.music-cleanup-menu'),scopedMenu=root.document?.querySelector?.('.music-scoped-repair-menu');
    const pageX=Number(root.scrollX??root.pageXOffset)||0,pageY=Number(root.scrollY??root.pageYOffset)||0;
    if(view){
      if(viewport)view.pitchScrollTop=viewport.scrollTop;if(pianoScroll)view.pitchScrollLeft=pianoScroll.scrollLeft;
      if(menu)view.correctionMenuOpen=menu.open;
      if(cleanupMenu&&!options.preserveCleanupMenu)view.generatedCleanupMenuOpen=cleanupMenu.open;
       if(scopedMenu&&!options.preserveScopedRepairMenu)view.scopedMidiRepairMenuOpen=scopedMenu.open;
      if(popover)view.correctionPopoverScrollTop=popover.scrollTop;
    }
    requestPaint();
    if(typeof root.scrollTo==='function'){try{root.scrollTo({left:pageX,top:pageY,behavior:'instant'})}catch(_){root.scrollTo(pageX,pageY)}}
    restoreEditorPitchScroll();
    if(viewport||menu||cleanupMenu)root.requestAnimationFrame?.(()=>{if(typeof root.scrollTo==='function'){try{root.scrollTo({left:pageX,top:pageY,behavior:'instant'})}catch(_){root.scrollTo(pageX,pageY)}}fitCorrectionPopover()});
  }
  function editorCloseCorrectionPanel(){
    const menu=root.document?.querySelector?.('.music-correction-menu'),view=state.midiEditor?.view;
    if(menu)menu.open=false;
    if(view){view.correctionMenuOpen=false;view.correctionPopoverScrollTop=0}
    return true;
  }
  function editorClosePopup(button){
    const menu=button?.closest?.('.music-editor-menu');if(!menu)return false;
    menu.open=false;editorHandlePopupToggle(menu);
    const summary=menu.querySelector?.(':scope > summary');summary?.focus?.({preventScroll:true});
    const saved=capturePaintFocus();
    // Classes are shared by different menus. Resolve the same summary identity
    // after repaint, and never take focus from a newer user interaction.
    root.requestAnimationFrame?.(()=>{
      const active=root.document?.activeElement;
      if(saved&&saved.route===currentRoute()&&(active===summary||active===root.document?.body))restorePaintFocus(saved);
    });
    return true
  }
  function midiEditorHasPendingChanges(){return Boolean(state.midiEditor&&(state.midiEditor.dirty||root.MusicStudioEditor?.projectSectionsPending?.(state.midiEditor)||root.MusicStudioAIAssistantPanel?.hasPending?.(state.midiEditor.projectId)))}
  function scheduleMidiEditorSave(delay=0){if(state.midiEditorSaveTimer)root.clearTimeout?.(state.midiEditorSaveTimer);state.midiEditorSaveTimer=null;if(!midiEditorHasPendingChanges()){state.midiEditorSaveRequested=false;return Promise.resolve({ok:true,skipped:true})}state.midiEditorSaveRequested=true;if(delay>0){state.midiEditorSaveTimer=root.setTimeout?.(()=>{state.midiEditorSaveTimer=null;return runMidiEditorAutosave()},delay)||null;return Promise.resolve({ok:true,scheduled:true})}return runMidiEditorAutosave()}
  function flushMidiEditorAutosave(){if(state.midiEditorSaveTimer)root.clearTimeout?.(state.midiEditorSaveTimer);state.midiEditorSaveTimer=null;return runMidiEditorAutosave()}
  function persistEditorView(delay=0){const session=state.midiEditor,view=session?.view;if(!session||!view)return Promise.resolve({ok:true,skipped:true});if(session.coordinatedTimeline&&!session.viewInteractionStarted&&!session.dirty)return Promise.resolve({ok:true,skipped:true});session.midiData.editor||(session.midiData.editor={});session.midiData.editor.view={zoom:Math.max(1,Math.min(30,Number(view.zoom)||1)),pitchMin:view.pitchMin==null?null:Math.max(0,Math.min(126,Math.round(Number(view.pitchMin)))),pitchMax:view.pitchMax==null?null:Math.max(1,Math.min(127,Math.round(Number(view.pitchMax)))),pitchScrollTop:view.pitchScrollTop==null?null:Math.max(0,Number(view.pitchScrollTop)||0),pitchScrollLeft:Math.max(0,Number(view.pitchScrollLeft)||0),snapEnabled:view.snapEnabled!==false,snap:SNAP_VALUES.includes(view.snap)?view.snap:'1/16',quantizeEnabled:view.quantizeEnabled===true,quantize:QUANTIZE_VALUES.includes(view.quantize)?view.quantize:'1/16'};session.dirty=JSON.stringify(session.midiData)!==JSON.stringify(session.savedMidiData);if(state.midiEditorViewSaveTimer)root.clearTimeout?.(state.midiEditorViewSaveTimer);state.midiEditorViewSaveTimer=null;if(delay>0){state.midiEditorViewSaveTimer=root.setTimeout?.(()=>{state.midiEditorViewSaveTimer=null;scheduleMidiEditorSave()},delay)||null;return Promise.resolve({ok:true,scheduled:true})}return scheduleMidiEditorSave()}
  async function runMidiEditorAutosave(){const session=state.midiEditor;if(!midiEditorHasPendingChanges()){state.midiEditorSaveRequested=false;return{ok:true,skipped:true}}if(state.midiEditorSaveInFlight)return{ok:true,deferred:true};state.midiEditorSaveInFlight=true;state.midiEditorSaveRequested=false;const saving=saveMidiEditor({silent:true});state.midiEditorSavePromise=saving;const result=await saving;if(state.midiEditorSavePromise===saving)state.midiEditorSavePromise=null;state.midiEditorSaveInFlight=false;if(state.midiEditor===session){if(midiEditorHasPendingChanges()&&(state.midiEditorSaveRequested||result.stale))scheduleMidiEditorSave();repaintEditor()}return result}
  function resetAddNoteSequence(session=state.midiEditor){state.midiAddNoteSequence={session,part:session?.part||'',noteIds:[]}}
  function addNoteSequenceAnchor(session){const sequence=state.midiAddNoteSequence;if(sequence.session!==session||sequence.part!==session.part)return null;const notes=new Map((root.MusicStudioEditor.currentTrack(session)?.notes||[]).map(note=>[note.id,note]));for(let index=sequence.noteIds.length-1;index>=0;index--){const note=notes.get(sequence.noteIds[index]);if(note){sequence.noteIds=sequence.noteIds.slice(0,index+1);return note}}sequence.noteIds=[];return null}
  function editorSelectPart(part){const before=root.MusicStudioEditor.currentTrackId(state.midiEditor);if(state.midiEditor?.part!==part){const synth=state.melodyAudio.synth;for(const [pitch,timer] of pitchPreviewTimers){if(timer!=null)root.clearTimeout?.(timer);synth?.noteOff?.(pitch,'piano-roll-preview')}pitchPreviewTimers.clear();synth?.stopPreview?.()}root.MusicStudioEditor.selectPart(state.midiEditor,part);if(root.MusicStudioEditor.currentTrackId(state.midiEditor)!==before)state.partialEditSession=null;editorSelectMidiTarget(part);resetAddNoteSequence();state.midiMultiSelect=false;if(state.midiEditor?.view){state.midiEditor.view.pitchMin=null;state.midiEditor.view.pitchMax=null;state.midiEditor.view.pitchScrollTop=null}requestPaint()}
  function editorSetBpm(value){const session=state.midiEditor,bpm=Number(value);if(!session||!Number.isFinite(bpm)||bpm<20||bpm>400){notice('BPMは20〜400で入力してください。','error');repaintEditor();return{ok:false,reason:'invalid-bpm'}}const tempoMap=normalizeProjectTempoMap(session.midiData.tempoMap,bpm),changed=Number(session.midiData.tempo)!==bpm||JSON.stringify(tempoMap)!==JSON.stringify(session.midiData.tempoMap);if(!changed)return{ok:true,changed:false,bpm};session.midiData.tempo=bpm;session.midiData.tempoMap=tempoMap;root.MusicStudioEditor.updateDirty(session);state.projects=state.projects.map(project=>project.projectId===session.projectId?{...project,musicalSettings:{...project.musicalSettings,bpm},midiData:{...clone(project.midiData||{}),tempo:bpm,tempoMap:clone(tempoMap)}}:project);scheduleMidiEditorSave();repaintEditor();return{ok:true,changed:true,bpm}}
  function tempoChangeInput(source){const session=state.midiEditor,measure=Number(source?.querySelector?.('[name="tempoChangeMeasure"]')?.value??session?.tempoChangeDraft?.measure),bpm=Number(source?.querySelector?.('[name="tempoChangeBpm"]')?.value??session?.tempoChangeDraft?.bpm);return{measure,bpm}}
  function validateTempoChange(input){const session=state.midiEditor,max=Number(session?.midiData?.editor?.measureCount)||1;if(!session||!Number.isInteger(input.measure)||input.measure<2||input.measure>max)return{ok:false,reason:`開始小節は2〜${max}で入力してください。`};if(!Number.isFinite(input.bpm)||input.bpm<20||input.bpm>400)return{ok:false,reason:'BPMは20〜400で入力してください。'};const measureTicks=root.MusicStudioEditor.measureRangeToTicks({startMeasure:1,endMeasure:1},session.midiData).measureTicks;return{ok:true,...input,tick:session.coordinatedTimeline?root.MusicStudioEditor.measureStart(session,input.measure):(input.measure-1)*measureTicks}}
  function editorUpdateTempoChange(source){const session=state.midiEditor;if(!session)return{ok:false};session.tempoChangeDraft=tempoChangeInput(source);return{ok:true,...session.tempoChangeDraft}}
  function editorPreviewTempoChange(){const session=state.midiEditor,input=validateTempoChange(session?.tempoChangeDraft||{measure:2,bpm:session?.midiData?.tempo});if(!input.ok){notice(input.reason,'error');return input}session.tempoChangePreview={measure:input.measure,bpm:input.bpm,tick:input.tick};repaintEditor();return{ok:true,preview:clone(session.tempoChangePreview)}}
  function persistTempoMap(session,tempoMap){session.midiData.tempoMap=root.MusicStudioEditor.normalizeTempoMap(tempoMap,session.midiData.tempo);root.MusicStudioEditor.updateDirty(session);state.projects=state.projects.map(project=>project.projectId===session.projectId?{...project,midiData:{...clone(project.midiData||{}),tempo:session.midiData.tempo,tempoMap:clone(session.midiData.tempoMap)}}:project);scheduleMidiEditorSave();repaintEditor();return clone(session.midiData.tempoMap)}
  function editorApplyTempoChange(){const session=state.midiEditor,input=validateTempoChange(session?.tempoChangePreview||session?.tempoChangeDraft||{});if(!input.ok){notice(input.reason,'error');return input}session.tempoChangePreview=null;const tempoMap=persistTempoMap(session,[...(session.midiData.tempoMap||[]),{tick:input.tick,bpm:input.bpm,microsecondsPerQuarter:Math.round(60000000/input.bpm),track:0}]);return{ok:true,tempoMap}}
  function editorRemoveTempoChange(){const session=state.midiEditor,input=validateTempoChange(session?.tempoChangeDraft||{});if(!input.ok){notice(input.reason,'error');return input}const before=session.midiData.tempoMap||[];session.tempoChangePreview=null;const tempoMap=persistTempoMap(session,before.filter(item=>Number(item.tick)!==input.tick));return{ok:true,changed:tempoMap.length!==before.length,tempoMap}}
  function editorClearTempoChanges(){const session=state.midiEditor;if(!session)return{ok:false};const changed=(session.midiData.tempoMap||[]).some(item=>Number(item.tick)>0);session.tempoChangePreview=null;const tempoMap=persistTempoMap(session,[]);return{ok:true,changed,tempoMap}}
  function editorSetTrackMuted(trackId,muted){const session=state.midiEditor,editor=root.MusicStudioEditor;if(!session||!editor?.setTrackMuted)return false;editor.setTrackMuted(session,trackId,muted===true);scheduleMidiEditorSave();repaintEditor();return true}
  function editorSetTrackSolo(trackId,solo){const tracks=root.MusicStudioEditor?.createTrackRegistry?.(state.midiEditor?.midiData)?.tracks||state.midiEditor?.midiData?.tracks||[],track=tracks.find(item=>item.id===trackId)||tracks.find(item=>item.part===trackId);if(!track)return false;const current=state.melodyAudio.playbackState.soloByTrackId||{};state.melodyAudio.playbackState.soloByTrackId={...current,[track.id]:solo===true};repaintEditor();return true}
  function editorSelectNote(id,additive=false){root.MusicStudioEditor.selectNote(state.midiEditor,id,{toggle:additive||state.midiMultiSelect});repaintEditor()}
  function editorSyncDragSelection(deltaPitch=0){
    const session=state.midiEditor,core=root.MusicStudioEditor,document=root.document;if(!session||!core||!document)return[];const selectedIds=new Set(core.selectedIds(session)),shift=Math.round(Number(deltaPitch)||0),pitches=[...new Set((core.currentTrack(session)?.notes||[]).filter(note=>selectedIds.has(note.id)).map(note=>Math.max(0,Math.min(127,note.pitch+shift))))].sort((a,b)=>b-a),selectedPitches=new Set(pitches);
    document.querySelectorAll?.('.music-midi-note')?.forEach(note=>{const selected=selectedIds.has(note.dataset?.noteId);note.classList?.toggle?.('is-selected',selected);note.setAttribute?.('aria-pressed',String(selected))});
    document.querySelectorAll?.('.music-piano-key[data-pitch]')?.forEach(key=>key.classList?.toggle?.('is-selected-pitch',selectedPitches.has(Number(key.dataset?.pitch))));
    const layer=document.querySelector?.('.music-selected-pitch-layer');if(layer)layer.innerHTML=pitches.map(pitch=>`<span data-pitch="${pitch}" style="--pitch-y:${pianoPitchY(pitch)}px"></span>`).join('');return pitches
  }
  function editorToggleMultiSelect(button){state.midiMultiSelect=!state.midiMultiSelect;if(button){button.setAttribute('aria-pressed',String(state.midiMultiSelect));button.textContent=`複数選択：${state.midiMultiSelect?'ON':'OFF'}`}return state.midiMultiSelect}
  function editorSelectAllNotes(){root.MusicStudioEditor.selectAllNotes(state.midiEditor);repaintEditor()}
  function editorSetPlayheadPosition(event){if(event?.target?.closest?.('.music-midi-note'))return;const roll=event?.currentTarget,rect=roll?.getBoundingClientRect?.(),session=state.midiEditor;if(!roll||!rect||!session)return;const totalTicks=Number(roll.dataset.totalTicks)||1,step=editorSnapTicks(session),raw=(event.clientX-rect.left)/rect.width*totalTicks;if(state.melodyAudio.playing||state.melodyAudio.starting)editorStopMelody(false,false);resetAddNoteSequence(session);setEditorPlayhead(session,Math.max(0,Math.min(totalTicks,editorSnapAt(session,raw))));repaintEditor()}
  function editorStartPlayheadMove(event){if(event?.button!=null&&event.button!==0)return;event?.preventDefault?.();const ruler=event?.currentTarget,rect=ruler?.getBoundingClientRect?.(),session=state.midiEditor;if(!ruler||!rect||!session)return;const totalTicks=Number(ruler.dataset.totalTicks)||1,step=editorSnapTicks(session),move=pointer=>{const raw=(pointer.clientX-rect.left)/rect.width*totalTicks;setEditorPlayhead(session,Math.max(0,Math.min(totalTicks,editorSnapAt(session,raw))))};if(state.melodyAudio.playing||state.melodyAudio.starting)editorStopMelody(false,false);resetAddNoteSequence(session);move(event);ruler.setPointerCapture?.(event.pointerId);ruler.onpointermove=move;ruler.onpointerup=()=>{ruler.onpointermove=null;ruler.onpointerup=null;ruler.onpointercancel=null;repaintEditor()};ruler.onpointercancel=ruler.onpointerup}
  function editorStartLoopRange(event,requestedPart){
    if(state.midiInput.recording)return false;
    if(event?.button!=null&&event.button!==0)return;
    event?.preventDefault?.();event?.stopPropagation?.();
    const source=event?.currentTarget,ruler=source?.closest?.('.music-loop-ruler')||source,rect=ruler?.getBoundingClientRect?.(),session=state.midiEditor;
    if(!ruler||!rect||!session||!rect.width)return;
    const pointerId=event.pointerId,totalTicks=Number(ruler.dataset.totalTicks)||1,step=editorSnapTicks(session),snap=value=>Math.max(0,Math.min(totalTicks,editorSnapAt(session,value))),tick=pointer=>snap((pointer.clientX-rect.left)/rect.width*totalTicks),existing=editorLoop(session),part=requestedPart||event.target?.closest?.('[data-loop-part]')?.dataset?.loopPart||'create',anchor=tick(event),originalStart=existing.specified?existing.start:anchor,originalEnd=existing.specified?existing.end:anchor,originalLength=originalEnd-originalStart,originX=Number(event.clientX)||0,originY=Number(event.clientY)||0,clickThreshold=6;
    let start=part==='create'?anchor:originalStart,end=part==='create'?anchor:originalEnd,finished=false,dragged=false;
    const selection=()=>ruler.querySelector?.('.music-loop-selection'),draw=()=>{const element=selection();if(element){element.style.left=`${Math.min(start,end)/totalTicks*100}%`;element.style.width=`${Math.abs(end-start)/totalTicks*100}%`}};
    const move=pointer=>{if(pointer.pointerId!=null&&pointer.pointerId!==pointerId)return;const dx=(Number(pointer.clientX)||0)-originX,dy=(Number(pointer.clientY)||0)-originY;if(!dragged&&Math.hypot(dx,dy)<clickThreshold)return;dragged=true;const current=tick(pointer);if(part==='start')start=Math.min(current,originalEnd-step);else if(part==='end')end=Math.max(current,originalStart+step);else if(part==='move'){const nextStart=Math.max(0,Math.min(totalTicks-originalLength,originalStart+current-anchor));start=nextStart;end=nextStart+originalLength}else{start=Math.min(anchor,current);end=Math.max(anchor,current);if(end-start<step){if(current<anchor)start=Math.max(0,end-step);else end=Math.min(totalTicks,start+step)}}draw()};
    if(part==='create')ruler.insertAdjacentHTML?.('beforeend','<div class="music-loop-selection" data-loop-part="move" onpointerdown="MusicStudio.editorStartLoopRange(event,\'move\')"><button type="button" class="music-loop-handle is-start" data-loop-part="start" onpointerdown="MusicStudio.editorStartLoopRange(event,\'start\')" aria-label="ループ開始位置を調整"></button><span class="music-loop-selection-label"><span class="music-loop-label-full">Loop ON（ループ）</span><span class="music-loop-label-short">Loop（繰り返し）</span></span><button type="button" class="music-loop-handle is-end" data-loop-part="end" onpointerdown="MusicStudio.editorStartLoopRange(event,\'end\')" aria-label="ループ終了位置を調整"></button></div>');
    ruler.setPointerCapture?.(pointerId);
    const finish=(pointer,cancelled=false)=>{if(finished)return;finished=true;ruler.onpointermove=null;ruler.onpointerup=null;ruler.onpointercancel=null;ruler.onlostpointercapture=null;if(ruler.hasPointerCapture?.(pointerId))ruler.releasePointerCapture?.(pointerId);if(cancelled){repaintEditor();return}if(part==='move'&&!dragged){root.MusicStudioEditor.setLoopEnabled(session,!existing.enabled)}else if(part!=='start'&&part!=='end'||dragged){const from=Math.min(start,end),to=Math.max(start,end);root.MusicStudioEditor.setLoopRange(session,from,Math.max(from+step,to),part==='create'?true:existing.enabled)}scheduleMidiEditorSave();repaintEditor()};
    ruler.onpointermove=move;ruler.onpointerup=pointer=>finish(pointer,false);ruler.onpointercancel=pointer=>finish(pointer,true);ruler.onlostpointercapture=pointer=>finish(pointer,true)
  }
  function editorToggleLoop(){const session=state.midiEditor;if(!session)return false;const loop=editorLoop(session),timeline=editorTimelineTicks(session);if(!loop.specified){const step=editorSnapTicks(session),measure=session.coordinatedTimeline?root.MusicStudioEditor.position({startTick:Math.round(session.playheadTick||0)},session.midiData).measureEndTick-root.MusicStudioEditor.position({startTick:Math.round(session.playheadTick||0)},session.midiData).measureStartTick:timeline.measureTicks,start=Math.max(0,Math.min(timeline.totalTicks-measure,editorSnapAt(session,Number(session.playheadTick)||0)));root.MusicStudioEditor.setLoopRange(session,start,Math.min(timeline.totalTicks,start+measure),true)}else root.MusicStudioEditor.setLoopEnabled(session,!loop.enabled);scheduleMidiEditorSave();repaintEditor();return editorLoop(session).enabled}
  function editorClearLoop(){const session=state.midiEditor;if(!session)return false;if(state.melodyAudio.playing||state.melodyAudio.starting)editorStopMelody(false,false);root.MusicStudioEditor.setLoopRange(session,null,null,false);scheduleMidiEditorSave();repaintEditor();return true}
  function editorAddNote(){const session=state.midiEditor;if(!session)return false;const anchor=addNoteSequenceAnchor(session),gridTicks=editorGridTicks(session),playheadTick=Number(session.playheadTick),startTick=anchor?(session.coordinatedTimeline&&editorSnapValue(session)==='measure'?root.MusicStudioEditor.measureStart(session,root.MusicStudioEditor.position(anchor,session.midiData).measure+1):anchor.startTick+gridTicks):Number.isFinite(playheadTick)?Math.max(0,playheadTick):0;if(startTick>=editorConfiguredTimelineTicks(session)){notice('小節を追加してください。','info');return false}const input={startTick};if(anchor)input.pitch=anchor.pitch;if(editorSnapEnabled(session))input.durationTicks=session.coordinatedTimeline&&editorSnapValue(session)==='measure'?root.MusicStudioEditor.position({startTick},session.midiData).measureEndTick-startTick:gridTicks;const result=root.MusicStudioEditor.addNote(session,input);if(result?.ok===false){notice('保護範囲へのノート追加を中止しました。','info');return false}const noteId=session.selectedNoteId,sequence=state.midiAddNoteSequence;if(sequence.session!==session||sequence.part!==session.part)state.midiAddNoteSequence={session,part:session.part,noteIds:noteId?[noteId]:[]};else if(noteId)sequence.noteIds.push(noteId);scheduleMidiEditorSave();repaintEditor();return true}
  function editorDeleteNote(){const selected=editorSelectedNotes(state.midiEditor),count=root.MusicStudioEditor.editableNotes(selected).length;if(!count)return notice('Locked（固定）ノートは削除されません。Unlockしてから削除してください。','info');root.MusicStudioEditor.deleteSelected(state.midiEditor);scheduleMidiEditorSave();notice(`${count}ノートを削除しました。${selected.length>count?'Lockedノートは保持しました。':''} Undo（元に戻す）で復元できます。`,'success')}
  function editorLockSelectedNotes(){const notes=editorSelectedNotes(state.midiEditor),count=notes.filter(note=>!root.MusicStudioEditor.isNoteLocked(note)).length;if(!count)return false;root.MusicStudioEditor.lockSelectedNotes(state.midiEditor);scheduleMidiEditorSave();notice(`${count}ノートをLock（固定）しました。`,'success');repaintEditor();return true}
  function editorUnlockSelectedNotes(){const notes=editorSelectedNotes(state.midiEditor),count=notes.filter(note=>root.MusicStudioEditor.isNoteLocked(note)).length;if(!count)return false;root.MusicStudioEditor.unlockSelectedNotes(state.midiEditor);scheduleMidiEditorSave();notice(`${count}ノートのLockを解除しました。`,'success');repaintEditor();return true}
  function editorUndo(){const count=state.midiEditor.undo.length;root.MusicStudioEditor.undo(state.midiEditor);if(state.midiEditor.undo.length<count)root.MusicStudioAIAssistantPanel?.historyChanged?.(state.midiEditor.projectId);scheduleMidiEditorSave();repaintEditor()}
  function editorRedo(){const count=state.midiEditor.redo.length;root.MusicStudioEditor.redo(state.midiEditor);if(state.midiEditor.redo.length<count)root.MusicStudioAIAssistantPanel?.historyChanged?.(state.midiEditor.projectId);scheduleMidiEditorSave();repaintEditor()}
  function editorCopy(){root.MusicStudioEditor.copy(state.midiEditor);const count=state.midiEditor.clipboard.length;notice(`${count}ノートをコピーしました。Paste（貼り付け）を押してください。`,'success')}
  function editorPaste(){const count=state.midiEditor.clipboard.length;root.MusicStudioEditor.paste(state.midiEditor,state.midiEditor.playheadTick);scheduleMidiEditorSave();notice(`${count}ノートを再生ライン位置へ貼り付けました。Undo（元に戻す）が使えます。`,'success')}
  function editorDuplicate(){const count=editorSelectedNotes(state.midiEditor).length;root.MusicStudioEditor.duplicateSelected(state.midiEditor);scheduleMidiEditorSave();notice(`${count}ノートを直後へ複製しました。Undo（元に戻す）が使えます。`,'success')}
  function editorMoveSelected(deltaTick,deltaPitch){root.MusicStudioEditor.moveSelected(state.midiEditor,deltaTick,deltaPitch);scheduleMidiEditorSave();repaintEditor()}
  function editorResizeSelected(deltaDuration){root.MusicStudioEditor.resizeSelected(state.midiEditor,deltaDuration);scheduleMidiEditorSave();repaintEditor()}
  function editorSetSnap(value){if(!SNAP_VALUES.includes(value)||!state.midiEditor)return false;(state.midiEditor.view||(state.midiEditor.view={})).snap=value;persistEditorView();repaintEditor();return true}
  function editorSetEditRange(startMeasure,endMeasure){const session=state.midiEditor,core=root.MusicStudioEditor;if(!session)return false;const current=session.editRange||session.midiData.editor.editRange||{startMeasure:1,endMeasure:1},start=startMeasure==null?current.startMeasure:startMeasure,end=endMeasure==null?current.endMeasure:endMeasure,range=core.setEditRange(session,{startMeasure:startMeasure!=null&&Number(start)>Number(end)?start:startMeasure==null&&Number(end)<Number(start)?end:start,endMeasure:endMeasure!=null&&Number(end)<Number(start)?end:endMeasure==null&&Number(start)>Number(end)?start:end}),track=core.currentTrack(session),partial=state.partialEditSession,active=['created','result-ready','preview-ready'].includes(partial?.status);if(active&&!core.resolveCoreTrackRole(track)&&partial.request.trackId===track?.id&&core.resolveTrackCapabilities(track).supportsPartialEdit===true){state.partialEditSession=core.createPartialEditSession(core.createPartialEditRequest(session,{trackId:track.id,range}));resetPartialEditProviderRun()}scheduleMidiEditorSave();repaintEditor();return range}
  function editorToggleSnap(){if(!state.midiEditor)return false;const view=state.midiEditor.view||(state.midiEditor.view={});view.snapEnabled=view.snapEnabled===false;persistEditorView();repaintEditor();return view.snapEnabled}
  function editorSetQuantize(value){if(!QUANTIZE_VALUES.includes(value)||!state.midiEditor)return false;(state.midiEditor.view||(state.midiEditor.view={})).quantize=value;persistEditorView();repaintEditor();return true}
  function editorToggleQuantize(){if(!state.midiEditor)return false;const view=state.midiEditor.view||(state.midiEditor.view={});view.quantizeEnabled=view.quantizeEnabled!==true;persistEditorView();repaintEditor();return view.quantizeEnabled}
  function editorApplyQuantize(){const session=state.midiEditor;if(!session)return false;if(session.view?.quantizeEnabled!==true)return notice('QuantizeをONにしてください。','info');const context=root.MusicStudioEditor.createEditorContext(session),result=root.MusicStudioEditor.quantizeSelectedStarts(session,QUANTIZE_VALUES.includes(session.view.quantize)?session.view.quantize:'1/16',context);if(!result.ok)return notice(result.reason,'info');if(!result.changed)return notice(`${result.count}ノートはすでに${result.resolution}グリッド上です。`,'info');scheduleMidiEditorSave();notice(`${result.count}ノートの開始位置を${result.resolution}へQuantizeしました。Undo（元に戻す）が使えます。`,'success');return result}
  function editorResetZoom(){if(state.midiEditor?.view){state.midiEditor.view.zoom=1;persistEditorView();repaintEditor()}}
  function editorMatchDuration(){root.MusicStudioEditor.matchSelectedDuration(state.midiEditor);scheduleMidiEditorSave();repaintEditor()}
  function editorSetSelectedNoteLength(value){const result=root.MusicStudioEditor.setSelectedNoteLength(state.midiEditor,value);if(result.ok&&result.changed)scheduleMidiEditorSave();repaintEditor();return result}
  function editorMatchVelocity(value){root.MusicStudioEditor.matchSelectedVelocity(state.midiEditor,value);scheduleMidiEditorSave();repaintEditor()}
  function editorClearSelection(){root.MusicStudioEditor.clearNoteSelection(state.midiEditor);repaintEditor()}
  function editorZoom(direction){const view=state.midiEditor.view||(state.midiEditor.view={zoom:1,pitchMin:48,pitchMax:72});view.zoom=Math.max(1,Math.min(30,(Number(view.zoom)||1)+Number(direction)));persistEditorView();repaintEditor()}
  function editorAddMeasures(){root.MusicStudioEditor.extendTimelineMeasures(state.midiEditor,4);scheduleMidiEditorSave();repaintEditor()}
  function editorRemoveMeasures(){const result=root.MusicStudioEditor.removeTimelineMeasures(state.midiEditor,1);if(!result.ok)return notice(result.reason==='notes'?'削除する小節にノートがあります。':'これ以上小節を減らせません。','info');scheduleMidiEditorSave();notice('1小節削除しました。','success');return result}
  function editorFitPitchRange(){const notes=root.MusicStudioEditor.currentTrack(state.midiEditor)?.notes||[],view=state.midiEditor.view||(state.midiEditor.view={zoom:1});view.pitchMin=notes.length?Math.max(0,Math.min(...notes.map(note=>note.pitch))-3):48;view.pitchMax=notes.length?Math.min(127,Math.max(...notes.map(note=>note.pitch))+3):72;view.pitchScrollTop=null;persistEditorView();requestPaint()}
  function editorRememberPitchScroll(element,axis='both'){if(state.midiEditor?.coordinatedTimeline&&state.editorViewRestoring)return;if(state.midiEditor?.view&&element){const horizontal=axis==='horizontal'||element.classList?.contains?.('music-piano-scroll'),vertical=axis==='vertical'||element.classList?.contains?.('music-piano-viewport');if(horizontal||!vertical&&axis==='both')state.midiEditor.view.pitchScrollLeft=element.scrollLeft;if(vertical||!horizontal&&axis==='both')state.midiEditor.view.pitchScrollTop=element.scrollTop;persistEditorView(300)}}
  function editorHandleShortcut(event){
    if(event?.key==='Escape'&&!event.isComposing){const menu=event.target?.closest?.('.music-editor-menu[open]');if(menu){event.preventDefault?.();event.stopPropagation?.();return editorClosePopup(event.target)}}
    const session=state.midiEditor,rawTarget=event?.target,target=rawTarget?.nodeType===3?rawTarget.parentElement:rawTarget,inputFocused=target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');if(!session||!isMidiEditorRoute(currentRoute())||event?.isComposing||event?.repeat||inputFocused)return false;
    if(['Enter','Return',' ','Spacebar'].includes(event.key)&&target?.closest?.('button,summary,a[href]'))return false;
    const key=String(event.key||''),code=String(event.code||''),lower=key.toLowerCase(),meta=Boolean(event.metaKey),control=Boolean(event.ctrlKey),shift=Boolean(event.shiftKey),option=Boolean(event.altKey),selected=root.MusicStudioEditor.selectedIds(session).length,step=editorSnapTicks(session),space=code==='Space'||key===' '||key==='Spacebar',recordKey=code==='KeyR'||lower==='r',enterKey=code==='Enter'||code==='NumpadEnter'||key==='Enter'||key==='Return';let action=null;
    if(meta&&lower==='z')action=()=>shift?editorRedo():editorUndo();
    else if(meta&&lower==='c'&&selected)action=editorCopy;
    else if(meta&&lower==='v'&&session.clipboard.length)action=editorPaste;
    else if(meta&&lower==='d'&&selected)action=editorDuplicate;
    else if(meta&&lower==='a')action=editorSelectAllNotes;
    else if(meta&&(key==='+'||key==='='))action=()=>editorZoom(1);
    else if(meta&&key==='-')action=()=>editorZoom(-1);
    else if(meta&&key==='0')action=editorResetZoom;
    else if(!meta&&!option&&(key==='Delete'||key==='Backspace')&&selected)action=editorDeleteNote;
    else if(!meta&&!control&&!option&&!shift&&space)action=editorToggleMelodyPlayback;
    else if(!meta&&!option&&enterKey)action=()=>{setEditorPlayhead(session,0);repaintEditor()};
    else if(!meta&&option&&key==='ArrowLeft'&&selected)action=()=>editorResizeSelected(-step);
    else if(!meta&&option&&key==='ArrowRight'&&selected)action=()=>editorResizeSelected(step);
    else if(!meta&&!option&&key==='ArrowLeft'&&selected)action=()=>editorMoveSelected(-step,0);
    else if(!meta&&!option&&key==='ArrowRight'&&selected)action=()=>editorMoveSelected(step,0);
    else if(!meta&&!option&&key==='ArrowUp'&&selected)action=()=>editorMoveSelected(0,shift?12:1);
    else if(!meta&&!option&&key==='ArrowDown'&&selected)action=()=>editorMoveSelected(0,shift?-12:-1);
    else if(!meta&&!control&&!option&&!shift&&recordKey)action=editorToggleMidiRecording;
    else if(!meta&&!option&&!shift&&lower==='n')action=editorAddNote;
    else if(!meta&&!option&&key==='Escape'&&selected)action=editorClearSelection;
    else if(!meta&&!option&&!shift&&['1','2','3','4'].includes(key))action=()=>editorSetSnap({'1':'1/4','2':'1/8','3':'1/16','4':'1/32'}[key]);
    if(!action)return false;if(space)event.preventDefault?.();action();return true
  }
  function editorCloseMidiMenuOnOutsidePointer(event){const menu=root.document?.querySelector?.('.music-midi-input-menu[open]');if(menu&&!event?.target?.closest?.('.music-midi-input-menu'))menu.open=false}
  let shortcutListening=false;
  function dispatchEditorShortcut(event){return root.MusicStudio?.editorHandleShortcut?.(event)??editorHandleShortcut(event)}
  function syncShortcutListener(route=currentRoute()){const shouldListen=isMidiEditorRoute(route);if(shouldListen&&!shortcutListening){root.addEventListener?.('keydown',dispatchEditorShortcut,true);root.addEventListener?.('pointerdown',editorCloseMidiMenuOnOutsidePointer,true);shortcutListening=true}else if(!shouldListen&&shortcutListening){root.removeEventListener?.('keydown',dispatchEditorShortcut,true);root.removeEventListener?.('pointerdown',editorCloseMidiMenuOnOutsidePointer,true);shortcutListening=false}return shortcutListening}
  function editorStartNoteDrag(event,id){
    if(event?.button!=null&&event.button!==0)return;event?.preventDefault?.();const session=state.midiEditor,core=root.MusicStudioEditor,additive=Boolean(event?.shiftKey||event?.metaKey||event?.ctrlKey||state.midiMultiSelect),originalSelectedIds=[...core.selectedIds(session)],already=originalSelectedIds.includes(id);if(!already)core.selectNote(session,id,{toggle:additive});editorSyncDragSelection();
    const target=event.currentTarget,roll=target?.closest?.('.music-piano-roll'),rect=roll?.getBoundingClientRect?.();if(!target||!rect)return repaintEditor();const totalTicks=Number(roll.dataset.totalTicks)||1,pitchSpan=(Number(roll.dataset.pitchMax)||127)-(Number(roll.dataset.pitchMin)||0)+1,startX=event.clientX,startY=event.clientY,step=editorSnapTicks(session),dragElements=[...(roll.querySelectorAll?.('.music-midi-note.is-selected')||[])];if(!dragElements.includes(target))dragElements.push(target);let moved=false,lastTick=0,lastPitch=0,previewPitchDelta=null;
    target.setPointerCapture?.(event.pointerId);target.onpointermove=move=>{const dx=move.clientX-startX,dy=move.clientY-startY;lastTick=session.coordinatedTimeline?editorSnapAt(session,Number(core.currentTrack(session)?.notes.find(n=>n.id===id)?.startTick||0)+dx/rect.width*totalTicks)-Number(core.currentTrack(session)?.notes.find(n=>n.id===id)?.startTick||0):Math.round((dx/rect.width*totalTicks)/step)*step;lastPitch=Math.round(-dy/rect.height*pitchSpan);moved=moved||Math.abs(dx)>4||Math.abs(dy)>4;dragElements.forEach(element=>{element.style.translate=`${dx}px ${dy}px`});if(moved&&lastPitch!==previewPitchDelta){editorSyncDragSelection(lastPitch);previewPitchDelta=lastPitch}};
    const finish=(preview,cancelled=false)=>{target.onpointermove=null;target.onpointerup=null;target.onpointercancel=null;dragElements.forEach(element=>{element.style.translate=''});if(cancelled){core.clearNoteSelection(session);originalSelectedIds.forEach(noteId=>core.selectNote(session,noteId,{additive:true}));editorSyncDragSelection();return repaintEditor()}if(moved&&(lastTick||lastPitch)){core.moveSelected(session,lastTick,lastPitch);scheduleMidiEditorSave()}else if(!moved){if(additive&&already)core.selectNote(session,id,{toggle:true});else if(!additive&&core.selectedIds(session).length>1)core.selectNote(session,id);if(preview){const note=core.currentTrack(session)?.notes.find(item=>item.id===id);if(note)editorPreviewPitch(note.pitch,note.velocity)}}repaintEditor()};
    target.onpointerup=()=>finish(true);
    target.onpointercancel=()=>finish(false,true);
  }
  function editorStartMarqueeSelection(event){
    if(event?.target?.closest?.('.music-midi-note')||event?.button!=null&&event.button!==0)return;
    if(event?.pointerType==='touch'||root.matchMedia?.('(pointer: coarse)')?.matches)return editorSetPlayheadPosition(event);
    const roll=event?.currentTarget,rect=roll?.getBoundingClientRect?.(),session=state.midiEditor,core=root.MusicStudioEditor;if(!roll||!rect||!session||!core)return;
    const startX=event.clientX,startY=event.clientY,original=new Set(core.selectedIds(session)),shift=Boolean(event.shiftKey),toggle=Boolean(event.metaKey||event.ctrlKey),threshold=4;let active=false,marquee=null,lastEvent=event;
    const bounds=pointer=>{const x=Math.max(rect.left,Math.min(rect.right,pointer.clientX)),y=Math.max(rect.top,Math.min(rect.bottom,pointer.clientY));return{left:Math.min(startX,x),right:Math.max(startX,x),top:Math.min(startY,y),bottom:Math.max(startY,y)}};
    const move=pointer=>{lastEvent=pointer;const dx=pointer.clientX-startX,dy=pointer.clientY-startY;if(!active&&Math.max(Math.abs(dx),Math.abs(dy))<=threshold)return;if(!active){active=true;marquee=roll.ownerDocument?.createElement?.('div');if(marquee){marquee.className='music-selection-marquee';marquee.setAttribute?.('aria-hidden','true');roll.appendChild?.(marquee)}}pointer.preventDefault?.();const area=bounds(pointer);if(marquee){marquee.style.left=`${area.left-rect.left}px`;marquee.style.top=`${area.top-rect.top}px`;marquee.style.width=`${area.right-area.left}px`;marquee.style.height=`${area.bottom-area.top}px`}};
    const finish=(cancelled=false)=>{roll.onpointermove=null;roll.onpointerup=null;roll.onpointercancel=null;marquee?.remove?.();if(cancelled)return;if(!active){core.clearNoteSelection(session);editorSetPlayheadPosition({target:roll,currentTarget:roll,clientX:lastEvent.clientX});return}const area=bounds(lastEvent),hits=[...(roll.querySelectorAll?.('.music-midi-note')||[])].filter(note=>{const noteRect=note.getBoundingClientRect?.();return noteRect&&noteRect.right>=area.left&&noteRect.left<=area.right&&noteRect.bottom>=area.top&&noteRect.top<=area.bottom}).map(note=>note.dataset?.noteId).filter(Boolean),next=toggle?new Set(original):shift?new Set(original):new Set();for(const id of hits){if(toggle&&next.has(id))next.delete(id);else next.add(id)}core.clearNoteSelection(session);for(const id of next)core.selectNote(session,id,{additive:true});repaintEditor()};
    roll.setPointerCapture?.(event.pointerId);roll.onpointermove=move;roll.onpointerup=pointer=>{lastEvent=pointer;finish(false)};roll.onpointercancel=()=>finish(true);
  }
  function editorStartNoteResize(event,id){
    event?.preventDefault?.();event?.stopPropagation?.();const session=state.midiEditor,core=root.MusicStudioEditor;if(!core.selectedIds(session).includes(id))core.selectNote(session,id);const target=event.currentTarget,noteElement=target?.closest?.('.music-midi-note'),roll=target?.closest?.('.music-piano-roll'),rect=roll?.getBoundingClientRect?.();if(!target||!rect)return;const totalTicks=Number(roll.dataset.totalTicks)||1,startX=event.clientX,step=editorSnapTicks(session),originalWidth=noteElement?.style.width||'0px';let delta=0;
    target.setPointerCapture?.(event.pointerId);target.onpointermove=move=>{delta=session.coordinatedTimeline?editorSnapAt(session,Number(core.currentTrack(session)?.notes.find(n=>n.id===id)?.startTick||0)+Number(core.currentTrack(session)?.notes.find(n=>n.id===id)?.durationTicks||0)+(move.clientX-startX)/rect.width*totalTicks)-Number(core.currentTrack(session)?.notes.find(n=>n.id===id)?.startTick||0)-Number(core.currentTrack(session)?.notes.find(n=>n.id===id)?.durationTicks||0):Math.round(((move.clientX-startX)/rect.width*totalTicks)/step)*step;if(noteElement)noteElement.style.width=`max(18px, calc(${originalWidth} + ${move.clientX-startX}px))`};
    target.onpointerup=()=>{target.onpointermove=null;target.onpointerup=null;if(delta){core.resizeSelected(session,delta);scheduleMidiEditorSave()}repaintEditor()};target.onpointercancel=target.onpointerup;
  }
  function editorToggleMeasure(measure){root.MusicStudioEditor.toggleMeasure(state.midiEditor,measure);scheduleMidiEditorSave();repaintEditor()}
  function editorSelectMeasureRange(event){event?.preventDefault?.();const form=event?.target,from=Math.max(1,Number(form?.elements.from?.value)||1),to=Math.max(from,Number(form?.elements.to?.value)||from),measures=Array.from({length:to-from+1},(_,index)=>from+index);root.MusicStudioEditor.setSelectedMeasures(state.midiEditor,measures);scheduleMidiEditorSave();repaintEditor()}
  function editorToggleLock(){root.MusicStudioEditor.toggleLockSelected(state.midiEditor);scheduleMidiEditorSave();repaintEditor()}
  function editorPrepareRegeneration(){const result=root.MusicStudioEditor.prepareRegeneration(state.midiEditor,now());if(!result.ok)return notice(result.reason,'info');scheduleMidiEditorSave();notice(`再生成対象（小節 ${result.request.targetMeasures.join(', ')}）を準備しました。AI生成は未接続です。`,'info')}
  function melodySynth(){const audio=state.melodyAudio;if(!audio.synth&&root.MusicStudioAudio)audio.synth=root.MusicStudioAudio.createSynth({volume:.12});return prepareInstruments(audio.synth,editorProject(state.midiEditor?.projectId))}
  async function unlockMelodyAudio(){const synth=prepareInstruments(melodySynth(),editorProject(state.midiEditor?.projectId));if(!synth?.supported?.())return false;return synth.unlock()}
  function editorPianoInput(pitch){const duration=Number(root.document?.querySelector('#melodyInputDuration')?.value)||state.midiEditor.midiData.ppq,velocity=Number(root.document?.querySelector('#melodyInputVelocity')?.value)||100;synthPreview(pitch,velocity);root.MusicStudioEditor.addNote(state.midiEditor,{pitch,durationTicks:duration,velocity});scheduleMidiEditorSave();repaintEditor()}
  async function synthPreview(pitch,velocity){const synth=melodySynth();if(!synth?.supported?.())return false;const binding=root.MusicStudioEditor?.currentTrack(state.midiEditor)?.sampleInstrument;prepareInstruments(synth,editorProject(state.midiEditor?.projectId));const scheduled=binding?synth.previewInstrument(binding,pitch,velocity,.35):synth.previewNote(pitch,velocity,.35),unlocked=await synth.unlock();return Boolean(scheduled&&unlocked)}
  const pitchPreviewTimers=new Map();
  function editorTrackRoute(track){const role=root.MusicStudioEditor?.resolveCoreTrackRole?.(track)||null,audio=root.MusicStudioAudio?.resolveTrackAudio?.(track)||{mode:role||'melody',fallback:!role,reason:role?null:'missing-core-role'};return{track:track||null,trackId:track?.id||null,role,audio}}
  function editorCurrentTrackRoute(){return editorTrackRoute(root.MusicStudioEditor?.currentTrack?.(state.midiEditor))}
  function editorRecordingTrackRoute(){const midi=state.midiInput,editor=root.MusicStudioEditor,track=editor?.getTrackById?.(state.midiEditor?.midiData?.tracks,midi.recordingTrackId);if(track)return editorTrackRoute(track);const part=['melody','drums','bass'].includes(midi.recordingPart||midi.targetPart)?midi.recordingPart||midi.targetPart:'melody';return editorTrackRoute(state.midiEditor?.midiData?.tracks?.find(item=>item.part===part))}
  async function editorPreviewPitch(pitch,velocity=100){
    const synth=melodySynth(),note=Math.max(0,Math.min(127,Math.round(Number(pitch)||0))),level=Math.max(1,Math.min(127,Math.round(Number(velocity)||100))),channel='piano-roll-preview',mode=editorCurrentTrackRoute().audio.mode;if(!synth?.supported?.())return false;
    const unlocked=await synth.unlock();if(!unlocked)return false;
    const binding=root.MusicStudioEditor.currentTrack(state.midiEditor)?.sampleInstrument;if(binding){prepareInstruments(synth,editorProject(state.midiEditor?.projectId));return synth.previewInstrument(binding,note,level,.35)}if(mode!=='melody'&&synth.previewTrackNote)return synth.previewTrackNote(mode,note,level,.35);
    const previous=pitchPreviewTimers.get(note);if(previous!=null)root.clearTimeout?.(previous);pitchPreviewTimers.delete(note);synth.noteOff(note,channel);
    const started=synth.noteOn(note,level,channel),stop=()=>{synth.noteOff(note,channel);pitchPreviewTimers.delete(note)},timer=root.setTimeout?.(stop,350);if(timer!=null)pitchPreviewTimers.set(note,timer);
    return Boolean(started)
  }
  function editorPreviewPitchFromKey(event){const pitch=Number(event?.currentTarget?.dataset?.pitch);if(!Number.isInteger(pitch)||pitch<0||pitch>127)return false;return editorPreviewPitch(pitch)}
  function recordingNoteElement(id){return root.document?.querySelector?.(`.music-midi-editor-page .music-live-note-layer [data-recording-note-id="${id}"]`)}
  function updateLiveNoteWidths(time=midiClock()){const midi=state.midiInput,session=state.midiEditor;if(!midi.recording||!session)return;const nowTick=recordingTickAt(time),totalTicks=editorTimelineTicks(session).totalTicks;for(const note of midi.liveNotes){if(note.active)note.durationTicks=Math.max(1,nowTick-note.startTick);const element=recordingNoteElement(note.id);if(element){element.style.width=`${Math.max(note.durationTicks/totalTicks*100,.45)}%`;updateNoteLabelElement(element)}}}
  function liveRecordingNoteHtml(note,totalTicks=editorTimelineTicks(state.midiEditor).totalTicks){const left=note.startTick/totalTicks*100,width=Math.max(note.durationTicks/totalTicks*100,.45),part=editorRecordingTrackRoute().role||'melody',label=part==='drums'?drumNoteName(note.pitch):noteName(note.pitch);return`<span class="music-midi-note ${velocityClass(note.velocity)} is-recording${note.active?' is-held':' is-released'}" data-recording-note-id="${escapeHtml(note.id)}" data-pitch="${note.pitch}" ${note.active?`data-live-note-id="${escapeHtml(note.id)}"`:`data-recording-preview-id="${escapeHtml(note.id)}"`} style="--pitch-y:${pianoPitchY(note.pitch)}px;top:var(--pitch-y);left:${left}%;width:${width}%" aria-label="録音中 ${escapeHtml(label)}">${noteLabelMarkup(note,part)}</span>`}
  function appendLiveRecordingNote(note){const layer=root.document?.querySelector?.('.music-midi-editor-page .music-live-note-layer');if(!layer?.insertAdjacentHTML)return false;layer.insertAdjacentHTML('beforeend',liveRecordingNoteHtml(note));const element=recordingNoteElement(note.id);if(element)updateNoteLabelElement(element);return Boolean(element)}
  function markLiveRecordingNoteReleased(note){const element=recordingNoteElement(note.id);if(!element)return false;element.classList?.remove?.('is-held');element.classList?.add?.('is-released');element.removeAttribute?.('data-live-note-id');element.setAttribute?.('data-recording-preview-id',note.id);return true}
  function clearLiveRecordingNotes(){state.midiInput.liveNotes=[];const layer=root.document?.querySelector?.('.music-midi-editor-page .music-live-note-layer');if(layer)layer.innerHTML=''}
  function discardLiveRecordingOnUnload(){const midi=state.midiInput;cancelPendingMidiStart();midi.inputToken++;if(midi.countingIn)cancelCountIn();if(!midi.recording){stopEditorMetronome();return}if(midi.recordingFrame!==null)root.cancelAnimationFrame?.(midi.recordingFrame);midi.recorder?.stop?.(midiClock());midi.recording=false;midi.recordingFrame=null;midi.recorder=null;clearLiveRecordingNotes();stopEditorMetronome();melodySynth()?.allNotesOff?.()}
  function handleRecordedMidiMessage(event){const midi=state.midiInput,bytes=event.data||[],eventTime=midiEventClock(event);if(midi.stopping)return;midi.messageGate=midi.messageGate||root.MusicStudioMidiInput?.createMessageGate?.(3);if(midi.messageGate&&!midi.messageGate.accept(bytes,eventTime))return;const status=Number(bytes[0])||0,command=status&0xf0,channel=(status&15)+1,pitch=Number(bytes[1])||0,velocity=Number(bytes[2])||0,synth=melodySynth(),noteOn=command===0x90&&velocity>0,noteOff=command===0x80||command===0x90&&velocity===0,monitorMode=editorRecordingTrackRoute().audio.mode,binding=root.MusicStudioEditor.currentTrack(state.midiEditor)?.sampleInstrument;if(binding||monitorMode==='melody'){if(noteOn)synth?.noteOn(pitch,velocity,channel,binding);else if(noteOff)synth?.noteOff(pitch,channel)}else if(noteOn)synth?.previewTrackNote?.(monitorMode,pitch,velocity,.35);if(midi.countingIn){if(eventTime<midi.recordingScheduledAt)return null;activateScheduledRecording()}const recorded=midi.recorder?.handleMessage(bytes,eventTime);if(!midi.recording)return recorded;if(noteOn){const live={id:`live-midi-note-${++midi.liveNoteSequence}`,pitch,velocity,inputChannel:channel,startTick:recordingTickAt(eventTime),durationTicks:1,active:true,isRecording:true};midi.liveNotes.push(live);if(!appendLiveRecordingNote(live))repaintEditor()}else if(noteOff){const live=midi.liveNotes.find(note=>note.active&&note.pitch===pitch&&note.inputChannel===channel);if(live){live.active=false;if(recorded){live.startTick=midi.recordingStartTick+(Number(recorded.startTick)||0);live.durationTicks=Math.max(1,Number(recorded.durationTicks)||1)}updateLiveNoteWidths(eventTime);markLiveRecordingNoteReleased(live)}}return recorded}
  function setMidiInputHandlers(){const midi=state.midiInput;if(!midi.access)return;for(const input of midi.boundInputs)input.onmidimessage=null;for(const input of midi.inputs)input.onmidimessage=null;const selected=midi.inputs.find(input=>input.id===midi.selectedId);const token=++midi.inputToken;if(selected)selected.onmidimessage=event=>{if(token!==midi.inputToken||midi.selectedId!==selected.id||!midi.inputs.includes(selected))return;return handleRecordedMidiMessage(event)};midi.boundInputs=[...midi.inputs]}
  function refreshMidiInputDevices(access=state.midiInput.access){const midi=state.midiInput,inputs=[...(access?.inputs?.values?.()||[])],signature=inputs.map(input=>`${input.id}\u0000${input.name||''}\u0000${input.manufacturer||''}`).join('\u0001'),changed=signature!==midi.inputSignature,selectedConnected=inputs.some(input=>input.id===midi.selectedId);midi.inputs=inputs;midi.inputSignature=signature;if(!selectedConnected){if(midi.selectedId)cancelPendingMidiStart();if(midi.countingIn)cancelCountIn();if(midi.recording)editorStopMidiRecording();midi.selectedId=inputs[0]?.id||''}midi.status=inputs.length?`${inputs.length}台のMIDI入力を検出しました。`:'MIDI入力が見つかりません。接続後にもう一度確認してください。';setMidiInputHandlers();return changed}
  let midiInitializationPromise=null,midiAutoInitializationTimer=null,midiAccessRequestToken=0;
  async function editorInitializeMidi(options={}){const requestToken=++midiAccessRequestToken;const adapter=root.MusicStudioMidiInput;if(!adapter?.isSupported?.(root.navigator)){const safariLike=adapter?.supportInfo?.(root.navigator)?.safariLike===true;state.midiInput.initialized=true;state.midiInput.supported=false;state.midiInput.status=safariLike?'SafariではMIDI入力を利用できません。Mac Chromeで開いてください。':'この環境ではWeb MIDI APIを利用できません。';return repaintEditor()}try{const midi=state.midiInput,forceRefresh=options?.forceRefresh===true;if(!midi.access||forceRefresh){const previousAccess=midi.access,result=await adapter.requestAccess(root.navigator);if(requestToken!==midiAccessRequestToken)return{ok:false,reason:'access-superseded'};if(previousAccess&&previousAccess!==result.access)previousAccess.onstatechange=null;midi.access=result.access;midi.inputSignature='';if(result.access)result.access.onstatechange=()=>{if(midi.access===result.access&&refreshMidiInputDevices(result.access))repaintEditor()}}midi.initialized=true;midi.supported=true;refreshMidiInputDevices(midi.access);repaintEditor()}catch(error){if(requestToken!==midiAccessRequestToken)return{ok:false,reason:'access-superseded'};state.midiInput.initialized=true;state.midiInput.supported=true;state.midiInput.status=`MIDI入力を利用できません：${error.message}`;repaintEditor()}}
  function initializeMidiInputOnce(){if(state.midiInput.initialized)return Promise.resolve(state.midiInput);if(midiInitializationPromise)return midiInitializationPromise;midiInitializationPromise=Promise.resolve(editorInitializeMidi()).then(()=>state.midiInput).finally(()=>{midiInitializationPromise=null});return midiInitializationPromise}
  function scheduleMidiAutoInitialization(route=currentRoute()){if(!root.document||!isMidiEditorRoute(route)||state.midiInput.initialized||midiInitializationPromise||midiAutoInitializationTimer!==null)return false;const timer=root.setTimeout?.(()=>{midiAutoInitializationTimer=null;if(isMidiEditorRoute(currentRoute())&&!state.midiInput.initialized)initializeMidiInputOnce()},0);midiAutoInitializationTimer=timer??null;return timer!=null}
  async function editorSelectMidiInput(id){const midi=state.midiInput,value=String(id||'');if(midi.starting||midi.countingIn||midi.recording||midi.stopping)return{ok:false,reason:'transport-busy'};if(value==='__rescan__')return editorInitializeMidi({forceRefresh:true});if(!midi.inputs.some(input=>input.id===value))return;midi.selectedId=value;await unlockMelodyAudio();setMidiInputHandlers()}
  function editorSelectMidiTarget(part){const midi=state.midiInput,value=String(part||'');if(midi.starting||midi.countingIn||midi.recording||midi.stopping)return false;if(!['melody','drums','bass'].includes(value))return false;midi.targetPart=value;repaintEditor();return true}
  function midiClock(){return root.performance?.now?.()??Date.now()}
  function midiEventClock(event){const stamp=Number(event?.timeStamp),now=midiClock();if(!Number.isFinite(stamp))return now;const origin=Number(root.performance?.timeOrigin),candidates=Number.isFinite(origin)?[stamp,stamp-origin,stamp+origin]:[stamp];return candidates.reduce((nearest,value)=>Math.abs(value-now)<Math.abs(nearest-now)?value:nearest,stamp)}
  function editorBeatTiming(session=state.midiEditor){if(session?.coordinatedTimeline){const tick=Math.round((state.midiInput.recording||state.midiInput.countingIn||state.midiInput.starting)?state.midiInput.recordingStartTick:session.playheadTick||0),pos=root.MusicStudioEditor.position({startTick:tick},session.midiData),tempo=root.MusicStudioPlayback.tempoAtTick(tick,session.midiData.tempoMap,session.midiData.tempo);return{tempo,numerator:pos.numerator,denominator:pos.denominator,beatTicks:pos.ticksPerBeat,beatMs:60000/tempo*4/pos.denominator}}const signature=session?.midiData?.timeSignature||{},tempo=Math.max(1,Number(session?.midiData?.tempo)||Number(editorProject(session?.projectId)?.musicalSettings?.bpm)||1),numerator=Math.max(1,Math.round(Number(signature.numerator)||4)),denominator=[1,2,4,8,16,32].includes(Number(signature.denominator))?Number(signature.denominator):4,beatMs=60000/tempo*4/denominator,beatTicks=(Number(session?.midiData?.ppq)||480)*4/denominator;return{tempo,numerator,denominator,beatMs,beatTicks}}
  function editorPlaybackTracks(session=state.midiEditor,targets=['melody','drums','bass']){const tracks=root.MusicStudioEditor?.createTrackRegistry?.(session?.midiData)?.tracks||session?.midiData?.tracks||[],requested=Array.isArray(targets)?targets:[targets],selected=[];for(const target of requested){const track=typeof target==='object'&&target?tracks.find(item=>item===target||item.id===target.id):tracks.find(item=>item.id===target||item.part===target);if(track&&!selected.includes(track))selected.push(track)}return selected}
  function editorPlaybackTransport(session=state.midiEditor,runtime={}){const audio=state.melodyAudio,playbackState=audio.playbackState||{};return root.MusicStudioPlayback?.createTransportState?.(session?.midiData||{},{playing:audio.playing,currentTick:session?.playheadTick,playbackState,...runtime})||null}
  function editorActivePlaybackTracks(session=state.midiEditor){return root.MusicStudioPlayback?.activePlaybackTracks?.(editorPlaybackTracks(session),state.melodyAudio.playbackState||{})||[]}
  function scheduleTrackPlayback(synth,tracks,transportState){return performanceMeasure('scheduling',()=>scheduleTrackPlaybackMeasured(synth,tracks,transportState))}
  function scheduleTrackPlaybackMeasured(synth,tracks,transportState){prepareInstruments(synth,editorProject(state.midiEditor?.projectId));if(root.MusicStudioPlayback?.schedulePlaybackTracks)return root.MusicStudioPlayback.schedulePlaybackTracks(synth,tracks,transportState);return{ok:false,noteCount:0,durationMs:0,reason:'track-playback-contract-unavailable'}}
  function stopEditorMetronome(){const audio=state.melodyAudio;audio.metronomeToken++;if(audio.metronomeTimer!=null)root.clearTimeout?.(audio.metronomeTimer);audio.metronomeTimer=null;audio.synth?.stopMetronome?.()}
  function startEditorMetronome({startAt=midiClock(),beatIndex=0,startTick=state.midiEditor?.playheadTick||0}={}){const session=state.midiEditor,audio=state.melodyAudio;if(!session||!editorTransportSettings(session).metronomeEnabled)return false;stopEditorMetronome();if(session.coordinatedTimeline&&!state.midiInput.countingIn){const data=session.midiData,core=root.MusicStudioEditor,timingService=root.MusicStudioPlayback,token=audio.metronomeToken,origin=Number(startAt),originTick=Number(startTick),end=editorTimelineTicks(session).totalTicks;let tick=core.nextBeatTick(session,originTick);const schedule=()=>{if(token!==audio.metronomeToken||tick>=end)return;const pos=core.position({startTick:tick},data),target=origin+timingService.tickDurationSeconds(originTick,tick,data.ppq,data.tempoMap,data.tempo)*1000;audio.metronomeTimer=root.setTimeout?.(()=>{if(token!==audio.metronomeToken)return;melodySynth()?.metronomeClick?.(tick===pos.measureStartTick);tick=Math.min(pos.measureEndTick,tick+pos.ticksPerBeat);schedule()},Math.max(0,target-midiClock()))??null};schedule();return true}const timing=editorBeatTiming(session),token=audio.metronomeToken,origin=Number(startAt),firstBeat=Math.max(0,Math.floor(Number(beatIndex)||0));let index=0;const schedule=()=>{if(token!==audio.metronomeToken)return;const target=origin+index*timing.beatMs,delay=Math.max(0,target-midiClock());audio.metronomeTimer=root.setTimeout?.(()=>{if(token!==audio.metronomeToken)return;melodySynth()?.metronomeClick?.((firstBeat+index)%timing.numerator===0);index++;schedule()},delay)??null};schedule();return true}
  function editorToggleTransportSetting(key){const session=state.midiEditor;if(!session||state.midiInput.countingIn||state.midiInput.recording||state.melodyAudio.playing||state.melodyAudio.starting)return false;const editor=session.midiData.editor||(session.midiData.editor={}),transport=editor.transport||(editor.transport={countInEnabled:true,metronomeEnabled:true});transport[key]=transport[key]===false;root.MusicStudioEditor.updateDirty(session);scheduleMidiEditorSave();repaintEditor();return transport[key]}
  function editorToggleCountIn(){return editorToggleTransportSetting('countInEnabled')}
  function editorToggleMetronome(){return editorToggleTransportSetting('metronomeEnabled')}
  function recordingTickAt(time=midiClock()){const midi=state.midiInput,session=state.midiEditor,ppq=Number(session?.midiData?.ppq)||480,tempo=editorBeatTiming(session).tempo,elapsed=Math.max(0,Number(time)-midi.recordingStartedAt);return session?.coordinatedTimeline?root.MusicStudioPlayback.tickAtSeconds(midi.recordingStartTick,elapsed/1000,ppq,session.midiData.tempoMap,session.midiData.tempo):midi.recordingStartTick+elapsed*ppq*tempo/60000}
  function scheduleRecordingPlayback(startAt){const midi=state.midiInput,session=state.midiEditor,tracks=editorPlaybackTracks(session),active=editorActivePlaybackTracks(session),audio=state.melodyAudio,synth=melodySynth();if(!active.some(track=>track.notes.length)||!synth?.playNotes&&!synth?.playTracks)return null;const loop=editorLoop(session),timeline=editorTimelineTicks(session),endTick=loop.enabled?loop.end:timeline.totalTicks,performanceNow=midiClock(),contextNow=Number(synth.context?.currentTime),startTime=Number.isFinite(contextNow)?contextNow+Math.max(0,(Number(startAt)-performanceNow)/1000):undefined,transport=editorPlaybackTransport(session,{playing:true,currentTick:midi.recordingStartTick,playbackStartOrigin:startTime});synth.stopPlayback?.();const result=scheduleTrackPlayback(synth,tracks,{...transport,startTick:midi.recordingStartTick,endTick,startTime,leadSeconds:startTime==null?0:undefined,playbackState:audio.playbackState});midi.recordingPlayback=result?.ok?result:null;audio.transport=result?.ok?{...transport,playing:true,currentTick:midi.recordingStartTick,playbackStartOrigin:result.playbackStart,activePlaybackTrackIds:transport.activePlaybackTrackIds}:transport;audio.playing=Boolean(result?.ok&&result.noteCount>0);audio.status=audio.playing?'既存Trackを再生しながら録音中':'';return midi.recordingPlayback}
  function commitRecordedNotes(recorder,time,offset,trackId=state.midiInput.recordingTrackId,part=state.midiInput.recordingPart||'melody'){const notes=recorder?.stop?.(time)?.map(note=>({...note,id:uuid(),startTick:Math.max(0,(Number(note.startTick)||0)+offset)}))||[],editor=root.MusicStudioEditor;if(notes.length){if(editor?.getTrackById?.(state.midiEditor?.midiData?.tracks,trackId)&&editor?.addNotesToTrack){const result=editor.addNotesToTrack(state.midiEditor,trackId,notes);if(result?.ok===false){state.midiInput.status='保護範囲に重なる録音の追加を中止しました。';return[]}}else if(editor?.addNotesToPart)editor.addNotesToPart(state.midiEditor,part,notes);else editor?.addNotes?.(state.midiEditor,notes)}return notes}
  function startRecordingPlayhead(){const midi=state.midiInput,session=state.midiEditor;if(!root.requestAnimationFrame)return;const recorder=midi.recorder,token=midi.startToken;const advance=()=>{if(token!==midi.startToken||recorder!==midi.recorder||session!==state.midiEditor||!midi.recording||midi.stopping)return;const time=midiClock(),loop=editorLoop(session),tick=recordingTickAt(time);if(loop.enabled&&tick>=loop.end){const ppq=Number(session.midiData.ppq)||480,tempo=editorBeatTiming(session).tempo,boundaryTime=midi.recordingStartedAt+(session.coordinatedTimeline?root.MusicStudioPlayback.tickDurationSeconds(midi.recordingStartTick,loop.end,ppq,session.midiData.tempoMap,session.midiData.tempo)*1000:(loop.end-midi.recordingStartTick)*60000/(ppq*tempo));editorStopMidiRecording({stoppedAt:boundaryTime,stopTick:loop.end})}else{setEditorPlayhead(session,Math.min(editorTimelineTicks(session).totalTicks,tick));updateLiveNoteWidths(time);midi.recordingFrame=root.requestAnimationFrame(advance)}};midi.recordingFrame=root.requestAnimationFrame(advance)}
  function beginMidiRecording(adapter,startedAt=midiClock()){const midi=state.midiInput,session=state.midiEditor,timing=editorBeatTiming(session);midi.countingIn=false;midi.countInBeat=0;if(midi.countInTimer!=null)root.clearTimeout?.(midi.countInTimer);midi.countInTimer=null;midi.countInAdapter=null;midi.recordingStartedAt=Number(startedAt);midi.recordingActivatedAt=midiClock();if(!midi.recordingPlayback)scheduleRecordingPlayback(midi.recordingStartedAt);midi.recorder=adapter.createRecorder({ppq:session.midiData.ppq,tempo:session.midiData.tempo,...(session.coordinatedTimeline?{tempoMap:session.midiData.tempoMap,startTick:midi.recordingStartTick}:{tempo:timing.tempo})});midi.recorder.start(midi.recordingStartedAt);midi.recording=true;midi.status=midi.recordingPlayback?'既存Melodyを再生しながら録音中です。':'録音中です。MIDIキーボードを演奏してください。';setMidiInputHandlers();if(editorTransportSettings(session).metronomeEnabled&&state.melodyAudio.metronomeTimer==null)startEditorMetronome({startAt:midi.recordingStartedAt,startTick:midi.recordingStartTick,beatIndex:Math.floor(midi.recordingStartTick/timing.beatTicks)});repaintEditor();startRecordingPlayhead();return{ok:true,recording:true,playback:midi.recordingPlayback}}
  function activateScheduledRecording(){const midi=state.midiInput;if(!midi.countingIn||!midi.countInAdapter)return false;midi.countInToken++;const resolve=midi.countInResolve,adapter=midi.countInAdapter,startedAt=midi.recordingScheduledAt;midi.countInResolve=null;const result=beginMidiRecording(adapter,startedAt);resolve?.(result);return result}
  function cancelPendingMidiStart(){const midi=state.midiInput;if(!midi.starting||midi.countingIn||midi.recording)return false;midi.startToken++;midi.starting=false;midi.recordingPart=null;midi.recordingTrackId=null;midi.status='録音開始を取り消しました。';return true}
  function cancelCountIn(){const midi=state.midiInput;if(!midi.countingIn)return false;midi.startToken++;midi.countInToken++;if(midi.countInTimer!=null)root.clearTimeout?.(midi.countInTimer);midi.countInTimer=null;midi.countingIn=false;midi.countInBeat=0;midi.countInAdapter=null;midi.starting=false;midi.recordingPart=null;midi.recordingTrackId=null;midi.status='カウントインを停止しました。録音は開始していません。';editorStopMelody(false,false);midi.recordingPlayback=null;melodySynth()?.allNotesOff?.();melodySynth()?.stopPreview?.();const resolve=midi.countInResolve;midi.countInResolve=null;resolve?.({ok:true,countInCancelled:true,recording:false});repaintEditor();return true}
  function startCountIn(adapter){const midi=state.midiInput,session=state.midiEditor,timing=editorBeatTiming(session),token=++midi.countInToken,startAt=midiClock();midi.countingIn=true;midi.countInBeat=0;midi.countInAdapter=adapter;midi.countInStartedAt=startAt;midi.recordingScheduledAt=startAt+timing.numerator*timing.beatMs;scheduleRecordingPlayback(midi.recordingScheduledAt);midi.status=`カウントイン：${timing.numerator}拍`;setMidiInputHandlers();startEditorMetronome({startAt,beatIndex:0});return new Promise(resolve=>{midi.countInResolve=resolve;let beat=0;const advance=()=>{if(token!==midi.countInToken||!midi.countingIn)return;beat++;if(beat>timing.numerator){activateScheduledRecording();return}midi.countInBeat=beat;midi.status=`Count-in ${beat} / ${timing.numerator}`;repaintEditor();const nextAt=startAt+beat*timing.beatMs;midi.countInTimer=root.setTimeout?.(advance,Math.max(0,nextAt-midiClock()))??null};advance()})}
  async function editorStartMidiRecording(options={}){editorStopCandidateAudition();if(vocalBusy())return{ok:false,reason:'vocal-recording-busy'};if(shutdownPromise)return{ok:false,reason:'shutdown-saving'};if(!state.midiEditor)return;const midi=state.midiInput;if(midi.recording&&midi.recorder?.recording)return{ok:false,reason:'already-recording'};if(midi.countingIn||midi.starting||midi.stopping)return{ok:false,reason:'transport-busy'};const session=state.midiEditor,token=++midi.startToken,selectedInput=midi.selectedId,active=()=>token===midi.startToken&&midi.starting&&session===state.midiEditor&&(!selectedInput||selectedInput===midi.selectedId);const editor=root.MusicStudioEditor,targetPart=['melody','drums','bass'].includes(midi.targetPart)?midi.targetPart:'melody',selectedTrack=editor?.getTrackById?.(state.midiEditor.midiData.tracks,state.midiEditor.selectedTrackId),targetTrack=selectedTrack||state.midiEditor.midiData.tracks.find(track=>track.part===targetPart),targetRole=editor?.resolveCoreTrackRole?.(targetTrack)||null;midi.recordingPart=targetRole;midi.recordingTrackId=targetTrack?.id||null;midi.recordRequestedAt=midiClock();midi.starting=true;try{if(midi.recordingFrame!==null)root.cancelAnimationFrame?.(midi.recordingFrame);midi.recording=false;midi.recordingFrame=null;midi.recorder=null;midi.recordingPlayback=null;clearLiveRecordingNotes();stopEditorMetronome();if(state.melodyAudio.playing||state.melodyAudio.starting)editorStopMelody(false,false);await unlockMelodyAudio();if(!active())return{ok:false,reason:'start-cancelled'};if(!midi.initialized)await initializeMidiInputOnce();if(!active())return{ok:false,reason:'start-cancelled'};const adapter=root.MusicStudioMidiInput;if(!midi.supported||!midi.inputs.length)return notice(midi.status||'MIDI入力が見つかりません。','info');midi.messageGate?.reset();const loop=editorLoop(state.midiEditor),playhead=Math.max(0,Number(state.midiEditor.playheadTick)||0);midi.recordingStartTick=loop.enabled&&(playhead<loop.start||playhead>=loop.end)?loop.start:playhead;setEditorPlayhead(state.midiEditor,midi.recordingStartTick);if(editorTransportSettings(state.midiEditor).countInEnabled&&!options.skipCountIn)return await startCountIn(adapter);midi.countInStartedAt=0;midi.recordingScheduledAt=midiClock();return beginMidiRecording(adapter,midi.recordingScheduledAt)}catch(error){if(active()){midi.status=`録音を開始できません：${error.message}`;repaintEditor()}return{ok:false,reason:'start-failed',error}}finally{if(token===midi.startToken){midi.starting=false;if(!midi.recording&&!midi.countingIn){midi.recordingPart=null;midi.recordingTrackId=null}}}}
  function editorStopMidiRecording(options={}){
    if(midiStopPromise)return midiStopPromise;
    const result=stopMidiRecordingAndSave(options);
    midiStopPromise=result;
    result.finally(()=>{if(midiStopPromise===result)midiStopPromise=null}).catch(()=>{});
    return result;
  }
  async function stopMidiRecordingAndSave(options={}){const midi=state.midiInput;if(cancelPendingMidiStart())return{ok:true,startCancelled:true,recording:false};if(midi.countingIn){cancelCountIn();return{ok:true,countInCancelled:true,recording:false}}if(!midi.recording||!midi.recorder||midi.stopping)return;const session=state.midiEditor,targetTrackId=midi.recordingTrackId,targetPart=midi.recordingPart||'melody',targetTrack=root.MusicStudioEditor?.getTrackById?.(session?.midiData?.tracks,targetTrackId),targetName=targetTrack?.name||root.MusicStudioEditor?.PARTS?.[targetPart]?.name||targetTrackId||targetPart,stoppedAt=Number.isFinite(options.stoppedAt)?options.stoppedAt:midiClock(),loop=editorLoop(session),rawStopTick=recordingTickAt(stoppedAt),stopTick=Number.isFinite(options.stopTick)?options.stopTick:loop.enabled?Math.min(loop.end,Math.max(loop.start,rawStopTick)):Math.min(editorTimelineTicks(session).totalTicks,rawStopTick),offset=midi.recordingStartTick;midi.stopping=true;if(midi.recordingFrame!==null)root.cancelAnimationFrame?.(midi.recordingFrame);midi.recordingFrame=null;editorStopMelody(false,false);const notes=commitRecordedNotes(midi.recorder,stoppedAt,offset,targetTrackId,targetPart);midi.recorder=null;midi.recordingPlayback=null;melodySynth()?.allNotesOff();melodySynth()?.stopPreview?.();clearLiveRecordingNotes();midi.recording=false;midi.status=notes.length?`${notes.length}ノートを${targetName}へ追加しました。保存しています…`:'録音を停止しました。ノートはありません。';repaintEditor();const saved=notes.length?await saveMidiEditor({silent:true}):{ok:true,skipped:true};midi.stopping=false;midi.recordingPart=null;midi.recordingTrackId=null;setEditorPlayhead(session,stopTick);midi.status=notes.length?(saved.ok?`${notes.length}ノートを${targetName}へ追加して保存しました。`:`${notes.length}ノートを追加しましたが、保存できませんでした。「MIDI編集を保存」を押してください。`):'録音を停止しました。ノートはありません。';setMidiInputHandlers();repaintEditor();return{...saved,notes,targetPart,targetTrackId}}
  let midiRecordingStartPromise=null;
  function editorToggleMidiRecording(){const midi=state.midiInput;if(midi.stopping)return Promise.resolve({ok:false,reason:'transport-busy'});if(midi.countingIn)return editorStopTransport();if(midi.starting)return editorStopTransport();if(midi.recording)return editorStopTransport();const starting=editorStartMidiRecording();midiRecordingStartPromise=Promise.resolve(starting).finally(()=>{midiRecordingStartPromise=null});return midiRecordingStartPromise}
  async function editorStopTransport(){editorStopMelody(false,false);if(cancelPendingMidiStart())return{ok:true,startCancelled:true,recording:false};if(cancelCountIn())return{ok:true,countInCancelled:true,recording:false};const recording=await editorStopMidiRecording();if(!recording){stopEditorMetronome();repaintEditor()}return recording||{ok:true,playbackStopped:true}}
  function setEditorPlayhead(session,tick){if(!session)return;session.playheadTick=Math.max(0,Number(tick)||0);const line=root.document?.querySelector?.('.music-playhead');if(line)line.style.left=`${Math.min(100,session.playheadTick/editorTimelineTicks(session).totalTicks*100)}%`}
  function startEditorPlayhead(session,result,request){const audio=state.melodyAudio,resultStart=Number.isFinite(result.startTick)?result.startTick:0;if(!root.requestAnimationFrame||!Number.isFinite(result.playbackStart)||!Number.isFinite(result.secondsPerTick)||result.secondsPerTick<=0)return;const advance=()=>{if(!audio.playing||request!==audio.playRequest)return;const currentTime=audio.synth?.context?.currentTime;if(!Number.isFinite(currentTime))return;const elapsed=Math.max(0,currentTime-result.playbackStart),variable=Array.isArray(result.tempoMap)&&root.MusicStudioPlayback?.tickAtSeconds,currentTick=Math.min(result.endTick,variable?root.MusicStudioPlayback.tickAtSeconds(resultStart,elapsed,session.midiData.ppq,result.tempoMap,session.midiData.tempo):resultStart+elapsed/result.secondsPerTick);if(audio.transport)audio.transport.currentTick=currentTick;setEditorPlayhead(session,currentTick);audio.playbackFrame=root.requestAnimationFrame(advance)};audio.playbackFrame=root.requestAnimationFrame(advance)}
  function playMelodySegment(session,tracks,startTick,endTick,request,looping){const audio=state.melodyAudio,synth=melodySynth();if(request!==audio.playRequest)return{ok:false,reason:'cancelled'};synth.stopPlayback();const transport=editorPlaybackTransport(session,{playing:true,currentTick:startTick}),result=scheduleTrackPlayback(synth,tracks,{...transport,startTick,endTick,leadSeconds:looping?0:undefined,playbackState:audio.playbackState});audio.playing=result.ok&&result.noteCount>0;audio.transport={...transport,playing:audio.playing,currentTick:startTick,playbackStartOrigin:result.playbackStart,activePlaybackTrackIds:transport?.activePlaybackTrackIds||[]};audio.status=result.unmappedSampleCount?'音域・強さに対応する素材の割当がありません。Sound（音源）を確認してください。':result.missingSampleCount?'音源素材を確認できないノートがあります。Sound（音源）を確認してください。':audio.playing?(looping?'3Trackループ再生中':'3Track再生中'):'この範囲に再生できるノートがありません';if(audio.playing){const duration=looping?(result.timelineDurationSeconds??Math.max(1,endTick-startTick)*result.secondsPerTick)*1000:result.durationMs;audio.playbackTimer=root.setTimeout?.(()=>{if(request===audio.playRequest)editorStopMelody()},duration);startEditorPlayhead(session,result,request)}return result}
  async function editorPlayMelody(){const session=state.midiEditor,tracks=editorPlaybackTracks(session),active=editorActivePlaybackTracks(session),audio=state.melodyAudio;if(!active.some(track=>track.notes.length))return notice('再生するTrackノートがありません。','info');if(audio.starting||audio.playing)return{ok:false,reason:'already-playing'};const loop=editorLoop(session),timeline=editorTimelineTicks(session),looping=loop.enabled,startTick=looping&&(session.playheadTick<loop.start||session.playheadTick>=loop.end)?loop.start:Math.max(0,Number(session.playheadTick)||0),endTick=looping?loop.end:undefined;editorStopMelody(false,false);setEditorPlayhead(session,startTick);const request=++audio.playRequest;audio.starting=true;audio.status='3Track再生を準備中';repaintEditor();if(!await unlockMelodyAudio()){if(request===audio.playRequest){audio.starting=false;audio.status=''}return notice('このブラウザではPlayback音源を利用できません。','error')}if(request!==audio.playRequest)return{ok:false,reason:'cancelled'};audio.starting=false;const result=playMelodySegment(session,tracks,startTick,Math.min(endTick??timeline.totalTicks,timeline.totalTicks),request,looping);if(result.ok&&result.noteCount>0&&editorTransportSettings(session).metronomeEnabled){const timing=editorBeatTiming(session),contextNow=melodySynth()?.context?.currentTime,leadMs=Number.isFinite(result.playbackStart)&&Number.isFinite(contextNow)?Math.max(0,(result.playbackStart-contextNow)*1000):0,startBeat=Math.ceil(startTick/timing.beatTicks),beatDelay=(startBeat*timing.beatTicks-startTick)*60000/(timing.tempo*(Number(session.midiData.ppq)||480));startEditorMetronome({startAt:midiClock()+leadMs+(session.coordinatedTimeline?0:beatDelay),startTick,beatIndex:startBeat})}repaintEditor();return result}
  function editorToggleMelodyPlayback(){const audio=state.melodyAudio;return audio.playing||audio.starting||state.midiInput.recording?editorStopTransport():editorPlayMelody()}
  let candidateAudition=null,candidateAuditionToken=0;
  function editorStopCandidateAudition(){
    candidateAuditionToken++;
    const run=candidateAudition;candidateAudition=null;
    if(run){if(run.timer)root.clearTimeout?.(run.timer);run.synth.stopPlayback();run.synth.dispose()}
  }
  async function editorAuditionCandidate(plan,session=state.midiEditor){
    if(session!==state.midiEditor||state.midiInput.recording||state.midiInput.starting||state.midiInput.countingIn||vocalBusy())throw Error('audition-transport-busy');
    if(!root.MusicStudioAudio||!root.MusicStudioPlayback)throw Error('audition-audio-unavailable');
    plan=clone(plan);
    const playback=root.MusicStudioPlayback,seconds=playback.tickDurationSeconds(plan.transport.startTick,plan.transport.endTick,plan.transport.ppq,plan.transport.tempoMap,plan.transport.bpm);
    if(!Number.isFinite(seconds)||seconds<=0||seconds>120)throw Error('audition-limit-120-seconds-select-shorter-range');
    const snapshot=()=>JSON.stringify({midi:session.midiData,range:session.editRange,track:root.MusicStudioEditor.currentTrackId(session)}),signature=snapshot(),p=editorProject(session.projectId);
    editorStopMelody(false,false);
    const token=++candidateAuditionToken,synth=root.MusicStudioAudio.createSynth({volume:.12}),run={synth,timer:null};candidateAudition=run;
    try{
      if(!await synth.unlock())throw Error('audition-audio-unavailable');
      if(token!==candidateAuditionToken||session!==state.midiEditor||signature!==snapshot()||p!==editorProject(session.projectId)||state.midiInput.recording||state.midiInput.starting||state.midiInput.countingIn||vocalBusy()){
        if(candidateAudition===run)editorStopCandidateAudition();
        return{ok:false,reason:'audition-cancelled-or-stale'};
      }
      prepareInstruments(synth,p);
      const result=playback.schedulePlaybackTracks(synth,plan.tracks,plan.transport);
      if(!result.ok||!result.noteCount||result.missingSampleCount||result.unmappedSampleCount)throw Error('audition-sample-or-notes-unavailable');
      run.timer=root.setTimeout?.(()=>{if(candidateAudition===run)editorStopCandidateAudition()},Math.max(result.durationMs||0,seconds*1000+100));
      return result;
    }catch(error){if(candidateAudition===run)editorStopCandidateAudition();throw error}
  }
  function editorStopMelody(repaint=true,resetPlayhead=true){editorStopCandidateAudition();const audio=state.melodyAudio;audio.playRequest++;if(audio.playbackTimer)root.clearTimeout?.(audio.playbackTimer);audio.playbackTimer=null;if(audio.playbackFrame!==null)root.cancelAnimationFrame?.(audio.playbackFrame);audio.playbackFrame=null;audio.synth?.stopPlayback();stopEditorMetronome();audio.starting=false;audio.playing=false;audio.status='';if(audio.transport)audio.transport={...audio.transport,playing:false,currentTick:resetPlayhead?0:Number(state.midiEditor?.playheadTick)||0};if(resetPlayhead)setEditorPlayhead(state.midiEditor,0);if(repaint)repaintEditor()}
  function transposeInput(panel=root.document?.querySelector?.('#melodyTransposePanel')){const field=name=>panel?.querySelector?.(`[name="${name}"]`),checked=name=>panel?.querySelector?.(`input[name="${name}"]:checked`);return{fromKey:field('transposeFromKey')?.value||state.midiEditor?.transposeSettings?.fromKey||'C',toKey:field('transposeToKey')?.value||state.midiEditor?.transposeSettings?.toKey||'C',target:checked('transposeTarget')?.value||state.midiEditor?.transposeSettings?.target||'all',measureFrom:Number(field('transposeMeasureFrom')?.value),measureTo:Number(field('transposeMeasureTo')?.value),direction:checked('transposeDirection')?.value||state.midiEditor?.transposeSettings?.direction||'shortest'}}
  function editorUpdateTransposeSettings(panel){const session=state.midiEditor;if(!session)return;session.transposeSettings=transposeInput(panel);session.transposePreview=null;session.songTransposePreview=null;repaintEditor();const menu=root.document?.querySelector?.('.music-correction-menu');if(menu)menu.open=true;return session.transposeSettings}
  function editorPreviewTranspose(){const session=state.midiEditor,input=transposeInput(),context=root.MusicStudioEditor.createEditorContext(session);session.transposeSettings=input;const result=root.MusicStudioEditor.previewTranspose(session,input,context);if(!result.ok)return notice(result.reason,'info');repaintEditor();return result}
  function editorCancelTranspose(){root.MusicStudioEditor.cancelTranspose(state.midiEditor);repaintEditor()}
  function editorPreviewSongTranspose(){const session=state.midiEditor,input=transposeInput();session.transposeSettings=input;const result=root.MusicStudioEditor.previewSongTranspose(session,input);if(!result.ok)return notice(result.reason,'info');repaintEditor();return result}
  function editorCancelSongTranspose(){root.MusicStudioEditor.cancelSongTranspose(state.midiEditor);repaintEditor()}
  function editorApplySongTranspose(){const session=state.midiEditor,preview=session?.songTransposePreview;if(!preview)return notice('先に曲全体の移調プレビューを確認してください。','info');const result=root.MusicStudioEditor.applySongTranspose(session);if(result?.ok===false)return notice(result.reason,'info');scheduleMidiEditorSave();notice(`${result.trackCount} Track・${result.noteCount}ノートを${result.semitones>=0?'+':''}${result.semitones}半音、曲全体で移調しました。Undoで一括して元に戻せます。`,'success');return result}
  function editorApplyTranspose(){const session=state.midiEditor,preview=session?.transposePreview;if(!preview)return notice('先に移調プレビューを確認してください。','info');const context=root.MusicStudioEditor.createEditorContext(session),result=root.MusicStudioEditor.applyTranspose(session,context);if(result?.ok===false)return notice(result.reason,'info');scheduleMidiEditorSave();notice(`${preview.targetNoteIds.length}ノートを${preview.semitones>=0?'+':''}${preview.semitones}半音移調しました。Undoで元に戻せます。`,'success');return result}
  function noteLengthInput(panel=root.document?.querySelector?.('#melodyNoteLengthPanel')){const field=name=>panel?.querySelector?.(`[name="${name}"]`),checked=name=>panel?.querySelector?.(`input[name="${name}"]:checked`);return{target:checked('noteLengthTarget')?.value||state.midiEditor?.noteLengthSettings?.target||'all',measureFrom:Number(field('noteLengthMeasureFrom')?.value),measureTo:Number(field('noteLengthMeasureTo')?.value),length:field('noteLengthValue')?.value||state.midiEditor?.noteLengthSettings?.length||'current'}}
  function editorUpdateNoteLengthSettings(panel){const session=state.midiEditor;if(!session)return;session.noteLengthSettings=noteLengthInput(panel);session.noteLengthPreview=null;repaintEditor();const menu=root.document?.querySelector?.('.music-correction-menu');if(menu)menu.open=true;return session.noteLengthSettings}
  function editorPreviewNoteLength(){const session=state.midiEditor,input=noteLengthInput(),context=root.MusicStudioEditor.createEditorContext(session);session.noteLengthSettings=input;const result=root.MusicStudioEditor.previewNoteLength(session,input,context);if(!result.ok)return notice(result.reason,'info');repaintEditor();return result}
  function editorCancelNoteLength(){root.MusicStudioEditor.cancelNoteLength(state.midiEditor);repaintEditor()}
  function editorApplyNoteLength(){const session=state.midiEditor,preview=session?.noteLengthPreview;if(!preview)return notice('先にノート長Previewを確認してください。','info');const context=root.MusicStudioEditor.createEditorContext(session),result=root.MusicStudioEditor.applyNoteLength(session,context);if(result?.ok===false)return notice(result.reason,'info');scheduleMidiEditorSave();notice(`${preview.targetNoteIds.length}ノートの長さを変更しました。Undoで元に戻せます。`,'success');return result}
  function editorPreviewScopedMidiRepair(){
    const session=state.midiEditor,core=root.MusicStudioEditor,engine=root.MusicStudioScopedMidiRepair;
    if(!session||!engine)return notice('Scoped MIDI Repairを読み込めませんでした。','info');
    const track=core.currentTrack(session),from=Number(root.document?.querySelector('#scopedRepairFrom')?.value),to=Number(root.document?.querySelector('#scopedRepairTo')?.value),resolution=root.document?.querySelector('#scopedRepairResolution')?.value||'1/16';
    const result=engine.preview({midiData:session.midiData},{trackId:track.id,measureFrom:from,measureTo:to,resolution,lockedMeasures:session.lockedMeasures,...(session.coordinatedTimeline?{exactRange:core.measureRangeToTicks({startMeasure:from,endMeasure:to},session.midiData),protectedRanges:root.MusicStudioMeasureLocks.protectedRanges(session.midiData,core,track.id)}:{})});
    if(!result.ok)return notice('修正範囲・Trackを確認してください: '+result.reason,'info');
    result.resolution=resolution;session.scopedMidiRepairPreview=result;session.view.scopedMidiRepairMenuOpen=true;
    notice('修正候補 '+result.changes.length+'件 / 手動確認 '+result.suggestions.length+'件。Applyまでは変更しません。','success');
    repaintEditor({preserveScopedRepairMenu:true});return result;
  }
  function editorCancelScopedMidiRepair(){const session=state.midiEditor;if(!session)return false;session.scopedMidiRepairPreview=null;session.view.scopedMidiRepairMenuOpen=true;repaintEditor({preserveScopedRepairMenu:true});return true}
  function editorApplyScopedMidiRepair(){
    const session=state.midiEditor,preview=session?.scopedMidiRepairPreview;
    if(!preview)return notice('先にPreviewを作成してください。','info');
    const from=Number(root.document?.querySelector('#scopedRepairFrom')?.value),to=Number(root.document?.querySelector('#scopedRepairTo')?.value),resolution=root.document?.querySelector('#scopedRepairResolution')?.value;
    if(from!==preview.measureFrom||to!==preview.measureTo||resolution!==preview.resolution)return notice('小節または補正基準が変更されました。Previewを作り直してください。','info');
    const result=root.MusicStudioEditor.applyScopedMidiRepair(session,preview);
    if(!result.ok)return notice('Applyを中止しました: '+result.reason,'info');
    session.scopedMidiRepairPreview=null;session.view.scopedMidiRepairMenuOpen=true;
    if(result.applied)scheduleMidiEditorSave();notice(result.applied?'指定小節の修正 '+result.changes.length+'件を適用しました。Undoで戻せます。':'変更はありませんでした。',result.applied?'success':'info');repaintEditor({preserveScopedRepairMenu:true});return result;
  }
  function editorPreviewGeneratedMidiCleanup(){const session=state.midiEditor;if(!session)return false;const result=root.MusicStudioEditor.previewGeneratedMidiCleanup(session,{quantize:root.document?.querySelector('#generatedCleanupQuantize')?.value||'OFF',removeDuplicates:root.document?.querySelector('#generatedCleanupDuplicates')?.checked!==false,cleanShortOverlaps:root.document?.querySelector('#generatedCleanupOverlaps')?.checked!==false});if(!result.ok)return notice(result.reason,'info');session.view.generatedCleanupMenuOpen=true;const summary=result.preview.summary;notice(`${summary.tracks} TrackのPreviewを作成しました。Applyまでは変更しません。`,'success');repaintEditor({preserveCleanupMenu:true});return result}
  function editorCancelGeneratedMidiCleanup(){const session=state.midiEditor,result=root.MusicStudioEditor.cancelGeneratedMidiCleanup(session);if(session?.view)session.view.generatedCleanupMenuOpen=true;notice('一括整理Previewを破棄しました。Projectは変更していません。','info');repaintEditor({preserveCleanupMenu:true});return result}
  function editorApplyGeneratedMidiCleanup(){const session=state.midiEditor,result=root.MusicStudioEditor.applyGeneratedMidiCleanup(session);if(!result.ok)return notice(result.reason,'info');session.view.generatedCleanupMenuOpen=true;scheduleMidiEditorSave();notice(`${result.summary.tracks} Trackを整理しました。Undoで一度に元へ戻せます。`,'success');repaintEditor({preserveCleanupMenu:true});return result}
  function editorUpdateCorrectionGuide(form){const session=state.midiEditor,elements=form?.elements;if(!session||!elements)return;session.correctionSettings={key:elements.key?.value||'C',scale:elements.scale?.value||'Major',guideEnabled:elements.guideEnabled?.checked!==false};repaintEditor();const menu=root.document?.querySelector?.('.music-correction-menu');if(menu)menu.open=true;return session.correctionSettings}
  function editorCorrectionInput(){const form=root.document?.querySelector?.('#melodyCorrectionForm'),elements=form?.elements;if(!elements)return{key:'C',scale:'Major',quantize:'1/16',strength:100,swing:0,target:'all',measureFrom:1,measureTo:1,correctDuration:true,cleanShortOverlaps:true};if(state.midiEditor)state.midiEditor.correctionSettings={key:elements.key?.value||'C',scale:elements.scale?.value||'Major',guideEnabled:elements.guideEnabled?.checked!==false};return{key:elements.key?.value,scale:elements.scale?.value,quantize:elements.quantize?.value,strength:Number(elements.strength?.value),swing:Number(elements.swing?.value),target:elements.target?.value||form.querySelector?.('input[name="target"]:checked')?.value||'all',measureFrom:Number(elements.measureFrom?.value),measureTo:Number(elements.measureTo?.value),correctDuration:true,cleanShortOverlaps:true}}
  function editorPreviewCorrection(){const result=root.MusicStudioEditor.previewCorrection(state.midiEditor,editorCorrectionInput());if(!result.ok)return notice(result.reason,'info');repaintEditor();return result}
  function editorToggleCorrectionPreview(){if(!state.midiEditor?.correctionPreview)return editorPreviewCorrection();const preview=state.midiEditor.correctionPreview;preview.viewMode=preview.viewMode==='original'?'corrected':'original';repaintEditor();return preview.viewMode}
  function editorCancelCorrection(){root.MusicStudioEditor.cancelCorrection(state.midiEditor);repaintEditor()}
  function editorApplyCorrection(){const session=state.midiEditor,result=root.MusicStudioEditor.applyCorrection(session);if(result?.ok===false)return notice(result.reason,'info');scheduleMidiEditorSave();notice(`補正を${root.MusicStudioEditor.currentTrack(session)?.name||'Melody'}へ適用しました。Undoで補正前へ戻せます。`,'success');return result}
  function editorDrumInput(pitch){editorPreviewPitch(pitch,100);root.MusicStudioEditor.addNote(state.midiEditor,{pitch,durationTicks:Math.max(1,Math.round(state.midiEditor.midiData.ppq/2)),velocity:100});scheduleMidiEditorSave();repaintEditor()}
  function editorGenerateCandidate(variant){const candidate=root.MusicStudioEditor.setCandidate(state.midiEditor,state.midiEditor.part,variant);if(!candidate)return notice('このパートには候補生成を接続していません。','info');notice(`${candidate.label}（${candidate.notes.length}ノート）を準備しました。採用するまで現在のトラックは変更されません。`,'info')}
  function editorApplyCandidate(){const part=state.midiEditor.part,candidate=state.midiEditor.candidates?.[part];if(!candidate)return notice('先に候補を生成してください。','info');root.MusicStudioEditor.applyCandidate(state.midiEditor,part);scheduleMidiEditorSave();notice(`${candidate.label}を${root.MusicStudioEditor.PARTS[part].name}トラックへ反映しました。`,'success')}
  function editorUpdateSelected(event){event?.preventDefault?.();const form=event?.target,note=editorNote(state.midiEditor),count=editorSelectedNotes(state.midiEditor).length;if(!form||!note)return;const velocity=Number(form.elements.velocity.value);if(count>1)root.MusicStudioEditor.setSelectedVelocity(state.midiEditor,velocity);else root.MusicStudioEditor.updateNote(state.midiEditor,note.id,{pitch:Number(form.elements.pitch.value),startTick:Number(form.elements.startTick.value),durationTicks:Number(form.elements.durationTicks.value),velocity});scheduleMidiEditorSave();repaintEditor()}
  // Serialize manual, Stop and autosave writes. Capture the editor/repository
  // before waiting so a navigation cannot redirect a pending save to another song.
  let midiSaveQueue=Promise.resolve(),midiStopPromise=null,shutdownPromise=null;
  function saveMidiEditor(options={}){
    const session=state.midiEditor,target=repository;
    const result=midiSaveQueue.then(()=>saveMidiEditorSnapshot(session,target,options));
    midiSaveQueue=result.catch(()=>{});
    return result;
  }
  async function saveMidiEditorSnapshot(session,target,options={}){const aiPending=root.MusicStudioAIAssistantPanel?.hasPending?.(session?.projectId)===true;if(!session?.dirty&&!aiPending&&!root.MusicStudioEditor?.projectSectionsPending?.(session))return{ok:true,skipped:true};try{const project=await target.get(session.projectId);if(repository!==target)throw Error('midi-repository-changed');if(!project)throw Error('保存対象のプロジェクトが見つかりません。');const sectionSnapshot=root.MusicStudioEditor.projectSectionsSnapshot?.(session),sectionSaved=root.MusicStudioEditor.projectSectionsSavedSnapshot?.(session);if(sectionSaved&&JSON.stringify(sectionSaved)!==JSON.stringify({present:Object.hasOwn(project,'sections'),items:Object.hasOwn(project,'sections')?project.sections:[]}))throw Error('project-sections-changed-before-save');const harmony=clone(session.songHarmony),harmonyChanged=root.MusicStudioEditor.songHarmonyPending?.(session);if(harmonyChanged&&JSON.stringify(session.savedSongHarmony)!==JSON.stringify({key:project.musicalSettings?.key??null,chordProgressions:project.chordProgressions||[]}))throw Error('project-harmony-changed-before-save');const bpm=Number(session.midiData.tempo),revision=(project.revision||1)+1,aiWorkspace=root.MusicStudioAIAssistantPanel?.workspaceForSave?.(project,revision),updated={...project,musicalSettings:{...project.musicalSettings,bpm,...(harmonyChanged?{key:harmony.key}:{})},...(harmonyChanged?{chordProgressions:clone(harmony.chordProgressions)}:{}),midiData:root.MusicStudioEditor.clone(session.midiData),revision,updatedAt:now(),...(aiWorkspace?{aiWorkspace}:{})};if(sectionSnapshot){if(sectionSnapshot.present)updated.sections=clone(sectionSnapshot.items);else delete updated.sections;}automaticEditRecord(project,updated);const checked=validateProject(updated);if(!checked.valid)throw Error(checked.errors.join(' '));const guard=()=>{if(repository!==target)throw Error('midi-repository-changed')};
    if(typeof target.compareAndPut==='function')await target.compareAndPut(updated,JSON.stringify(project),guard);else{guard();await target.put(updated)}
    guard();if(state.midiEditor===session)setLastProject(updated.projectId);state.projects=state.projects.map(item=>item.projectId===updated.projectId?updated:item);root.MusicStudioEditor.markSongHarmonySaved?.(session,harmony);root.MusicStudioEditor.markSaved(session,updated.midiData);root.MusicStudioEditor.markProjectSectionsSaved?.(session,sectionSnapshot);root.MusicStudioAIAssistantPanel?.markSaved?.(updated,aiWorkspace);if(!options.silent)notice(session.dirty?'保存中に新しい変更が加わりました。もう一度保存してください。':'MIDI編集をプロジェクトへ保存しました。',session.dirty?'info':'success');return{ok:true,project:updated,stale:session.dirty||root.MusicStudioEditor?.projectSectionsPending?.(session)||root.MusicStudioAIAssistantPanel?.hasPending?.(session.projectId)===true}}catch(error){console.error(error);if(session)session.dirty=true;notice('MIDI編集を保存できませんでした。ノートは画面に保持されています。','error');return{ok:false,error}}}
  // New projects must never overwrite an existing ID, even after a racing write.
  async function publishNewProject(project,source,target=repository){
    const guard=()=>{if(repository!==target)throw Error('project-create-repository-changed')};
    guard();if(typeof target.compareAndPut!=='function')throw Error('atomic-project-create-required');
    project.productionHistory.push({id:uuid(),type:'project-create',source,createdAt:project.createdAt});
    if(!validateProject(project).valid)throw Error('project-create-invalid');
    await target.compareAndPut(project,undefined,guard);return project;
  }
  async function createAIProject(input){const target=repository,timestamp=now(),project=makeProject({...input.projectInput,midiData:input.midiData,projectId:input.projectInput?.projectId||uuid()},timestamp),checked=validateProject(project);if(!checked.valid)throw Error(checked.errors.join(' '));await publishNewProject(project,'ai-new-song',target);if(repository!==target)return clone(project);state.projects=[project,...state.projects.filter(item=>item.projectId!==project.projectId)];setLastProject(project.projectId);return clone(project)}
  const saveMidiEditorWithoutTempoMap=saveMidiEditor;
  saveMidiEditor=async function(options={}){const session=state.midiEditor;if(session?.midiData)session.midiData.tempoMap=normalizeProjectTempoMap(session.midiData.tempoMap,session.midiData.tempo);return saveMidiEditorWithoutTempoMap(options)};
  // An acknowledged native close must not interrupt a separate writer.
  function shutdownBusy(){return Boolean(state.midiImporting||state.externalSongImporting||state.midiExporting||pcmEditor.busy||restoreOperation?.active||archiveTransfer.busy||autoBackupPromise||workspaceSaving||lyricsEditor.busy||finalExport.busy||versionPanel.busy||midiStemBatch||state.saveStatus==='saving')}
  // Native owners await this result before closing the WebView. Pagehide cannot
  // promise an asynchronous IndexedDB transaction will finish after termination.
  function prepareForShutdown(){
    if(localVocalJob?.phase==='requesting')cancelLocalScoreVocal(localVocalJob.id);
    editorStopCandidateAudition();
    if(shutdownPromise)return shutdownPromise;
    const operation=Promise.resolve().then(async()=>{
      if(state.persistenceUnavailable)return{ok:false,reason:'durable-storage-unavailable'};
      // Draft prompts/lyrics require explicit preview/adoption; never auto-adopt on quit.
      if(lyricsEditor.pending||workspaceHasDraftInput())return{ok:false,reason:'unadopted-input-pending'};
      if(vocal.phase==='permission')return{ok:false,reason:'vocal-permission-pending'};
      if(vocal.recorder){const result=await vocalStop();if(!result.ok)return{ok:false,reason:'vocal-save-failed'}}
      if(vocal.pending){const result=await vocalSave();if(!result.ok)return{ok:false,reason:'vocal-save-failed'}}
      vocalPlaybackStop();
      if(shutdownBusy())return{ok:false,reason:'operation-in-progress'};
      cancelScheduledSave();
      if(state.midiEditorSaveTimer)root.clearTimeout?.(state.midiEditorSaveTimer);
      state.midiEditorSaveTimer=null;
      if(state.midiEditorViewSaveTimer)root.clearTimeout?.(state.midiEditorViewSaveTimer);
      state.midiEditorViewSaveTimer=null;
      const stopped=await editorStopMidiRecording();
      if(stopped?.ok===false)return{ok:false,reason:'recording-save-failed'};
      editorStopMelody(false,false);pcmStop();longMixStop();
      await midiSaveQueue;
      for(let attempt=0;attempt<3&&midiEditorHasPendingChanges();attempt++){
        const result=await saveMidiEditor({silent:true});
        if(!result.ok)return{ok:false,reason:'midi-save-failed'};
      }
      if(state.dirty){if(currentRoute()===SETTINGS_ROUTE){const result=await persistSettings(readSettingsForm());if(!result.ok)return{ok:false,reason:'settings-save-failed'}}else{const id=parseEditId(currentRoute());if(!id)return{ok:false,reason:'project-form-unavailable'};const result=await saveCurrentProject(id);if(!result.ok)return{ok:false,reason:'project-save-failed'}}}
      if(shutdownBusy()||state.midiInput.recording||state.midiInput.starting||state.midiInput.countingIn||state.midiInput.stopping||hasUnsavedChanges())return{ok:false,reason:'changes-still-pending'};
      return{ok:true};
    }).catch(error=>({ok:false,reason:'shutdown-save-failed',message:String(error?.message||error)}));
    shutdownPromise=operation;
    operation.finally(()=>{if(shutdownPromise===operation)shutdownPromise=null});
    return operation;
  }
  function hasUnsavedChanges(){return Boolean(state.dirty||midiEditorHasPendingChanges()||vocalBusy()||lyricsEditor.pending||workspaceHasDraftInput())}
  function openMidiEditor(id){if(!guardLeave())return false;const target=id||selectedMidiProject()?.projectId;if(!target){notice('先に音楽プロジェクトを作成してください。','info');routeTo(NEW_ROUTE);return true}state.midiEditor=null;routeTo(`${MIDI_EDITOR_ROUTE}/${encodeURIComponent(target)}`);return true}
  function openPart(id,part='melody'){if(!guardLeave())return false;const target=id||selectedMidiProject()?.projectId;if(!target){notice('先に音楽プロジェクトを作成してください。','info');routeTo(NEW_ROUTE);return true}state.midiEditor=null;ensureEditor(target);root.MusicStudioEditor.selectPart(state.midiEditor,part);routeTo(`${MIDI_EDITOR_ROUTE}/${encodeURIComponent(target)}`);return true}
  function openMelody(id){return openPart(id,'melody')}
  function openLogicPro(id){if(!guardLeave())return false;const target=id||getLastProject()||state.projects[0]?.projectId;if(target)setLastProject(target);routeTo(LOGIC_PRO_ROUTE);return true}
  function placeholderView(route,options={}){const id=route.replace(`${HOME_ROUTE}/`,'');const item=FEATURES.find(feature=>feature.id===id&&!feature.action);if(!item)return homeView(options);return `<main class="music-studio-shell music-placeholder" aria-labelledby="musicPlaceholderTitle">${backButton()}<section class="music-placeholder-panel"><div class="music-card-top"><span class="music-feature-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>${statusBadge(item.status)}</div><p class="music-kicker">Music Studio</p><h1 id="musicPlaceholderTitle">${escapeHtml(item.title)}</h1><p class="music-lead">${escapeHtml(item.description)}</p><p class="music-empty">この機能は今後のMS作業で実装します。現在は既存データを変更しない安全な準備中画面です。</p><button class="music-primary" onclick="MusicStudio.goHome()">ホームへ戻る</button></section></main>`}
  function parseEditId(route){return route.startsWith(`${EDIT_ROUTE}/`)?decodeURIComponent(route.slice(EDIT_ROUTE.length+1)):''}
  function editorHelpDialog(part){const names={melody:'Melody制作',drums:'Drums制作',bass:'Bass制作'},guides={melody:['「MIDI入力」で機器を選ぶ（画面入力だけでも制作できます）','RecordまたはAdd NoteでMelodyを入力する','Piano Rollで位置・長さ・Velocityを調整する','Playで確認する','Savedを確認する','必要ならJSONバックアップを作る','Logic Proへ渡す場合はExport Melody MIDIを使う'],drums:['Drumsタブを開く','パッドまたは候補からリズムを入力する','Piano Rollで位置・長さ・Velocityを調整する','MelodyタブのPlayで全体を確認する','Savedを確認し、必要ならJSONバックアップを作る','Logic Proへ渡す場合はExport All MIDIを使う'],bass:['Bassタブを開く','Melody／コード参照を確認して候補を作る、またはAdd Noteで入力する','Piano Rollで位置・長さ・Velocityを調整する','MelodyタブのPlayで全体を確認する','Savedを確認し、必要ならJSONバックアップを作る','Logic Proへ渡す場合はExport All MIDIを使う']};return helpDialog('musicEditorHelp',`${names[part]||'MIDI制作'} ヘルプ`,`${steps(guides[part]||guides.melody)}${saveGuide()}${termsGuide()}`)}
  function projectHelpDialog(){return helpDialog('musicProjectHelp','Project画面 ヘルプ',`${steps(['曲名・BPM・拍子・Keyを確認して保存する','Melody制作を開いて入力・録音する','Drums、Bassを加える','保存済みを確認する','Project全体を残す時はJSON、DAWへ渡す時はMIDIを書き出す'])}${saveGuide()}${termsGuide()}`)}
  function logicHelpDialog(){return helpDialog('musicLogicHelp','Logic Pro Integration ヘルプ',`${steps(['Music Studioから渡す時はMelody MIDIまたはAll MIDIを書き出す','Logic ProでStandard MIDI Fileを読み込む','Logic Proで編集する','Logic ProからStandard MIDI Fileを書き出す','この画面のImport MIDIで解析する','既存Projectを残したまま、新規または複製として保存する'])}${saveGuide()}${termsGuide()}`)}
  function screenGuide(route,html){
    if(route===FIRST_SONG_GUIDE_ROUTE)return firstSongGuideView();
    if(route===HOME_ROUTE)return html.replace('</nav>',`${helpButton('musicHomeHelp','Music Studio Homeのヘルプ')}</nav><aside class="music-first-song-card" aria-labelledby="firstSongCardTitle"><div><p class="music-kicker">BEGINNER GUIDE（はじめての制作）</p><h2 id="firstSongCardTitle">最初の1曲を作る</h2><p>Project作成からLogic Proとの受け渡しまで、12の短い手順で確認できます。</p></div><div class="music-first-song-actions"><button type="button" class="music-primary" onclick="MusicStudio.openHelp('firstSongGuide')">ガイドを開く</button><button type="button" class="music-secondary music-guide-window-button" aria-label="最初の1曲ガイドを別ウィンドウで開く" onclick="MusicStudio.openFirstSongWindow()">↗ 別ウィンドウで開く</button></div></aside>${homeHelpDialog()}${firstSongDialog()}`);
    if(route===NEW_ROUTE)return html.replace('>BPM<input','><abbr title="曲の速さ。数値が大きいほど速くなります。">BPM</abbr><input').replace('>拍子<select','><abbr title="1小節に何拍あるかを表します。4/4は1小節に4拍です。">拍子</abbr><select').replace('>キー<select','><abbr title="曲の中心になる音と調です。">キー</abbr><select');
    if(parseEditId(route))return html.replace('<div class="music-section-heading">',`<div class="music-screen-help">${helpButton('musicProjectHelp','Project画面のヘルプ')}</div>${projectHelpDialog()}<div class="music-section-heading">`).replace('<button class="music-secondary" onclick="MusicStudio.exportProject',`<div class="music-action-explain"><button class="music-secondary" onclick="MusicStudio.exportProject`).replace('>JSON書き出し</button>',`>JSON書き出し</button><small>Project全体のバックアップ。後からMusic Studioへ読み込んで復元できます。</small></div>`).replace('>BPM<input','><abbr title="曲の速さ。数値が大きいほど速くなります。">BPM</abbr><input').replace('>拍子<select','><abbr title="1小節に何拍あるかを表します。4/4は1小節に4拍です。">拍子</abbr><select').replace('>キー<select','><abbr title="曲の中心になる音と調です。">キー</abbr><select');
    if(route===PROJECTS_ROUTE||route===PROJECTS_ALIAS_ROUTE)return html.replace('<div class="music-import-box">','<div class="music-import-box"><p><b>JSONを読み込む：</b>JSONバックアップからMusic Studioプロジェクトを追加復元します。既存Projectは削除しません。</p>');
    if(route===LOGIC_PRO_ROUTE)return html.replace('<header class="music-page-header">',`${logicHelpDialog()}<header class="music-page-header"><div class="music-screen-help">${helpButton('musicLogicHelp','Logic Pro Integrationのヘルプ')}</div>`).replace('<h2 id="midiImportTitle">Logic ProからMIDIを取り込む</h2>',`<h2 id="midiImportTitle">Logic ProからMIDIを取り込む</h2><p class="music-inline-guide"><b>Import MIDI：</b>Logic Proなどから書き出したStandard MIDI FileをMusic Studioへ取り込みます。</p>`);
    if(isMidiEditorRoute(route)&&state.midiEditor){const project=state.projects.find(item=>item.projectId===state.midiEditor.projectId),target=project?editorMidiExportTarget(project,state.midiEditor):null;if(target?.externalMidi)html=html.replace(/<button class="music-secondary" onclick="MusicStudio\.performMidiExport\('[^']+','[^']+'\)"([^>]*)>Export [^<]+ MIDI（書き出す）<\/button>/,`<button class="music-secondary" onclick="${target.action}"$1>Export ${escapeHtml(target.label)}（書き出す）</button><small class="music-control-help">選択中のExternal TrackだけをExact Track IDでStandard MIDI Fileへ書き出します。</small>`)}
    if(isMidiEditorRoute(route)){const part=state.midiEditor?.part||'melody',dialog=part==='melody'?firstSongDialog():editorHelpDialog(part),button=part==='melody'?firstSongHelpButton('Melody制作のヘルプ'):helpButton('musicEditorHelp',`${root.MusicStudioEditor?.PARTS?.[part]?.name||'MIDI'}制作のヘルプ`);return html.replace('<header class="music-editor-heading">',`${dialog}<header class="music-editor-heading">`).replace('</h1></header>',`</h1>${button}</header>`).replace('</button><details class="music-editor-menu music-midi-input-menu">',`</button><span class="music-saved-explain">この端末・このブラウザのMusic Studio保存領域に自動保存済み。クラウド同期ではありません。</span><details class="music-editor-menu music-midi-input-menu">`).replace('Import MIDI（MIDIを読み込む）<input','Import MIDI（MIDIを読み込む）<small>Logic ProなどのStandard MIDI Fileを取り込みます。</small><input').replace(`Export ${root.MusicStudioEditor?.PARTS?.[part]?.name||''} MIDI（書き出す）</button>`,`Export ${root.MusicStudioEditor?.PARTS?.[part]?.name||''} MIDI（書き出す）</button><small class="music-control-help">${part==='melody'?'MelodyパートをStandard MIDI Fileとして書き出し、Logic ProなどのDAWへ渡します。':'選択中のパートをStandard MIDI Fileとして書き出します。'}</small>`).replace('Export All MIDI（全て書き出す）</button>','Export All MIDI（全て書き出す）</button><small class="music-control-help">Melody / Drums / Bassを含むMIDIを書き出します。</small>')}
    return html
  }
  function ensureRouteNavigation(route,html){
    const routeEditorId=midiEditorId(route),isEditor=Boolean(routeEditorId||route===`${HOME_ROUTE}/midi-composer`);
    let output=html.replace(/<button class="music-secondary music-back"[^>]*>[^<]*<\/button>/,'');
    if(isEditor)output=output.replace(/(<main\b[^>]*>)/,'$1<div class="music-editor-chrome">');
    if(isEditor)output=output.replace('</header>','</header></div>');
    const guided=screenGuide(route,output).replace('曲の末尾に1小節追加します。','現在の動作では、曲の末尾に4小節追加します。');
    return isEditor?guided.replace(/<div class="music-editor-chrome">(<dialog[\s\S]*?<\/dialog>)/,'$1<div class="music-editor-chrome">'):guided;
  }
  // Status paints must not cancel the operation whose progress they display.
  let lastProductionRoute=null;
  function renderRoute(route,options={}){return performanceMeasure('render',()=>renderRouteMeasured(route,options))}
  function renderRouteMeasured(route,options={}){const routeChanged=route!==lastProductionRoute;lastProductionRoute=route;editorStopCandidateAudition();if(route===`${HOME_ROUTE}/mastering`&&selectedMidiProject())route=`${HOME_ROUTE}/mixing/${encodeURIComponent(selectedMidiProject().projectId)}`;if(!isMidiEditorRoute(route)){cancelPendingMidiStart();if(state.midiInput.countingIn)cancelCountIn()}if(routeChanged&&!route.startsWith(`${HOME_ROUTE}/mixing`)){finalInvalidate();longMix.abort?.(Error('long-mix-route-cancelled'));longMix.generation++;longMix.candidate=null;longMixStop();pcmStop();if(pcmEditor.projectId!==null){productionPreview.abort?.(Error('production-route-cancelled'));productionPreview.generation++;productionPreview.master=null;productionPreview.harmony=null;pcmEditor.projectId=null;pcmEditor.preview=null;pcmEditor.generation++}}syncShortcutListener(route);let html;if(route===HOME_ROUTE)html=homeView(options);else if(route.startsWith(`${HOME_ROUTE}/vocal/`))html=vocalFocusedView(decodeURIComponent(route.slice(`${HOME_ROUTE}/vocal/`.length)));else if(route.startsWith(`${HOME_ROUTE}/mixing-export/`))html=finalFocusedView(decodeURIComponent(route.slice(`${HOME_ROUTE}/mixing-export/`.length)));else if(route.startsWith(`${HOME_ROUTE}/mixing-long-master/`))html=longMasterFocusedView(decodeURIComponent(route.slice(`${HOME_ROUTE}/mixing-long-master/`.length)));else if(route.startsWith(`${HOME_ROUTE}/mixing-master/`))html=masterFocusedView(decodeURIComponent(route.slice(`${HOME_ROUTE}/mixing-master/`.length)));else if(route.startsWith(`${HOME_ROUTE}/mixing-workspace/`))html=pcmFocusedView(decodeURIComponent(route.slice(`${HOME_ROUTE}/mixing-workspace/`.length)));else if(route.startsWith(`${HOME_ROUTE}/mixing/`))html=pcmMixView(decodeURIComponent(route.slice(`${HOME_ROUTE}/mixing/`.length)));else if(route===`${HOME_ROUTE}/mixing`)html=selectedMidiProject()?pcmMixView(selectedMidiProject().projectId):placeholderView(route,options);else if(route.startsWith(`${HOME_ROUTE}/lyrics-notes/`))html=lyricsAssignmentView(decodeURIComponent(route.slice(`${HOME_ROUTE}/lyrics-notes/`.length)));else if(route===`${HOME_ROUTE}/lyrics-notes`)html=selectedMidiProject()?lyricsAssignmentView(selectedMidiProject().projectId):placeholderView(route,options).replace('この機能は今後のMS作業で実装します。現在は既存データを変更しない安全な準備中画面です。','プロジェクトを開いてMIDI音符を用意してください。既存データを変更する前に割付をPreviewできます。');else if(route===NEW_ROUTE)html=createView();else if(route===PROJECTS_ROUTE||route===PROJECTS_ALIAS_ROUTE)html=listView();else if(route===SETTINGS_ROUTE)html=settingsView();else if(route===BACKUP_ROUTE)html=backupView();else if(route===LOGIC_PRO_ROUTE)html=logicProView();else if(route===`${HOME_ROUTE}/midi-composer`){const project=selectedMidiProject();html=project?midiEditorView(project.projectId):state.loaded?createView():`<main class="music-studio-shell music-project-page"><div class="music-empty"><h1>MIDI Composerを準備しています</h1><p>Music Studio専用保存領域を読み込んでいます。</p></div></main>`}else{const editorId=midiEditorId(route),editId=parseEditId(route);html=editorId?midiEditorView(editorId):editId?editView(editId):placeholderView(route,options)}if(isMidiEditorRoute(route))html=html.replace(/(<div class="music-editor-popover (?![^\"]*music-correction-popover)[^\"]*"[^>]*>)/g,'$1<div class="music-popup-close-row"><button type="button" class="music-secondary music-popup-close" onclick="MusicStudio.editorClosePopup(this)" aria-label="ポップアップを閉じる">× Close（閉じる）</button></div>');scheduleMidiAutoInitialization(route);return (route.startsWith(HOME_ROUTE+'/vocal/')?html:ensureRouteNavigation(route,html)).replace(/(<main\b[^>]*>)/,'$1'+workspaceView()+productionNavigation(route))}
  function formValue(){const form=root.document?.querySelector('#musicProjectForm');if(!form)throw Error('フォームが見つかりません。');const get=name=>form.elements[name]?.value??'';return{projectName:get('projectName'),songTitle:get('songTitle'),purpose:get('purpose'),bpm:get('bpm'),timeSignature:get('timeSignature'),key:get('key'),status:get('status'),productionNotes:get('productionNotes')}}
  async function submitCreate(event){event?.preventDefault?.();try{const target=repository,project=makeProject(formValue());const checked=validateProject(project);if(!checked.valid){notice(checked.errors.join(' '),'error');return}await publishNewProject(project,'project-form',target);if(repository!==target)return{ok:true,committed:true,refreshPending:true,project};setLastProject(project.projectId);state.dirty=false;await refresh();if(repository!==target)return{ok:true,committed:true,refreshPending:true,project};notice('新しい音楽プロジェクトを保存しました。','success');routeTo(`${EDIT_ROUTE}/${encodeURIComponent(project.projectId)}`)}catch(error){console.error(error);notice('保存できませんでした。既存データは変更されていません。','error')}}
  async function submitEdit(event,id){event?.preventDefault?.();cancelScheduledSave();const result=await saveCurrentProject(id,true);if(result.ok){await refresh();notice('変更を保存しました。','success')}else notice(result.message||'保存できませんでした。入力内容は維持しています。','error')}
  async function flushProjectForTransfer(id){
    if(state.midiInput.recording||state.midiInput.starting||state.midiInput.countingIn||state.midiInput.stopping||pcmEditor.busy)return{ok:false,reason:'transport-or-save-busy'};
    const target=repository,session=state.midiEditor;
    if(session?.projectId===id){
      await midiSaveQueue;
      for(let attempt=0;attempt<3&&midiEditorHasPendingChanges();attempt++){
        if(state.midiEditor!==session)return{ok:false,reason:'editor-changed'};
        const result=await saveMidiEditor({silent:true});if(!result.ok)return{ok:false,reason:'midi-save-failed'};
      }
      if(state.midiEditor!==session||midiEditorHasPendingChanges())return{ok:false,reason:'changes-still-pending'};
    }
    if(state.dirty&&parseEditId(currentRoute())===id){const result=await saveCurrentProject(id);if(!result.ok||result.stale)return{ok:false,reason:'project-save-failed'}}
    if(repository!==target)return{ok:false,reason:'repository-changed'};
    return{ok:true};
  }
  async function duplicateProject(id){
    const ready=await flushProjectForTransfer(id);if(!ready.ok){notice('変更を保存してから複製してください。','error');return ready}
    const target=repository,view=JSON.stringify(state.projects),route=currentRoute(),editor=state.midiEditor;
    const contextCurrent=()=>repository===target&&JSON.stringify(state.projects)===view&&currentRoute()===route&&state.midiEditor===editor&&!state.dirty&&!midiEditorHasPendingChanges()&&!state.midiInput.recording&&!state.midiInput.starting&&!state.midiInput.stopping&&!state.midiInput.countingIn&&!vocalBusy()&&!pcmEditor.busy&&!archiveTransfer.busy&&!finalExport.busy&&!shutdownPromise;
    let committed;
    try{
      const source=await target.get(id);if(!source)throw Error('duplicate-source-missing');
      const baseline=JSON.stringify(source),guard=()=>{if(!contextCurrent())throw Error('duplicate-source-changed')};guard();
      const timestamp=now(),projectId=uuid(),duplicate={...clone(source),projectId,projectName:`${source.projectName}（コピー）`,revision:1,createdAt:timestamp,updatedAt:timestamp,...(source.aiWorkspace?{aiWorkspace:rebindAIWorkspace(source.aiWorkspace,projectId,1)}:{})};
      versionRebind(duplicate,'（コピー）');duplicate.productionHistory.push({id:uuid(),type:'project-duplicate',createdAt:timestamp,sourceProjectId:id,sourceRevision:source.revision});
      if(!validateProject(duplicate).valid)throw Error('duplicate-checkpoint-invalid');if(typeof target.compareAndFork!=='function')throw Error('atomic-project-duplicate-required');
      await target.compareAndFork(duplicate,id,baseline,guard);committed=duplicate;
      const deferred=()=>({ok:true,committed:true,refreshPending:true,project:duplicate});
      if(!contextCurrent())return deferred();
      const projects=await target.list();if(!contextCurrent())return deferred();
      state.projects=projects.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));state.loaded=true;
      setLastProject(duplicate.projectId);notice('元のプロジェクトを変更せず複製しました。','success');routeTo(`${EDIT_ROUTE}/${encodeURIComponent(duplicate.projectId)}`);return{ok:true,committed:true,project:duplicate};
    }catch(error){
      // A failed read or repaint cannot turn a durable fork into a failed write.
      if(committed)return{ok:true,committed:true,refreshPending:true,project:committed};
      console.error(error);notice('複製できませんでした。','error');return{ok:false,error:error.message};
    }
  }
  async function askDelete(id){
    const target=repository;try{
      const project=await target.get(id);if(!project)return{ok:false,error:'project-delete-missing'};
      const guard=()=>{if(repository!==target||state.dirty||midiEditorHasPendingChanges()||archiveTransfer.busy||vocalBusy()||shutdownPromise)throw Error('project-delete-conflict')};guard();
      const confirmed=root.confirm?.(`「${project.projectName}」を削除しますか？\nこの操作はこのプロジェクトだけに影響します。`)??false;
      if(!confirmed){notice('削除をキャンセルしました。','info');return{ok:false,cancelled:true}}
      guard();if(typeof target.compareAndDelete!=='function')throw Error('atomic-project-delete-required');
      await target.compareAndDelete(id,JSON.stringify(project),guard);guard();cancelScheduledSave();
      if(getLastProject()===id)setLastProject('');await refresh();notice('プロジェクトを削除しました。ほかのプロジェクトは変更していません。','success');routeTo(PROJECTS_ROUTE);return{ok:true};
    }catch(error){console.error(error);notice('削除できませんでした。変更中のデータと保存先を確認してください。','error');return{ok:false,error:error.message}}
  }

  function safeFileName(name,maxLength=120,fallback='music-project'){const safe=String(name||'').normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').replace(/[\s_-]+/g,'-').replace(/^[.\s-]+|[.\s-]+$/g,'').slice(0,maxLength);return safe||String(fallback||'music-project').normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').slice(0,maxLength)||'music-project'}
  function fileNameTemplateErrors(template){const tokens=String(template||'').match(/\{[^}]+\}/g)||[];const allowed=new Set(['{projectName}','{songTitle}','{date}','{time}','{version}','{type}']);return [...new Set(tokens.filter(token=>!allowed.has(token)))].map(token=>`未対応トークン ${token} は使用できません。`)}
  function renderFileName(template,data={},options={}){const errors=fileNameTemplateErrors(template);if(errors.length)return{ok:false,errors,filename:''};const stamp=options.date instanceof Date?options.date:new Date(options.date||Date.now());const date=Number.isNaN(stamp.getTime())?'date':stamp.toISOString().slice(0,10);const time=Number.isNaN(stamp.getTime())?'time':stamp.toISOString().slice(11,19).replace(/:/g,'-');const values={projectName:data.projectName||'',songTitle:data.songTitle||'',type:data.type||'',date,time,version:data.version||APP_VERSION};const raw=String(template||'').replace(/\{(projectName|songTitle|type|date|time|version)\}/g,(_,key)=>values[key]);return{ok:true,errors:[],filename:safeFileName(raw,clampNumber(options.maxLength,20,200,120,true),options.fallback||'music-studio')}}
  async function exportProject(id){const ready=await flushProjectForTransfer(id);if(!ready.ok){notice('変更を保存してからJSONを書き出してください。','error');return ready}const project=await repository.get(id);if(!project)return;const exported={...clone(project),midiAssets:(project.midiAssets||[]).map(markExternal),audioAssets:(project.audioAssets||[]).map(markExternal),fileReferences:(project.fileReferences||[]).map(markExternal)};const text=JSON.stringify(exported,null,project.pcmMix?undefined:2);const date=now().slice(0,10);const filename=`${safeFileName(project.projectName)}-${date}.json`;if(!root.document||!root.Blob||!root.URL?.createObjectURL)return{filename,text};const url=root.URL.createObjectURL(new Blob([text],{type:'application/json'}));const link=root.document.createElement('a');link.href=url;link.download=filename;root.document.body.appendChild(link);link.click();link.remove();setTimeout(()=>root.URL.revokeObjectURL(url),1000);notice('JSONを書き出しました。PCM Mixの元音声は含まれます。外部音声参照の本体は含まれません。','success');return{filename,text}}
  function markExternal(asset){return{...clone(asset),storage:{...(asset.storage||{}),requiresReselection:true}}}
  // Legacy internal text API; production files use guarded ingress below.
  async function importText(text,control={}){
    let parsed;try{parsed=JSON.parse(text)}catch(_){return{ok:false,message:'JSONが壊れているため読み込めません。既存データは変更していません。'}}
    const checked=validateProject(parsed);if(!checked.valid)return{ok:false,message:`読み込めません：${checked.errors.join(' ')}`};
    const midiErrors=[parsed,...versionSnapshots(parsed)].flatMap(p=>validateRestoredMidi(p).errors);if(midiErrors.length)return{ok:false,message:'読み込めません：'+midiErrors.join('; ')};
    const target=repository,guard=()=>{control.check?.();if(repository!==target)throw Error('stale-repository')};guard();
    if(typeof target.compareAndPut!=='function')throw Error('atomic-project-import-unavailable');
    let incoming=clone(parsed),duplicated=false;
    for(let attempt=0;attempt<8;attempt++){
      guard();
      if(await target.has(incoming.projectId)){
        incoming.projectId=uuid();incoming.projectName=`${parsed.projectName}（読み込み）`;incoming.createdAt=now();duplicated=true;
      }
      incoming.updatedAt=now();incoming.revision=Math.max(1,Number(incoming.revision)||1);
      if(duplicated&&incoming.aiWorkspace)incoming.aiWorkspace=rebindAIWorkspace(parsed.aiWorkspace,incoming.projectId,incoming.revision);
      versionRebind(incoming,duplicated&&incoming.songVersions?.checkpoints?.[0]?.snapshot.projectId!==incoming.projectId?'（読み込み）':'');
      if(!validateProject(incoming).valid)throw Error('import-checkpoint-invalid');
      guard();
      try{await target.compareAndPut(incoming,undefined,guard)}catch(error){
        guard();if(error.message==='stale-lyrics-assignment-storage')continue;throw error;
      }
      setLastProject(incoming.projectId);await refresh();return{ok:true,project:incoming,duplicated,message:duplicated?'ID重複を検出し、新しいIDで安全に読み込みました。':'プロジェクトを読み込みました。'};
    }
    throw Error('project-import-id-conflict');
  }
  let fileIngress;
  function cancelFileIngress(){fileIngress?.cancel();return{cancelled:true}}
  async function guardedJsonFile(file,options={}){
    if(!root.MusicStudioIngress)throw Error('guarded-ingress-unavailable');
    fileIngress=fileIngress||root.MusicStudioIngress.create();const target=repository;
    return fileIngress.readText(file,{...options,reason:()=>repository!==target?'stale-repository':options.reason?.()||null});
  }
  async function importFile(file,options={}){if(!file)return;try{const input=await guardedJsonFile(file,options);input.guard();const result=await importText(input.text,{check:input.guard});notice(result.message,result.ok?'success':'error');if(result.ok)routeTo(`${EDIT_ROUTE}/${encodeURIComponent(result.project.projectId)}`);return result}catch(error){notice('ファイルを読み込めません：'+error.message,'error');return{ok:false,message:error.message}}}
  function setPath(target,path,value){const parts=path.split('.');let cursor=target;for(const part of parts.slice(0,-1))cursor=cursor[part];cursor[parts.at(-1)]=value}
  function readSettingsForm(){const form=root.document?.querySelector('#musicSettingsForm');if(!form)throw Error('設定フォームが見つかりません。');const next=clone(state.settings||defaultSettings());for(const element of [...form.elements]){if(!element.name)continue;let value=element.type==='checkbox'?element.checked:element.value;if(element.type==='number')value=Number(value);if(element.name==='projectDefaults.key'&&!value)value=null;setPath(next,element.name,value)}next.logicPro.autoLaunch=false;next.logicPro.directControl=false;next.privacy.externalTransfer=false;next.privacy.usageData=false;next.privacy.analytics=false;next.privacy.cloudSync=false;next.privacy.localOnly=true;next.experimental.enabled=false;next.experimental.features={};return next}
  function settingsTemplateErrors(value){return fileNameTemplateErrors(value.fileNaming?.template)}
  async function persistSettings(input){if(workspaceSaving)return{ok:false,message:'制作モードの保存を待ってください。'};const errors=settingsTemplateErrors(input);if(errors.length)return{ok:false,message:errors.join(' ')};const normalized=normalizeSettings({...input,updatedAt:now()});try{await repository.putSettings?.(normalized);state.settings=normalized;state.settingsDraft=clone(normalized);state.dirty=false;state.saveStatus='saved';configureAutosave();return{ok:true,settings:normalized,message:'設定を保存しました。'}}catch(error){console.error('Music Studio settings save failed',error);state.saveStatus='error';return{ok:false,message:'設定を保存できませんでした。現在の入力内容は維持しています。'}}}
  async function saveSettingsForm(event){event?.preventDefault?.();state.saveStatus='saving';const indicator=root.document?.querySelector('.music-save-state');if(indicator){indicator.dataset.status='saving';indicator.textContent='保存中'}try{const result=await persistSettings(readSettingsForm());notice(result.message,result.ok?'success':'error')}catch(error){console.error(error);state.saveStatus='error';notice('設定値を確認してください。現在の設定は変更していません。','error')}}
  function markSettingsDirty(){state.dirty=true;state.saveStatus='dirty';const indicator=root.document?.querySelector('.music-save-state');if(indicator){indicator.dataset.status='dirty';indicator.textContent='未保存の変更があります'}updateFileNamePreview()}
  function updateFileNamePreview(){const form=root.document?.querySelector('#musicSettingsForm'),output=root.document?.querySelector('#musicFileNamePreview');if(!form||!output)return;const result=renderFileName(form.elements['fileNaming.template']?.value,{projectName:'夜空のプロジェクト',songTitle:'星明かり',type:'midi'},{maxLength:form.elements['fileNaming.maxLength']?.value,fallback:form.elements['fileNaming.fallback']?.value,date:'2026-07-20T21:30:00.000Z'});output.textContent=result.ok?`プレビュー：${result.filename}.json`:`警告：${result.errors.join(' ')}`}
  function discardSettings(){if(state.dirty&&(root.confirm?.('未保存の設定変更を破棄しますか？')??false)===false)return;state.settingsDraft=clone(state.settings||defaultSettings());state.dirty=false;state.saveStatus='saved';requestPaint()}
  async function resetSettings(){if((root.confirm?.('Music Studio設定だけを初期値に戻しますか？\nプロジェクトデータは削除されません。')??false)===false)return;const createdAt=state.settings?.createdAt||now();const result=await persistSettings({...defaultSettings(),createdAt});notice(result.ok?'設定を初期値に戻しました。プロジェクトは変更していません。':result.message,result.ok?'success':'error')}
  function downloadJson(filename,value){const text=typeof value==='string'?value:JSON.stringify(value,null,2);if(!root.document||!root.Blob||!root.URL?.createObjectURL)return{filename,text};try{const url=root.URL.createObjectURL(new Blob([text],{type:'application/json'}));const link=root.document.createElement('a');link.href=url;link.download=filename;root.document.body.appendChild(link);link.click();link.remove();root.setTimeout?.(()=>root.URL.revokeObjectURL(url),1000);return{filename,text}}catch(error){console.error('Music Studio download failed',error);throw Error('JSONファイルを書き出せませんでした。')}
  }
  function exportSettings(){const value=normalizeSettings(state.settings||defaultSettings(),state.settings?.updatedAt||now());delete value.id;const result=downloadJson(`music-studio-settings_${now().slice(0,10)}.json`,value);notice('設定JSONを書き出しました。プロジェクトは含まれません。','success');return result}
  async function importSettingsText(text,confirmImport=false,control={}){let parsed;try{parsed=JSON.parse(text)}catch(_){return{ok:false,message:'設定JSONが壊れているため読み込めません。現在設定は維持しています。'}}const validation=validateSettings(parsed);if(!validation.valid)return{ok:false,message:`設定を読み込めません：${validation.errors.join(' ')}`};if(confirmImport&&(root.confirm?.('現在のMusic Studio設定を読み込んだ内容へ変更しますか？\nプロジェクトデータには影響しません。')??false)===false)return{ok:false,cancelled:true,message:'設定の読み込みをキャンセルしました。'};control.check?.();return persistSettings({...parsed,id:SETTINGS_ID,createdAt:state.settings?.createdAt||parsed.createdAt})}
  async function importSettingsFile(file,options={}){if(!file)return;try{const input=await guardedJsonFile(file,options);input.guard();const result=await importSettingsText(input.text,true,{check:input.guard});notice(result.message,result.ok?'success':result.cancelled?'info':'error');return result}catch(error){notice('設定ファイルを読み込めません：'+error.message,'error');return{ok:false,message:error.message}}}
  function backupObject(){const projects=state.projects.map(project=>({...clone(project),midiAssets:(project.midiAssets||[]).map(markExternal),audioAssets:(project.audioAssets||[]).map(markExternal),fileReferences:(project.fileReferences||[]).map(markExternal)}));const references=projects.flatMap(project=>(project.fileReferences||[]).map(reference=>({projectId:project.projectId,...clone(reference)})));return{format:BACKUP_FORMAT,version:BACKUP_VERSION,metadata:{createdAt:now(),appVersion:APP_VERSION,projectCount:projects.length,settingsIncluded:true,binariesIncluded:false,...(projects.some(p=>p.pcmMix)?{inlinePcmIncluded:true}:{})},settings:preserveRestoreSettings(state.settings||defaultSettings()),projects,references}}
  function validateBackup(value){const errors=[],warnings=[];if(!value||typeof value!=='object'||Array.isArray(value))return{valid:false,errors:['JSONのルートがオブジェクトではありません。'],warnings};if(value.format!==BACKUP_FORMAT)errors.push(`形式は ${BACKUP_FORMAT} である必要があります。`);if(value.version!==BACKUP_VERSION)errors.push(`バックアップVersion ${value.version??'未設定'} には対応していません。`);if(!Array.isArray(value.projects))errors.push('projects配列がありません。');if(value.settings&&!validateSettings(value.settings).valid)warnings.push('設定形式が正しくありません。設定を選択すると復元全体を中止します。');if(Array.isArray(value.projects))value.projects.forEach((project,index)=>{if(!validateProject(project).valid)warnings.push(`プロジェクト${index+1}は不正です。プロジェクトを選択すると復元全体を中止します。`)});return{valid:errors.length===0,errors,warnings}}
  function exportBackup(safety=false){if(hasUnsavedChanges()||state.midiInput.recording||state.midiInput.starting||state.midiInput.countingIn||state.midiInput.stopping||pcmEditor.busy){notice('録音と保存を完了してからバックアップを書き出してください。','error');return{ok:false,error:'backup-unsaved-changes'}}if(vocalRecovery.items.length||vocal.journalId)return exportLongWavArchive();const backup=backupObject();if(backup.projects.some(hasArchiveFiles)){if(!safety)return exportLongWavArchive();notice('長時間元ファイル本体を含む完全バックアップは未対応です。元データは保持しています。','error');return{ok:false,error:'long-wav-binary-backup-not-supported'}}if(backup.metadata.inlinePcmIncluded&&pcmJsonBytes(backup)>PCM_JSON_LIMIT){notice('PCMを含むBackupが64 MiBを超えます。Project JSONを個別に書き出してください。元データは保持しています。','error');return{ok:false,error:'pcm-backup-capacity-exceeded'}}const prefix=safety?'music-studio-before-restore':'music-studio-backup';const result=downloadJson(`${prefix}_${now().slice(0,10)}.json`,backup.metadata.inlinePcmIncluded?JSON.stringify(backup):backup);if(!safety)notice(`設定とプロジェクト${backup.projects.length}件のバックアップを書き出しました。実ファイル本体は含まれません。`,'success');return result}
  async function inspectBackupCompleteness(value,options={}){
    const metadata=restorePreflight(value);
    if(!root.MusicStudioBinaryBoundary)return{binaryComplete:false,fullBackupComplete:false,scope:'metadata-only',states:['unverified'],metadata};
    const binary=await root.MusicStudioBinaryBoundary.completeness(value,options);
    const checkpointFiles=value?.projects?.some(p=>versionSnapshots(p).some(hasArchiveFiles));
    return{...binary,metadata,fullBackupComplete:metadata.ok&&binary.binaryComplete&&!checkpointFiles,...(checkpointFiles?{checkpointFilesRequireFullArchive:true}: {})};
  }
  async function previewBackupText(text){let parsed;try{parsed=JSON.parse(text)}catch(_){return{ok:false,message:'バックアップJSONが壊れているため読み込めません。'}}const validation=validateBackup(parsed);if(!validation.valid)return{ok:false,message:`バックアップを読み込めません：${validation.errors.join(' ')}`};cancelBackupRestore();state.backupPreview=clone(parsed);requestPaint();return{ok:true,backup:parsed,warnings:validation.warnings,message:`バックアップを検証しました。内容を確認して復元してください。${validation.warnings.length?` 警告：${validation.warnings.join(' ')}`:''}`}}
  async function previewBackupFile(file,options={}){if(!file)return;try{const input=await guardedJsonFile(file,options);input.guard();const result=await previewBackupText(input.text);notice(result.message,result.ok?'success':'error');return result}catch(error){notice('バックアップファイルを読み込めません：'+error.message,'error');return{ok:false,message:error.message}}}
  async function restoreBackup(value,{settings=true,projects=true,safetyCopy=false,signal,binaryMode='metadata-only',binaryResolver,generationAdapter}={}){
    cancelBackupRestore();
    const op={active:true,abort:null},target=repository;restoreOperation=op;
    let baseline,snapshot,committedResult,binaryPreflight;
    try{baseline=JSON.stringify(value);snapshot=clone(value)}catch(error){return{ok:false,added:0,skipped:0,failed:1,message:'Invalid Backup JSON.'}}
    const preflight=restorePreflight(snapshot,{settings,projects});
    const reason=()=>!op.active||signal?.aborted?'restore-cancelled':repository!==target?'restore-stale-repository':JSON.stringify(value)!==baseline?'restore-stale-input':null;
    const control={reason,get abort(){return op.abort},set abort(value){op.abort=value}};
    const cancel=()=>{op.active=false;op.abort?.()};signal?.addEventListener?.('abort',cancel,{once:true});
    try{
      if(!preflight.ok)return{ok:false,added:0,skipped:0,failed:new Set(preflight.errors.map(e=>e.match(/^Project \d+/)?.[0]||'Backup')).size,preflight,message:preflight.errors.join(' ')};
      assertRestoreCurrent(control);
      if(!['metadata-only','complete'].includes(binaryMode))throw Error('unsupported-binary-restore-mode');
      if(binaryMode==='complete'){
        if(!root.MusicStudioBinaryBoundary)throw Error('binary-boundary-unavailable');
        const selected={...snapshot,projects:projects?snapshot.projects:[]};
        binaryPreflight=await root.MusicStudioBinaryBoundary.resolve(selected,{resolver:binaryResolver,reason});
        if(!binaryPreflight.complete)return{ok:false,committed:false,added:0,skipped:0,failed:1,outcome:binaryPreflight.outcome,preflight,binaryPreflight,message:'Required binary dependencies unresolved.'};
        assertRestoreCurrent(control);
        if(binaryPreflight.dependencies.length&&(!generationAdapter||generationAdapter.metadataRepository!==target||generationAdapter.atomicGeneration!==true||typeof generationAdapter.restoreGeneration!=='function'))throw Error('atomic-binary-generation-adapter-unavailable');
      }
      if(typeof target.restoreMetadata!=='function')throw Error('atomic-metadata-restore-unavailable');
      if(safetyCopy){
        // Settings may be replaced even during add-only Restore. Preserve every
        // durable asset and MIDI history before allowing that transaction.
        const histories=await readArchiveMidiHistories(target);assertRestoreCurrent(control);
        const needsArchive=state.projects.some(hasArchiveFiles)||histories.exports.length>0||histories.imports.length>0||(await target.listVocalJournals?.()||[]).length>0;
        const safety=needsArchive?await exportLongWavArchive():exportBackup(true);
        assertRestoreCurrent(control);
        if(safety?.ok===false)throw Error('restore-safety-copy-failed: '+(safety.error||'backup-unavailable'));
      }
      const incomingSettings=settings&&snapshot.settings?preserveRestoreSettings({...snapshot.settings,id:SETTINGS_ID,createdAt:state.settings?.createdAt||snapshot.settings.createdAt,updatedAt:now()}):null;
      const committed=binaryPreflight?.dependencies.length?await root.MusicStudioBinaryBoundary.commit(binaryPreflight,{adapter:generationAdapter,settings:incomingSettings,control}):await target.restoreMetadata(projects?snapshot.projects:[],incomingSettings,control);committedResult=committed;
      // A completed transaction cannot be undone by a later Cancel. Report its commit honestly.
      const staleAfterCommit=Boolean(reason());
      if(!staleAfterCommit){
        if(committed.settings){state.settings=clone(committed.settings);state.settingsDraft=clone(committed.settings);configureAutosave()}
        await refresh();
      }
      return{ok:true,committed:true,atomicMetadata:true,outcome:binaryMode==='complete'?'complete':'metadata-only',binaryPreflight,staleAfterCommit,added:committed.projects.length,skipped:0,failed:0,settingsRestored:Boolean(committed.settings),preflight,message:`復元結果：プロジェクト${committed.projects.length}件と設定${committed.settings?'1':'0'}件をまとめて保存しました。${binaryMode==='complete'?'Binary preflight verified.':'Metadata-only（外部ファイル本体は含みません）。'}`};
    }catch(error){if(committedResult)return{ok:true,committed:true,atomicMetadata:true,outcome:binaryMode==='complete'?'complete':'metadata-only',binaryPreflight,viewRefreshPending:true,added:committedResult.projects.length,skipped:0,failed:0,settingsRestored:Boolean(committedResult.settings),preflight,message:'Metadata Restore committed; refresh pending: '+error.message};return{ok:false,committed:false,outcome:'blocked',binaryPreflight,added:0,skipped:0,failed:1,cancelled:!op.active||signal?.aborted===true,preflight,message:error.message}}
    finally{signal?.removeEventListener?.('abort',cancel);op.abort=null;if(restoreOperation===op)restoreOperation=null}
  }
  async function restorePreviewedBackup(){const value=state.backupPreview;if(!value)return;if((root.confirm?.('表示中のバックアップを安全に追加・統合しますか？\n既存データは削除しません。')??false)===false)return;const settings=root.document?.querySelector('#restoreSettings')?.checked!==false,projects=root.document?.querySelector('#restoreProjects')?.checked!==false;const result=await restoreBackup(value,{settings,projects,safetyCopy:true});if(state.backupPreview===value)state.backupPreview=null;notice(result.message,result.cancelled?'info':result.failed?'error':'success')}
  function clearBackupPreview(){cancelBackupRestore();state.backupPreview=null;requestPaint()}
  function backupSignature(histories,journals=[]){return JSON.stringify({journals,settings:state.settings?.updatedAt||'',projects:state.projects.map(project=>[project.projectId,project.revision,project.updatedAt]),midiHistories:histories})}
  function byteLabel(bytes){if(bytes<1024)return`${bytes} B`;if(bytes<1024*1024)return`${(bytes/1024).toFixed(1)} KB`;return`${(bytes/1024/1024).toFixed(1)} MB`}
  async function loadAutoBackups(){const target=repository;try{const records=((await target.listAutoBackups?.())||[]).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));if(repository===target)state.autoBackups=records;return records}catch(error){console.warn('Music Studio automatic backups could not be read',error);if(repository===target)state.autoBackups=[];return[]}}
  let autoBackupPromise=null;
  function runAutoBackupCheck(timestamp=now()){
    if(autoBackupPromise)return autoBackupPromise;
    const operation=performAutoBackupCheck(timestamp);autoBackupPromise=operation;
    operation.finally(()=>{if(autoBackupPromise===operation)autoBackupPromise=null});return operation;
  }
  async function performAutoBackupCheck(timestamp){
    if(!state.settings?.backup.automaticEnabled)return{ok:true,created:false,reason:'disabled'};
    if(hasUnsavedChanges()||state.midiInput.recording||state.midiInput.starting||state.midiInput.countingIn||state.midiInput.stopping||pcmEditor.busy||archiveTransfer.busy||shutdownPromise)return{ok:false,created:false,reason:'backup-unsaved-or-busy'};
    const target=repository,baseline=JSON.stringify([state.projects,state.settings]),keep=state.settings.backup.maxCopies;
    const backups=await loadAutoBackups(),latest=backups[0],nowMs=Date.parse(timestamp),intervalMs=state.settings.backup.intervalHours*3600000;
    if(latest&&Number.isFinite(nowMs)&&nowMs-Date.parse(latest.createdAt)<intervalMs)return{ok:true,created:false,reason:'not-due'};
    // The persisted histories can change without a project revision or a refreshed UI list.
    let histories;try{histories=await readArchiveMidiHistories(target)}catch(error){return{ok:false,created:false,reason:error.message}}
    let journals;try{journals=await target.listVocalJournals?.()||[]}catch(error){return{ok:false,created:false,reason:error.message}}
    const signature=backupSignature(histories,journals);if(latest?.signature===signature)return{ok:true,created:false,reason:'unchanged'};
    const needsArchive=state.projects.some(hasArchiveFiles)||histories.exports.length>0||histories.imports.length>0||journals.length>0;
    let archive;
    if(needsArchive){
      if(typeof target.putAutoBackup!=='function')return{ok:false,created:false,reason:'archive-storage-unavailable'};
      const token=++archiveTransfer.generation;archiveTransfer.busy=true;requestPaint();
      try{archive=await createLongWavArchive({signal:{get aborted(){return token!==archiveTransfer.generation}}})}catch(error){return{ok:false,created:false,reason:error.message}}finally{archiveTransfer.busy=false;requestPaint()}
    }
    let currentHistories,currentJournals;try{currentHistories=await readArchiveMidiHistories(target);currentJournals=await target.listVocalJournals?.()||[]}catch(error){return{ok:false,created:false,reason:error.message}}
    // Recheck repository and snapshot only after every asynchronous read completes.
    if(repository!==target||JSON.stringify([state.projects,state.settings])!==baseline||JSON.stringify(currentHistories)!==JSON.stringify(histories)||JSON.stringify(currentJournals)!==JSON.stringify(journals))return{ok:false,created:false,reason:'backup-state-conflict'};
    const snapshot=backupObject(),text=JSON.stringify(snapshot),bytes=archive?archive.size:typeof root.TextEncoder==='function'?new root.TextEncoder().encode(text).length:text.length*2;
    if(!archive&&bytes>4*1024*1024)return{ok:false,created:false,reason:'too-large',message:'自動バックアップが4MBを超えるため作成しませんでした。手動JSON書き出しをご利用ください。'};
    const record={backupId:uuid(),createdAt:timestamp,signature,sizeBytes:bytes,sizeLabel:byteLabel(bytes),snapshot,...(archive?{archive,archiveFormat:LONG_ARCHIVE_FORMAT}:{})};
    try{if(typeof target.putAutoBackup!=='function')throw Error('backup-storage-unavailable');await target.putAutoBackup(record)}catch(error){console.warn('Music Studio automatic backup failed',error);return{ok:false,created:false,reason:'storage-error',message:'自動バックアップを作成できませんでした。既存データは変更していません。'}}
    // Publication has committed. Cleanup failure must not report that it did not.
    // A changed repository or retention policy leaves every older copy intact.
    const current=()=>repository===target&&JSON.stringify([state.projects,state.settings])===baseline;
    let cleanupWarning;
    try{
      if(!current())throw Error('backup-state-conflict');
      const all=[record,...backups].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
      for(const old of all.slice(keep)){if(!current())throw Error('backup-state-conflict');await target.deleteAutoBackup?.(old.backupId)}
      if(current())await loadAutoBackups();else throw Error('backup-state-conflict');
    }catch(error){cleanupWarning=error.message;console.warn('Music Studio automatic backup cleanup deferred',error)}
    return{ok:true,created:true,backup:record,...(cleanupWarning?{cleanupWarning}:{}),message:cleanupWarning?'自動バックアップを保存しました。古いコピーの整理は完了していません。':'期限を迎えたため、端末内に自動バックアップを作成しました。'};
  }
  async function checkAutoBackupNow(){const result=await runAutoBackupCheck();notice(result.message||(result.reason==='disabled'?'自動バックアップは無効です。':result.reason==='not-due'?'次の作成期限にはまだ達していません。':'内容に変更がないため重複作成しませんでした。'),result.ok?'info':'error')}
  async function restoreAutoBackup(id){const record=state.autoBackups.find(item=>item.backupId===id);if(!record)return notice('自動バックアップが見つかりません。','error');if((root.confirm?.(`${formatDate(record.createdAt)} の自動バックアップを追加・統合しますか？\n既存データは削除しません。`)??false)===false)return;if(record.archive){const preview=await previewLongWavArchive(record.archive);notice(preview.ok?'WAVを含む自動バックアップを検証しました。内容を確認して復元してください。':'検証できません：'+preview.error,preview.ok?'info':'error');return preview}const result=await restoreBackup(record.snapshot,{settings:true,projects:true,safetyCopy:true});notice(result.message,result.failed?'error':'success')}
  function configureAutosave(){if(state.intervalTimer)root.clearInterval?.(state.intervalTimer);state.intervalTimer=null;if(state.settings?.autosave.enabled&&root.setInterval)state.intervalTimer=root.setInterval(()=>{const id=parseEditId(currentRoute());if(id&&state.dirty)saveCurrentProject(id)},state.settings.autosave.intervalSeconds*1000)}
  async function saveCurrentProject(id,force=false){if(!id||(!state.dirty&&!force))return{ok:true,skipped:true};let input;try{input=formValue()}catch(error){return{ok:false,message:error.message}}const target=repository,sequence=++state.saveSequence,generation=state.editGeneration;state.saveStatus='saving';updateSaveIndicator('保存中');try{const current=await target.get(id);if(repository!==target)throw Error('project-repository-changed');if(!current){state.saveStatus='error';updateSaveIndicator('保存に失敗しました');return{ok:false,message:'保存対象が見つかりません。入力内容は維持しています。'}}const bpm=Number(input.bpm),revision=(current.revision||1)+1,updated={...current,...input,revision,musicalSettings:{...current.musicalSettings,bpm,timeSignature:(()=>{const [numerator,denominator]=input.timeSignature.split('/').map(Number);return{numerator,denominator}})(),key:input.key||null},...(current.midiData?{midiData:{...clone(current.midiData),tempo:bpm,tempoMap:normalizeProjectTempoMap(current.midiData.tempoMap,bpm)}}:{}),...(current.aiWorkspace?{aiWorkspace:rebindAIWorkspace(current.aiWorkspace,current.projectId,revision)}:{}),updatedAt:now()};delete updated.bpm;delete updated.timeSignature;delete updated.key;automaticEditRecord(current,updated,'project-editor');const validation=validateProject(updated);if(!validation.valid){state.saveStatus='error';updateSaveIndicator('保存に失敗しました');return{ok:false,message:validation.errors.join(' ')}}const guard=()=>{if(repository!==target)throw Error('project-repository-changed')};if(typeof target.compareAndPut!=='function')throw Error('project-atomic-save-unavailable');await target.compareAndPut(updated,JSON.stringify(current),guard);guard();if(sequence<state.saveSequence||generation!==state.editGeneration){state.dirty=true;state.saveStatus='dirty';updateSaveIndicator('未保存の変更があります');return{ok:true,stale:true,project:updated}}state.savedSequence=sequence;state.dirty=false;state.saveStatus='saved';setLastProject(id);state.projects=state.projects.map(project=>project.projectId===id?updated:project);updateSaveIndicator('保存しました');return{ok:true,project:updated}}catch(error){console.error('Music Studio autosave failed',error);state.saveStatus='error';state.dirty=true;updateSaveIndicator('保存に失敗しました');notice('自動保存に失敗しました。入力内容は画面に維持されています。手動保存をお試しください。','error');return{ok:false,message:'保存に失敗しました。'}}}
  function updateSaveIndicator(text){const indicator=root.document?.querySelector('.music-save-state');if(indicator){indicator.dataset.status=state.saveStatus;indicator.dataset.dirty=String(state.dirty);indicator.textContent=text}}
  function formatDate(value){try{return new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch(_){return String(value||'')}}
  function cancelScheduledSave(){if(state.autosaveTimer)root.clearTimeout?.(state.autosaveTimer);state.autosaveTimer=null}
  function markDirty(){state.editGeneration++;state.dirty=true;state.saveStatus='dirty';updateSaveIndicator('未保存の変更があります');cancelScheduledSave();const id=parseEditId(currentRoute());if(id&&state.settings?.autosave.enabled&&root.setTimeout)state.autosaveTimer=root.setTimeout(()=>{state.autosaveTimer=null;if(parseEditId(currentRoute())===id)saveCurrentProject(id)},state.settings.autosave.idleDelaySeconds*1000)}
  function cancelEdit(id=''){if(state.dirty&&(root.confirm?.('未保存の変更を破棄しますか？')??false)===false)return;state.dirty=false;routeTo(id?`${EDIT_ROUTE}/${encodeURIComponent(id)}`:HOME_ROUTE);requestPaint()}
  function guardLeave(quiet=false){
    const blocked=message=>{if(!quiet)notice(message,'error');return false};
    if(vocalBusy())return blocked('ボーカル録音・保存を完了してください。');
    if(finalExport.busy||lyricsEditor.busy||lyricsEditor.pending||pcmEditor.busy||archiveTransfer.busy||versionPanel.busy||workspaceSaving||productionNavigationSaving||state.saveStatus==='saving'||state.midiEditorSaveInFlight||state.midiInput.stopping||shutdownPromise)return blocked('処理を完了し、保存してから移動してください。');
    if(workspaceHasDraftInput()||state.projects.some(p=>root.MusicStudioAIAssistantPanel?.hasPending?.(p.projectId)))return blocked('AIの入力・候補を保存または取消してから移動してください。');
    if(state.midiInput.starting&&!state.midiInput.countingIn)cancelPendingMidiStart();
    if(state.midiInput.countingIn)cancelCountIn();
    if(state.midiInput.recording)return blocked('録音を停止してから移動してください。');
    if(midiEditorHasPendingChanges())return blocked('MIDI編集に未保存の変更があります。保存してから移動してください。');
    return !state.dirty||(root.confirm?.('未保存の変更を破棄して移動しますか？')??false);
  }
  function go(route){if(guardLeave()){cancelScheduledSave();state.dirty=false;state.notice='';routeTo(route)}}
  function goDreamArchitect(standalone=false){if(!guardLeave())return false;cancelScheduledSave();state.dirty=false;if(standalone)root.location.href='./index.html#dream-architect';else if(typeof root.setView==='function')root.setView('dream-architect');else root.location.hash='dream-architect';return true}
  function isMusicRoute(route){return route===HOME_ROUTE||route.startsWith(`${HOME_ROUTE}/`)}
  function syncHostChrome(route){syncShortcutListener(route);root.document?.body?.classList?.toggle('is-music-studio-route',isMusicRoute(route))}
  let lastRoute=currentRoute(),restoringRoute=false;
  function handleHistoryRouteChange(paint){
    const route=currentRoute();
    // Hash/popstate can be delivered together. Only the restored route is ignored;
    // a second user navigation must pass the guards again.
    if(restoringRoute&&route===lastRoute){restoringRoute=false;return}
    restoringRoute=false;if(route===lastRoute)return;
    // Quiet validation prevents a rejection repaint from mounting the destination
    // before the original hash is restored, which could discard editor state.
    if(!guardLeave(true)){restoringRoute=true;root.location.hash='#'+lastRoute;return}
    state.dirty=false;cancelScheduledSave();lastRoute=route;paint(route);
  }
  function installHostRoutes(){if(typeof root.managementViewForRoute!=='function')return false;const base=root.managementViewForRoute;root.managementViewForRoute=function(route){syncHostChrome(route);return isMusicRoute(route)?renderRoute(route):base(route)};const baseSetView=typeof root.setView==='function'?root.setView:null;if(baseSetView)root.setView=function(route){if(route!==currentRoute()&&route!==lastRoute&&!guardLeave())return false;if(parseEditId(currentRoute())!==parseEditId(route))cancelScheduledSave();lastRoute=route;syncHostChrome(route);return baseSetView(route)};const baseOpenApp=typeof root.openApp==='function'?root.openApp:null;if(baseOpenApp)root.openApp=function(appId,urlOverride){if(appId==='musicStudio'&&!urlOverride)return root.setView(HOME_ROUTE);return baseOpenApp(appId,urlOverride)};const historyHandler=()=>handleHistoryRouteChange(route=>{syncHostChrome(route);if(isMusicRoute(route))root.render?.()});root.addEventListener?.('popstate',()=>root.setTimeout?.(historyHandler,0));root.addEventListener?.('hashchange',historyHandler);syncHostChrome(currentRoute());root.render?.();return true}
  let standaloneTarget=null;
  function standaloneHero(){return `<section class="atelier-hero studio-route-hero" data-studio-key="music" data-hero-image-status="formal" aria-labelledby="studio-hero-title-music"><div class="atelier-hero-media"><img src="./assets/images/home/music-studio-home-hero-20260804-3.jpeg" alt="Music StudioのHeroイラスト（ティアとノヴァ）" width="1774" height="444" loading="eager" decoding="async"></div><div class="studio-hero-copy"><p class="studio-hero-category">MUSIC PRODUCTION（音楽制作）</p><h1 id="studio-hero-title-music">Music Studio</h1><p>音楽プロジェクトを安全に作成・保存・管理します。</p></div></section>`}
  function standalonePage(route,content){if(isMidiEditorRoute(route)||parseEditId(route)||route.startsWith(HOME_ROUTE+'/lyrics-notes/')||route.startsWith(HOME_ROUTE+'/vocal/')||route.startsWith(HOME_ROUTE+'/mixing-export/')||route.startsWith(HOME_ROUTE+'/mixing-workspace/')||route.startsWith(HOME_ROUTE+'/mixing-master/')||route.startsWith(HOME_ROUTE+'/mixing-long-master/'))return content;return `<div class="nova-studio-route-main" data-nova-studio-route="${escapeHtml(route)}" data-studio-key="music">${standaloneHero()}<section class="nova-studio-route-content">${content}</section></div>`}
  function paintStandalone(){standaloneTarget=standaloneTarget||root.document?.querySelector('#music-studio-app');if(!standaloneTarget)return;const route=currentRoute(),isEditor=isMidiEditorRoute(route);root.document?.body?.classList?.toggle('is-studio-route',!isEditor);root.document?.body?.classList?.toggle('is-music-studio-route',true);root.document?.querySelectorAll?.('[data-music-home-style]').forEach(sheet=>{sheet.disabled=isEditor});standaloneTarget.innerHTML=standalonePage(route,renderRoute(route,{standalone:true}));restoreEditorPitchScroll();root.document.title=route===HOME_ROUTE?'Music Studio':'Music Studio — プロジェクト管理'}
  function mountStandalone(){const historyHandler=()=>handleHistoryRouteChange(()=>paintStandalone());root.addEventListener?.('popstate',()=>root.setTimeout?.(historyHandler,0));root.addEventListener?.('hashchange',historyHandler);paintStandalone()}
  async function initialize(){try{await loadSettings();configureAutosave();await refresh();await vocalDiscoverRecovery();await loadAutoBackups();await loadMidiHistory();await loadMidiImportHistory();requestPaint();const automatic=await runAutoBackupCheck();if(automatic.created){state.notice=automatic.message;state.noticeKind='success';requestPaint()}}catch(error){console.error('Music Studio storage could not be opened',error);repository=memoryRepository();state.persistenceUnavailable=true;state.settings=normalizeSettings({});state.settingsDraft=clone(state.settings);state.loaded=true;notice('専用保存領域を開けないため、このセッションでは一時保存になります。','error')}}

  // Local mastering: BS.1770 K-weighting and gating, 4x FIR peak estimate; 48 kHz mono/stereo only.
  // Other rates are rejected rather than applying 48 kHz coefficients incorrectly.
  // Four normalized phases of a 32-tap Hann-windowed sinc interpolator.
  // The longer filter reduces high-frequency transient error versus the former
  // 12-tap estimate. Independent FFmpeg references use the existing 0.2 dB bound.
  const MASTER_PHASES=Array.from({length:4},(_,phase)=>{
    const taps=Array.from({length:32},(_,j)=>{const d=15+phase/4-j;return(d===0?1:Math.sin(Math.PI*d)/(Math.PI*d))*(.5+.5*Math.cos(Math.PI*d/16))});
    const sum=taps.reduce((a,b)=>a+b,0);return taps.map(x=>x/sum);
  });
  const MASTER_FIR=Array.from({length:32},(_,j)=>MASTER_PHASES.map(phase=>phase[j]));
  function masterMeter(){
    const filter=(b,a)=>{let z1=0,z2=0;return x=>{const y=b[0]*x+z1;z1=b[1]*x-a[0]*y+z2;z2=b[2]*x-a[1]*y;return y}};
    const ring=new Float64Array(19200),blocks=[];let sum=0,frames=0,count=0,peak=0,tp=0,clipping=0,filters=[],history=[],leading=[],finished=null;
    const trueSample=(c,x)=>{const state=history[c],h=state.samples;const head=state.head=(state.head+31)%32;h[head]=h[head+32]=x;
      // Keep each FIR phase's summation order while sharing history/coefficient reads.
      let a=0,b=0,d=0,e=0;for(let j=0;j<32;j++){const v=h[head+j],k=MASTER_FIR[j];a+=v*k[0];b+=v*k[1];d+=v*k[2];e+=v*k[3]}tp=Math.max(tp,Math.abs(a),Math.abs(b),Math.abs(d),Math.abs(e))};
    const push=pcm=>{if(finished)throw Error('master-already-finished');const n=pcmValidate(pcm);if(pcm.sampleRate!==48000)throw Error('master-48khz-required');
      if(!count){count=pcm.channels.length;filters=Array.from({length:count},()=>[filter([1.53512485958697,-2.69169618940638,1.19839281085285],[-1.69065929318241,.73248077421585]),filter([1,-2,1],[-1.99004745483398,.99007225036621])]);history=Array.from({length:count},()=>({samples:Array(64).fill(0),head:0}));leading=Array.from({length:count},()=>[])}
      if(count!==pcm.channels.length)throw Error('master-format-changed');
      for(let i=0;i<n;i++){let energy=0;for(let c=0;c<count;c++){const x=pcm.channels[c][i];if(leading[c].length<32)leading[c].push(x);peak=Math.max(peak,Math.abs(x));if(Math.abs(x)>=1)clipping++;trueSample(c,x);const y=filters[c][1](filters[c][0](x));energy+=y*y}const at=frames%19200;sum+=energy-ring[at];ring[at]=energy;frames++;if(frames>=19200&&(frames-19200)%4800===0)blocks.push(Math.max(0,sum/19200))}
      return frames;
    };
    // Each meter owns independent filter, gate and FIR history.
    // Mirror only before the first sample, as swr's initial buffer does.
    // Retain the existing zero-extended end estimate. This bounded extra guard
    // handles abrupt starts without inventing peaks beyond the file duration.
    const startPeak=samples=>{
      const get=index=>samples[Math.abs(index)]||0;
      for(let at=0;at<Math.min(16,samples.length);at++)for(let phase=0;phase<4;phase++){
        let value=0;for(let j=0;j<32;j++)value+=get(at+j-15)*MASTER_PHASES[phase][j];tp=Math.max(tp,Math.abs(value));
      }
    };
    const finish=()=>{if(finished)return{...finished};if(!frames)throw Error('master-empty');
      for(let c=0;c<count;c++)startPeak(leading[c]);
      for(let i=0;i<31;i++)for(let c=0;c<count;c++)trueSample(c,0);tp=Math.max(tp,peak);
    const loud=x=>x>0?-.691+10*Math.log10(x):null,mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
    const absolute=blocks.filter(x=>loud(x)!==null&&loud(x)>-70),relative=absolute.length?loud(mean(absolute))-10:null;
    const gated=absolute.filter(x=>loud(x)>relative),lufs=gated.length?loud(mean(gated)):null;
    finished={method:'ITU-R BS.1770-5 48kHz mono/stereo K-weighting, 400ms/75% overlap, -70/-10 gates; 4x 32-tap Hann-windowed sinc true-peak estimate with reflected-start guard',frames,channels:count,sampleRate:48000,lufs,peak,peakDb:peak?20*Math.log10(peak):null,truePeak:tp,truePeakDb:tp?20*Math.log10(tp):null,clippingSamples:clipping,blocks:blocks.length,gatedBlocks:gated.length};return{...finished};
    };
    return{push,finish};
  }
  async function masterMeasure(chunks,options={}){
    const meter=masterMeter();
    for await(const pcm of chunks){options.guard?.();const frames=meter.push(pcm);
      options.guard?.();options.progress?.(frames);if(root.setTimeout)await new Promise(r=>root.setTimeout(r,0));
    }
    return meter.finish();
  }
  const productionPreview={master:null,harmony:null,generation:0,message:''};
  const masterChoices={projectId:null,assetId:null,baseline:null,rows:[]};
  function masterRecipesValidate(rows){
    if(!Array.isArray(rows)||rows.length>32)throw Error('invalid-master-recipes');const ids=new Set();
    for(const r of rows){if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||typeof r.name!=='string'||!r.name.trim()||r.name.length>80||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt)))throw Error('invalid-master-recipe');ids.add(r.id);masterTargets(r.targetLufs,r.ceilingDb)}return rows;
  }
  function masterRecipeCapture(project,assetId,name,targetLufs,ceilingDb){
    masterTargets(targetLufs,ceilingDb);if(typeof name!=='string'||!name.trim()||name.trim().length>80)throw Error('invalid-master-name');
    const updated=clone(project),asset=pcmAsset(updated,assetId),rows=masterRecipesValidate(asset.masterRecipes||[]);if(rows.length>=32)throw Error('master-recipe-capacity');
    asset.masterRecipes=[...rows,{id:uuid(),name:name.trim(),targetLufs,ceilingDb,createdAt:now()}];return pcmUpdated(updated);
  }
  async function masterCompare(id,assetId,target=-14,ceiling=-1){
    if(pcmEditor.busy||archiveTransfer.busy||vocalBusy()||pcmEditor.projectId!==id)return{ok:false,error:'production-busy'};
    const p=state.projects.find(p=>p.projectId===id),baseline=JSON.stringify(p),token=++productionPreview.generation;pcmEditor.busy=true;masterChoices.rows=[];productionPreview.master=null;requestPaint();
    try{masterTargets(target,ceiling);const guard=()=>{if(token!==productionPreview.generation||pcmEditor.projectId!==id||JSON.stringify(state.projects.find(p=>p.projectId===id))!==baseline)throw Error('master-comparison-stale')};
      const targets=[...new Set([Math.max(-36,target-2),target,Math.min(-5,target+2)])],rows=[];
      for(const value of targets){guard();const c=await masterPreview(p,assetId,value,ceiling,{guard});guard();rows.push(c)}
      Object.assign(masterChoices,{projectId:id,assetId,baseline,rows,generation:token});productionPreview.message='複数の実音声候補を測定しました。候補を選び、試聴してから採用してください。';return{ok:true,count:rows.length};
    }catch(e){masterChoices.rows=[];productionPreview.message=e.message;return{ok:false,error:e.message}}finally{pcmEditor.busy=false;requestPaint()}
  }
  function masterChoose(id,index){
    try{const p=state.projects.find(p=>p.projectId===id);if(pcmEditor.busy||pcmEditor.projectId!==id||masterChoices.projectId!==id||masterChoices.generation!==productionPreview.generation||masterChoices.baseline!==JSON.stringify(p)||!Number.isInteger(index)||!masterChoices.rows[index])throw Error('master-comparison-stale');productionPreview.master=clone(masterChoices.rows[index]);requestPaint();return{ok:true}}
    catch(e){productionPreview.message=e.message;requestPaint();return{ok:false,error:e.message}}
  }
  function masterCompareSubmit(event,id){event?.preventDefault?.();const f=event.currentTarget.elements;return masterCompare(id,f.assetId.value,Number(f.target.value),Number(f.ceiling.value))}
  function masterRecipeSave(event,id){event?.preventDefault?.();const c=productionPreview.master,name=event.currentTarget.elements.recipeName.value;if(!c||pcmEditor.projectId!==id||archiveTransfer.busy||vocalBusy())return Promise.resolve({ok:false,error:'master-preview-required'});return pcmCommit(id,p=>{if(c.baseline!==JSON.stringify(p))throw Error('master-preview-stale');return masterRecipeCapture(p,c.assetId,name,c.targetLufs,c.ceilingDb)})}
  async function masterRecipeRecall(id,assetId,recipeId){
    if(pcmEditor.busy||archiveTransfer.busy||vocalBusy()||pcmEditor.projectId!==id)return{ok:false,error:'production-busy'};
    const p=state.projects.find(p=>p.projectId===id),row=pcmAsset(p,assetId).masterRecipes?.find(r=>r.id===recipeId);if(!row)return{ok:false,error:'master-recipe-missing'};
    const event={preventDefault(){},target:{elements:{assetId:{value:assetId},target:{value:row.targetLufs},ceiling:{value:row.ceilingDb}}}};return productionSubmit(event,id,'master');
  }
  function masterOpenFocused(id){if(workspaceBusy()||!state.projects.some(p=>p.projectId===id)||!guardLeave())return false;workspaceExpanded=false;routeTo(`${HOME_ROUTE}/mixing-master/${encodeURIComponent(id)}`);return true}
  function masterFocusedView(id){
    const p=state.projects.find(p=>p.projectId===id);if(!p)return'<main class="music-studio-shell"><p>曲を確認できません。</p></main>';
    pcmMixView(id);const arg=JSON.stringify(id),h=s=>escapeHtml(s),original=productionView(id,p),at=original.indexOf('<h2 data-work-master>'),tail=original.slice(at,original.lastIndexOf('</section>')),valid=masterChoices.projectId===id&&masterChoices.generation===productionPreview.generation&&masterChoices.baseline===JSON.stringify(p),c=productionPreview.master;
    const choices=valid?masterChoices.rows.map((r,i)=>`<button onclick="${h(`MusicStudio.masterChoose(${arg},${i})`)}">${r.targetLufs} LUFS（候補${i+1}） · ${r.after.lufs?.toFixed(2)??'測定不可'} LUFS</button>`).join(''):'';
    const recipes=(p.pcmMix?.assets||[]).flatMap(a=>(a.masterRecipes||[]).map(r=>`<button onclick="${h(`MusicStudio.masterRecipeRecall(${arg},${JSON.stringify(a.id)},${JSON.stringify(r.id)})`)}">${escapeHtml(a.name)} · ${escapeHtml(r.name)} · ${r.targetLufs} LUFS（再作成・試聴）</button>`)).join('');
    let tools=tail;const saved=tools.indexOf('<h3>Saved masters');if(saved>=0)tools=tools.slice(0,saved)+`<details class="music-master-history"><summary>Saved masters（保存済みMaster）</summary>${tools.slice(saved)}</details>`;
    return `<main class="music-studio-shell music-master-focused"><header class="music-vocal-focus-heading"><h1>${escapeHtml(p.songTitle||p.projectName)} · Mastering（仕上げ）</h1><button onclick="${h(`MusicStudio.pcmOpen(${arg})`)}">Mix（ミックスへ）</button></header><section class="music-production-tools music-master-tools">${tools}<form class="music-master-compare" onsubmit="${h(`MusicStudio.masterCompareSubmit(event,${arg})`)}"><label>Audio（比較音声）<select name="assetId">${(p.pcmMix?.assets||[]).map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('')}</select></label><label>Target（中心LUFS）<input name="target" type="number" min="-36" max="-5" value="-14" step=".1" required></label><label>Ceiling（上限dBTP）<input name="ceiling" type="number" min="-12" max="-.1" value="-1" step=".1" required></label><button${pcmEditor.busy?' disabled':''}>Compare masters（複数候補を実処理・比較）</button></form><div class="music-master-choices">${choices}</div><details class="music-master-recipes"><summary>Recipes（名前付き候補設定・再作成）</summary><p>設定だけを保存します。元音声を編集すると再作成する音声も変わります。試聴後に採用してください。</p><form onsubmit="${h(`MusicStudio.masterRecipeSave(event,${arg})`)}"><label>Name（設定名）<input name="recipeName" maxlength="80" required></label><button${c?.baseline===JSON.stringify(p)&&!pcmEditor.busy?'':' disabled'}>Save recipe（候補設定を保存）</button></form>${recipes}</details></section></main>`;
  }
  function productionCancel(){masterChoices.rows=[];productionPreview.abort?.(Error('production-cancelled'));productionPreview.generation++;productionPreview.master=null;productionPreview.harmony=null;productionPreview.message='候補を取り消しました。';pcmStop();requestPaint()}
  // Master-only output gain follows EQ/compression/spatial processing. The
  // channel-strip input gain stays bounded at +/-24 dB for existing projects.
  function masterStatus(m){const gap=m.targetLufs-m.after.lufs;return Math.abs(gap)<=.1?' / Target reached（目標音量に到達）':` / Target difference（目標との差） ${gap.toFixed(2)} LU${m.peakLimited?' / ピーク保護：True Peak上限のため目標未達。追加増幅せず音量バランスやCompression設定を確認してください。':''}${m.gainLimited?' / 増幅上限':''}`;}
  function masterPostGain(value=0){
    if(typeof value!=='number'||!Number.isFinite(value)||value< -60||value>60)throw Error('master-gain-range-exceeded');
    return value;
  }
  function masterGainPlan(before,targetLufs,ceilingDb,current=0){
    masterTargets(targetLufs,ceilingDb);masterPostGain(current);
    if(!before||!Number.isFinite(before.lufs)||!Number.isFinite(before.truePeakDb))throw Error('master-loudness-unavailable-silence-or-short');
    const requested=targetLufs-before.lufs,peakRoom=ceilingDb-before.truePeakDb;
    const gainDb=Math.min(requested,peakRoom,60-current);
    masterPostGain(current+gainDb);
    return{gainDb,requested,peakLimited:peakRoom<requested-.01,gainLimited:60-current<Math.min(requested,peakRoom)-.01};
  }
  async function masterConverge(gainDb,targetLufs,ceilingDb,render,measure,options={}){
    let output,after,passes=0;const measurements=[];
    for(;passes<(options.exactSettings?1:3);passes++){
      options.guard?.();masterPostGain(gainDb);output=await render(gainDb);options.guard?.();after=await measure(output);options.guard?.();
      if(!Number.isFinite(after.lufs)||!Number.isFinite(after.truePeakDb))throw Error('master-output-loudness-unavailable');
      measurements.push({pass:passes+1,gainDb,lufs:after.lufs,truePeakDb:after.truePeakDb,clippingSamples:after.clippingSamples??0,targetDifferenceLu:targetLufs-after.lufs,peakHeadroomDb:ceilingDb-after.truePeakDb});
      const gap=targetLufs-after.lufs,room=ceilingDb-after.truePeakDb;
      if(options.exactSettings||Math.abs(gap)<=.1&&room>=-.002&&!after.clippingSamples)break;
      // Absolute gating can admit more quiet blocks after gain. Correct from the
      // encoded output, always rendering again from the unchanged source/DSP.
      const correction=Math.min(gap,room-.002,60-gainDb);
      if(passes===2||Math.abs(correction)<.005||gainDb+correction< -60)break;
      gainDb+=correction;
    }
    if(after.clippingSamples||after.truePeakDb>ceilingDb+.002)throw Error('master-output-ceiling-exceeded');
    const targetReached=Math.abs(after.lufs-targetLufs)<=.1;
    const reason=targetReached?'target-reached':after.truePeakDb>=ceilingDb-.05?'true-peak-ceiling':gainDb>=59.995?'gain-limit':options.exactSettings?'recalled-settings':'correction-limit';
    return{output,after,gainDb,measurements,reason,passes:passes+1,targetReached,peakLimited:!targetReached&&after.truePeakDb>=ceilingDb-.05,gainLimited:!targetReached&&gainDb>=59.995};
  }
  function masterOutputGain(pcm,gainDb){
    pcmValidate(pcm);const factor=10**(masterPostGain(gainDb)/20);
    const out={sampleRate:pcm.sampleRate,channels:pcm.channels.map(c=>c.map(v=>v*factor))};pcmValidate(out);return out;
  }
  async function masterPreview(project,assetId,targetLufs,ceilingDb,options={}){
    if(!validateProject(project).valid||typeof targetLufs!=='number'||!Number.isFinite(targetLufs)||targetLufs< -36||targetLufs> -5||typeof ceilingDb!=='number'||!Number.isFinite(ceilingDb)||ceilingDb< -12||ceilingDb> -0.1)throw Error('invalid-master-target');
    const asset=pcmMixValidate(project.pcmMix).assets.find(a=>a.id===assetId);if(!asset)throw Error('master-asset-missing');
    const source=pcmRenderAsset(asset),before=await masterMeasure([source],options);options.guard?.();if(before.lufs===null)throw Error('master-loudness-unavailable-silence-or-short');
    // Preserve dynamics: gain is capped by measured true peak, never hard clipping.
    const initial=masterGainPlan(before,targetLufs,ceilingDb),result=await masterConverge(initial.gainDb,targetLufs,ceilingDb,gain=>pcmDecodeWav(pcmEncodeWav(masterOutputGain(source,gain))),pcm=>masterMeasure([pcm],options),options);
    return{format:'nova-master-preview-v1',baseline:JSON.stringify(project),assetId,targetLufs,ceilingDb,before,...result};
  }
  // Measure the saved long-WAV DSP path and actual quantized result in bounded chunks.
  const longMasterProof=new WeakMap();
  function masterTargets(target,ceiling){
    if(!Number.isFinite(target)||target< -36||target> -5||!Number.isFinite(ceiling)||ceiling< -12||ceiling> -.1)throw Error('invalid-master-target');
  }
  async function longMasterPreview(id,assetId,targetLufs,ceilingDb,options={}){
    if(pcmEditor.busy||archiveTransfer.busy)return{ok:false,error:'production-busy'};
    const baseline=JSON.stringify(state.projects.find(p=>p.projectId===id)),target=repository,token=++longMix.generation;
    longMix.candidate=null;longMixStop();pcmEditor.busy=true;requestPaint();
    const snapshot=audioProjectSnapshot(id,baseline),guard=(force=false)=>{if(options.signal?.aborted||token!==longMix.generation||repository!==target||pcmEditor.projectId!==id||!snapshot(force)||state.dirty||midiEditorHasPendingChanges()||state.midiInput.recording||state.midiInput.starting)throw Error('long-master-cancelled-or-stale')};
    const progress=frames=>{guard();pcmEditor.message=`Mastering ${frames} frames`;const el=root.document?.querySelector('[data-long-mix-status]');if(el)el.textContent=pcmEditor.message};
    try{
      masterTargets(targetLufs,ceilingDb);guard();const p=await target.get(id);guard();if(JSON.stringify(p)!==baseline)throw Error('long-master-storage-conflict');
      const asset=p.longWavAssets?.find(a=>a.id===assetId);if(!asset)throw Error('long-master-asset-missing');if(asset.sampleRate!==48000)throw Error('master-48khz-required');
      const source=await pcmLoadLongWav(id,assetId,guard);guard();const h=longMixHistory(asset),saved=h.settings[h.cursor];
      const before=await masterMeasure(pcmRenderLongWav(source,saved),{guard,progress});if(before.lufs===null)throw Error('master-loudness-unavailable-silence-or-short');
      const current=masterPostGain(saved.postGainDb),gain=masterGainPlan(before,targetLufs,ceilingDb,current);
      // Normalize after compression: do not change its detector/input or dynamics.
      let settings=longMixSettings(options.versionSettings||{...saved,postGainDb:current+gain.gainDb},48000);
      const corrected=await masterConverge(masterPostGain(settings.postGainDb),targetLufs,ceilingDb,g=>pcmRenderLongWavBlob(source,{...settings,postGainDb:g},16384,{guard,progress}),r=>masterMeasure(pcmDecodeWavStream(r.blob),{guard,progress}),{guard,exactSettings:!!options.versionSettings});
      settings=longMixSettings({...settings,postGainDb:corrected.gainDb},48000);
      const result=corrected.output,after=corrected.after;guard();
      if(after.frames!==asset.frames||after.channels!==asset.channels||result.sampleRate!==48000)throw Error('long-master-output-mismatch');
      if(JSON.stringify(await target.get(id))!==baseline)throw Error('long-master-storage-conflict');guard(true);
      const mastering={format:'nova-long-master-result-v1',sourceAssetId:assetId,targetLufs,ceilingDb,gainDb:masterPostGain(settings.postGainDb)-current,before,after,peakLimited:corrected.peakLimited,gainLimited:corrected.gainLimited,targetReached:corrected.targetReached,passes:corrected.passes,measurements:corrected.measurements,loudnessReason:corrected.reason};
      const candidate={ok:true,...result,baseline,assetId,name:asset.name,settings,mastering};
      longMasterProof.set(candidate,JSON.stringify({baseline,assetId,settings,mastering}));longMix.candidate=candidate;
      pcmEditor.message='長時間Master候補を作成しました。A/B比較後に保存してください。';return candidate;
    }catch(e){pcmEditor.message='Masteringできません：'+e.message;return{ok:false,error:e.message}}
    finally{pcmEditor.busy=false;requestPaint()}
  }
  async function longMasterCompare(id,assetId,target,ceiling){
    try{masterTargets(target,ceiling)}catch(e){return{ok:false,error:e.message}}
    longMix.masterChoices=null;const choices=[];let expected=longMix.generation;
    for(const lufs of [...new Set([target,-14,-18])]){if(longMix.generation!==expected)return{ok:false,error:'long-master-comparison-cancelled'};expected++;const c=await longMasterPreview(id,assetId,lufs,ceiling);if(longMix.generation!==expected)return{ok:false,error:'long-master-comparison-cancelled'};if(!c.ok){longMix.masterChoices=null;return c}choices.push(c)}
    longMix.masterChoices=choices;longMix.masterChoicesGeneration=longMix.generation;requestPaint();return{ok:true,count:choices.length};
  }
  function longMasterSelect(id,assetId,index){
    const c=longMix.masterChoices?.[index];
    if(pcmEditor.busy||archiveTransfer.busy||longMix.masterChoicesGeneration!==longMix.generation||!Number.isInteger(index)||!c||c.assetId!==assetId||pcmEditor.projectId!==id||c.baseline!==JSON.stringify(state.projects.find(p=>p.projectId===id))||longMasterProof.get(c)!==JSON.stringify({baseline:c.baseline,assetId:c.assetId,settings:c.settings,mastering:c.mastering}))return{ok:false,error:'long-master-choice-stale'};
    longMixStop();longMix.candidate=c;pcmEditor.message='選択したMaster候補の音量だけを採用対象にしました。';requestPaint();return{ok:true};
  }
  function longMasterInvalidate(){longMix.generation++;longMix.candidate=null;longMix.masterChoices=null;longMixStop();pcmEditor.message='設定を変更しました。Master候補を再作成してください。'}
  function longMasterCompareSubmit(button,id,assetId){const f=button.form.elements;return longMasterCompare(id,assetId,Number(f.target.value),Number(f.ceiling.value))}
  function longMasterSubmit(event,id,assetId){event?.preventDefault?.();const f=event.currentTarget.elements;return longMasterPreview(id,assetId,Number(f.target.value),Number(f.ceiling.value))}
  function longMasterWorkspaceState(p){
    const w=p.longMasterWorkspace===undefined?{format:'nova-long-master-workspace-v1',selectedAssetId:''}:p.longMasterWorkspace;
    if(!w||Array.isArray(w)||w.format!=='nova-long-master-workspace-v1'||typeof w.selectedAssetId!=='string'||(w.selectedAssetId&&!(p.longWavAssets||[]).some(a=>a.id===w.selectedAssetId)))throw Error('long-master-workspace-invalid');
    return w;
  }
  function longMasterOpenFocused(id){if(workspaceBusy()||!state.projects.some(p=>p.projectId===id)||!guardLeave())return false;workspaceExpanded=false;routeTo(`${HOME_ROUTE}/mixing-long-master/${encodeURIComponent(id)}`);return true}
  function longMasterSelectAsset(id,assetId){
    if(pcmEditor.busy||archiveTransfer.busy||vocalBusy()||!(state.projects.find(p=>p.projectId===id)?.longWavAssets||[]).some(a=>a.id===assetId))return Promise.resolve({ok:false,error:'long-master-source-busy-or-missing'});
    longMixCancel();const token=longMix.generation,guard=()=>{if(token!==longMix.generation)throw Error('long-mix-cancelled')};guard.registerAbort=abort=>{longMix.abort=abort};guard.clearAbort=()=>{longMix.abort=null};
    return pcmCommit(id,p=>{const updated=clone(p);updated.longMasterWorkspace={format:'nova-long-master-workspace-v1',selectedAssetId:assetId};return productionRevision(updated)},pcmEditor.generation,guard);
  }
  function longMasterFocusedView(id){
    const p=state.projects.find(p=>p.projectId===id);if(!p)return'<main class="music-studio-shell"><p>曲を確認できません。</p></main>';
    pcmMixView(id);const assets=p.longWavAssets||[],selected=longMasterWorkspaceState(p).selectedAssetId,asset=assets.find(a=>a.id===selected)||assets.find(a=>a.sampleRate===48000)||assets[0],arg=JSON.stringify(id),h=escapeHtml,aid=JSON.stringify(asset?.id),c=longMix.candidate,valid=Boolean(c&&asset&&c.assetId===asset.id&&c.baseline===JSON.stringify(p)),disabled=pcmEditor.busy?' disabled':'';
    const history=asset?longMixHistory(asset):null;
    return`<main class="music-studio-shell music-master-focused music-long-master-focused"><header class="music-vocal-focus-heading"><h1>${h(p.songTitle||p.projectName)} · Long Mastering（長時間仕上げ）</h1><button onclick="${h(`MusicStudio.pcmOpen(${arg})`)}">Mix（ミックスへ）</button></header><section class="music-master-tools"><label>Source（元音声）<select data-long-master-source onchange="${h(`MusicStudio.longMasterSelectAsset(${arg},this.value)`)}"${disabled}>${assets.map(a=>`<option value="${h(a.id)}"${a.id===asset?.id?' selected':''}>${h(a.name)}</option>`).join('')}</select></label><p role="status" aria-live="polite" data-long-mix-status>${h(pcmEditor.message)}</p>${asset?`${longMasterView(id,asset,true)}<div class="music-long-master-actions">${[['Original','Original（元音声）'],['A','A（保存済み）'],['B','B（候補）']].map(([side,label])=>`<button onclick="${h(`MusicStudio.longMixListen(${arg},${aid},${JSON.stringify(side)})`)}"${disabled||(side==='B'&&!valid?' disabled':'')}>${label}</button>`).join('')}<button onclick="MusicStudio.longMixCancel()">Cancel / Stop（取消・停止）</button><button class="music-long-adopt" onclick="${h(`MusicStudio.longMixSave(${arg},${aid})`)}"${disabled||(!valid?' disabled':'')}>Apply / Save（候補を採用・保存）</button></div><details class="music-long-master-history"><summary>History / Export（履歴・書き出し）</summary><p>履歴 ${history.cursor+1}/${history.settings.length} · 元WAVは保持</p><div class="music-action-row"><button onclick="${h(`MusicStudio.longMixSave(${arg},${aid},-1)`)}"${disabled||(!history.cursor?' disabled':'')}>Undo（元に戻す）</button><button onclick="${h(`MusicStudio.longMixSave(${arg},${aid},1)`)}"${disabled||(history.cursor===history.settings.length-1?' disabled':'')}>Redo（やり直す）</button><button onclick="${h(`MusicStudio.longMixExport(${arg},${aid})`)}"${disabled}>Processed WAV（加工済み書出し）</button></div></details>${longMixVersionsView(id,asset)}`:'<p>Mix画面から元WAVを保存してください。</p>'}</section></main>`;
  }
  function longMasterView(id,asset,focused=false){
    const arg=JSON.stringify(String(id)).replace(/</g,'\\u003c'),aid=JSON.stringify(String(asset.id)).replace(/</g,'\\u003c'),handler=escapeHtml;
    const c=longMix.candidate,m=c?.assetId===asset.id&&c.baseline===JSON.stringify(state.projects.find(p=>p.projectId===id))?c.mastering:null;
    const metric=v=>`${v.lufs===null?'測定不可':v.lufs.toFixed(2)} LUFS / ${v.truePeakDb===null?'無音':v.truePeakDb.toFixed(2)} dBTP`;
    if(asset.sampleRate!==48000)return'<p>長時間MasterのLUFS・True Peak測定は48 kHz mono/stereo限定です。他sample rateは未対応です。</p>';
    return`<section class="music-setting-section music-long-master-panel"><h3>Long Mastering（長時間・最終音量候補）</h3>${focused?'<details class="music-long-master-help"><summary>Help（処理の範囲）</summary>':''}<p>分割PCM処理・48 kHz限定。元WAVは保持。音量だけ変更し、保存済みEQ・圧縮・左右設定を保持します。規格適合試験は未完了。</p>${focused?'</details>':''}<form oninput="MusicStudio.longMasterInvalidate()" onsubmit="${handler(`MusicStudio.longMasterSubmit(event,${arg},${aid})`)}"><div class="music-form-grid"><label>Target（目標LUFS）<input name="target" type="number" min="-36" max="-5" step=".1" value="${m?.targetLufs??-14}" required></label><label>Ceiling（上限dBTP）<input name="ceiling" type="number" min="-12" max="-.1" step=".1" value="${m?.ceilingDb??-1}" required></label></div><button${pcmEditor.busy?' disabled':''}>Preview Long Master（実音声候補）</button><button type="button" onclick="${handler(`MusicStudio.longMasterCompareSubmit(this,${arg},${aid})`)}"${pcmEditor.busy?' disabled':''}>Compare Masters（音量候補を比較）</button></form>${(longMix.masterChoicesGeneration===longMix.generation?longMix.masterChoices||[]:[]).filter(v=>v.assetId===asset.id&&v.baseline===JSON.stringify(state.projects.find(p=>p.projectId===id))).map((v,i)=>`<p>${v.mastering.targetLufs} LUFS → ${metric(v.mastering.after)} <button onclick="${handler(`MusicStudio.longMasterSelect(${arg},${aid},${i})`)}"${pcmEditor.busy?' disabled':''}>音量だけを候補に選択</button></p>`).join('')}${m?`<p>A: ${metric(m.before)}<br>B: ${metric(m.after)} / Gain ${m.gainDb.toFixed(2)} dB${masterStatus(m)}</p>`:''}${focused?'':'<p>A/B・Save・Undo・Redo・Processed WAVは下の長時間音声ボタンを使えます。Full WAV Archiveは元音声・設定・測定記録を含みます。</p>'}</section>`;
  }
  function harmonyPreview(project,input){
    if(!validateProject(project).valid||!input||!Number.isInteger(input.tonic)||input.tonic<0||input.tonic>11||!['major','minor'].includes(input.scale)||![-4,-2,2,4].includes(input.steps)||!Number.isInteger(input.low)||!Number.isInteger(input.high)||input.low<0||input.high>127||input.low>input.high)throw Error('invalid-harmony-input');
    const track=(project.midiData?.tracks||[]).filter(t=>t.id===input.trackId);if(track.length!==1)throw Error('harmony-track-identity');
    const notes=track[0].notes||[];
    // Reuse exact note/monophonic range validation, including duplicate IDs/drums.
    const binding=lyricsAssignmentPreview(project,{trackId:input.trackId,fromNote:input.fromNote,toNote:input.toNote,text:'Harmony',reading:Array(Math.max(0,Math.min(4096,input.toNote-input.fromNote+1))).fill('la').join(' ')});
    const degrees=input.scale==='major'?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10],scale=[];for(let p=0;p<=127;p++)if(degrees.includes((p-input.tonic+12)%12))scale.push(p);
    const result=binding.assignments.map(a=>{const index=scale.indexOf(a.pitch);if(index<0)throw Error('harmony-source-outside-key');let pitch=scale[index+input.steps];if(pitch===undefined)throw Error('harmony-midi-range');while(pitch<input.low)pitch+=12;while(pitch>input.high)pitch-=12;if(pitch<input.low||pitch>input.high)throw Error('harmony-vocal-range');const source=notes.find(n=>n.id===a.noteId);if(pitch===source.pitch)throw Error('harmony-unison-collision');if((input.steps>0&&pitch<source.pitch)||(input.steps<0&&pitch>source.pitch))throw Error('harmony-voice-crossing');return{...clone(source),sourceNoteId:a.noteId,pitch}});
    // Carry only complete, current lyric syllables; never invent lyrics or repair stale bindings.
    const selected=new Set(result.map(n=>n.sourceNoteId)),lyricRecords=[];
    for(const record of lyricsSavedRows(project).filter(r=>r.trackId===input.trackId)){
      if(!Array.isArray(record.assignments))throw Error('harmony-invalid-lyrics');
      const assignments=record.assignments.filter(a=>selected.has(a.noteId));if(!assignments.length)continue;
      if(record.stale)throw Error('harmony-stale-lyrics');
      const syllables=new Set(assignments.map(a=>a.syllableIndex));
      if(record.assignments.some(a=>syllables.has(a.syllableIndex)&&!selected.has(a.noteId)))throw Error('harmony-partial-syllable');
      if(lyricRecords.some(r=>r.assignments.some(a=>assignments.some(b=>a.noteId===b.noteId))))throw Error('harmony-ambiguous-lyrics');
      lyricRecords.push({sourceRecordId:record.id,text:record.text,assignments:clone(assignments)});
    }
    return{format:'nova-harmony-preview-v1',baseline:JSON.stringify(project),input:clone(input),notes:result,lyricRecords,method:'Local diatonic thirds/fifths; major or natural minor, octave fit, unison/crossing rejection, complete lyric syllable transfer. Chord voicing and voice synthesis pending.'};
  }
  function productionRevision(p){p.revision++;p.updatedAt=now();if(p.aiWorkspace)p.aiWorkspace=rebindAIWorkspace(p.aiWorkspace,p.projectId,p.revision);if(!validateProject(p).valid)throw Error('invalid-production-result');return p}
  async function productionSave(id,kind){
    const preview=productionPreview[kind],token=productionPreview.generation;
    if(!['master','harmony'].includes(kind)||!preview)return{ok:false,error:'production-preview-required'};
    const guard=()=>{if(token!==productionPreview.generation)throw Error('production-cancelled')};guard.registerAbort=abort=>{productionPreview.abort=abort};guard.clearAbort=()=>{productionPreview.abort=null};
    // Verification can be asynchronous; perform it before entering the CAS commit.
    let verified;try{if(pcmEditor.busy||archiveTransfer.busy)throw Error('production-busy');const p=state.projects.find(p=>p.projectId===id);if(preview.baseline!==JSON.stringify(p))throw Error('production-preview-stale');verified=kind==='master'?await masterPreview(p,preview.assetId,preview.targetLufs,preview.ceilingDb,{guard}):harmonyPreview(p,preview.input);guard();if(JSON.stringify(verified)!==JSON.stringify(preview))throw Error('production-preview-modified')}catch(e){productionPreview.message=e.message;requestPaint();return{ok:false,error:e.message}}
    const r=await pcmCommit(id,p=>{guard();if(preview.baseline!==JSON.stringify(p))throw Error('production-preview-stale');const out=clone(p);
      if(kind==='master'){const name=out.pcmMix.assets.find(a=>a.id===preview.assetId).name;const imported=pcmImport(out,preview.output,name.replace(/\.wav$/i,'')+'-master.wav');imported.masteringNotes.push({format:'nova-master-result-v1',sourceAssetId:preview.assetId,resultAssetId:imported.pcmMix.assets.at(-1).id,targetLufs:preview.targetLufs,ceilingDb:preview.ceilingDb,gainDb:preview.gainDb,before:preview.before,after:preview.after,createdAt:now()});if(pcmJsonBytes(imported)>PCM_JSON_LIMIT||!validateProject(imported).valid)throw Error('invalid-master-result');return imported}
      const trackId=uuid(),notes=verified.notes.map(n=>({...n,id:uuid()}));out.midiData.tracks.push({id:trackId,name:'Harmony',roleAssignment:'vocal',trackType:'midi-melodic',channel:1,notes});const lyricRecordIds=[];
      for(const record of verified.lyricRecords){
        const assignments=record.assignments.map(a=>{const note=notes.find(n=>n.sourceNoteId===a.noteId);return{...clone(a),noteId:note.id,pitch:note.pitch}}),id=uuid();
        (out.syllableAssignments||(out.syllableAssignments=[])).push({format:LYRICS_ASSIGNMENT_FORMAT,version:1,id,trackId,text:record.text,reading:assignments.map(a=>a.token).join(' '),assignments,sourceRecordId:record.sourceRecordId,createdAt:now()});lyricRecordIds.push(id);
      }
      out.productionHistory.push({format:'nova-harmony-result-v1',trackId,sourceTrackId:verified.input.trackId,input:verified.input,lyricRecordIds,method:verified.method,createdAt:now()});return productionRevision(out);
    },pcmEditor.generation,guard);
    if(r.ok){productionPreview[kind]=null;productionPreview.message='採用結果を保存しました。元データは保持しています。'}else productionPreview.message=r.error;requestPaint();return r;
  }
  async function productionSubmit(event,id,kind){event?.preventDefault?.();if(pcmEditor.busy||archiveTransfer.busy)return{ok:false,error:'production-busy'};
    masterChoices.rows=[];const form=event?.target,token=++productionPreview.generation,p=state.projects.find(p=>p.projectId===id),baseline=JSON.stringify(p);productionPreview[kind]=null;
    try{const f=form.elements,guard=()=>{if(token!==productionPreview.generation||JSON.stringify(state.projects.find(p=>p.projectId===id))!==baseline||pcmEditor.projectId!==id)throw Error('production-cancelled-or-stale')};
      let candidate;if(kind==='master'){pcmEditor.busy=true;candidate=await masterPreview(p,f.assetId.value,Number(f.target.value),Number(f.ceiling.value),{guard})}else candidate=harmonyPreview(p,{trackId:f.trackId.value,fromNote:Number(f.first.value),toNote:Number(f.last.value),tonic:Number(f.tonic.value),scale:f.scale.value,steps:Number(f.steps.value),low:Number(f.low.value),high:Number(f.high.value)});
      guard();productionPreview[kind]=candidate;productionPreview.message='候補を確認し、試聴してから採用してください。';return{ok:true};
    }catch(e){productionPreview.message=e.message;return{ok:false,error:e.message}}finally{if(kind==='master')pcmEditor.busy=false;requestPaint()}
  }
  async function productionListen(id,kind,side){
    try{const p=state.projects.find(p=>p.projectId===id),candidate=productionPreview[kind];if(!candidate||candidate.baseline!==JSON.stringify(p)||!['A','B'].includes(side))throw Error('production-preview-stale');
      let pcm;if(kind==='master')pcm=side==='B'?candidate.output:pcmRenderAsset(p.pcmMix.assets.find(a=>a.id===candidate.assetId));
      else{const notes=side==='B'?candidate.notes:p.midiData.tracks.find(t=>t.id===candidate.input.trackId).notes.filter(n=>candidate.notes.some(x=>x.sourceNoteId===n.id));pcm=harmonyTone(p,notes)}
      pcmStop();const C=root.AudioContext||root.webkitAudioContext;if(!C)throw Error('audio-playback-unavailable');const context=new C(),buffer=context.createBuffer(pcm.channels.length,pcm.channels[0].length,pcm.sampleRate);pcm.channels.forEach((c,i)=>buffer.copyToChannel(new Float32Array(c),i));const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);pcmPlayback={context,source};await context.resume();if(pcmPlayback?.source!==source)throw Error('production-playback-cancelled');source.start();source.onended=()=>{if(pcmPlayback?.source===source)pcmStop()};return{ok:true};
    }catch(e){pcmStop();productionPreview.message=e.message;requestPaint();return{ok:false,error:e.message}}
  }
  function harmonyTone(project,notes){
    if(project.midiData?.tempoChanges?.length)throw Error('harmony-preview-tempo-changes-not-supported');
    const ppq=project.midiData?.ppq;if(!Number.isSafeInteger(ppq)||ppq<1)throw Error('harmony-ppq-required');
    const map=project.midiData?.tempoMap||[];if(!Array.isArray(map)||map.some(t=>!Number.isSafeInteger(t.tick)||t.tick<0||!Number.isFinite(t.bpm)||t.bpm<20||t.bpm>400))throw Error('harmony-invalid-tempo-map');const byTick=new Map([[0,project.midiData?.tempo||project.musicalSettings.bpm]]);for(const t of map)byTick.set(t.tick,t.bpm);const tempos=[...byTick].sort((a,b)=>a[0]-b[0]);const duration=(from,to)=>{let seconds=0,at=from;while(at<to){const bpm=tempos.filter(t=>t[0]<=at).at(-1)[1],next=tempos.find(t=>t[0]>at)?.[0]??to,end=Math.min(next,to);seconds+=(end-at)*60/(bpm*ppq);at=end}return seconds};const start=Math.min(...notes.map(n=>n.startTick)),end=Math.max(...notes.map(n=>n.startTick+n.durationTicks)),frames=Math.ceil(duration(start,end)*48000);
    if(frames<1||frames>PCM_LIMIT)throw Error('harmony-audition-capacity');const samples=Array(frames).fill(0);
    for(const note of notes){const from=Math.round(duration(start,note.startTick)*48000),length=Math.round(duration(note.startTick,note.startTick+note.durationTicks)*48000),frequency=440*2**((note.pitch-69)/12);for(let i=0;i<length&&from+i<frames;i++){const envelope=Math.min(1,i/240,(length-i)/240);samples[from+i]+=.15*envelope*Math.sin(2*Math.PI*frequency*i/48000)}}return{sampleRate:48000,channels:[samples]};
  }
  function productionView(id,project){
    const arg=JSON.stringify(String(id)).replace(/</g,'\\u003c'),handler=s=>escapeHtml(s),busy=pcmEditor.busy?' disabled':'',valid=k=>productionPreview[k]?.baseline===JSON.stringify(project),actions=k=>valid(k)?`<button onclick="${handler(`MusicStudio.productionListen(${arg},'${k}','A')`)}">Before（採用前）</button><button onclick="${handler(`MusicStudio.productionListen(${arg},'${k}','B')`)}">After（候補）</button><button${busy} onclick="${handler(`MusicStudio.productionSave(${arg},'${k}')`)}">Apply / Save（候補を採用・保存）</button>`:'';
    const m=productionPreview.master,h=productionPreview.harmony,hv=valid('harmony')?h.input:{};
    const metric=v=>`${v.lufs===null?'測定不可':v.lufs.toFixed(2)} LUFS / ${v.truePeakDb===null?'無音':v.truePeakDb.toFixed(2)} dBTP / ${v.clippingSamples} clipping`;
    return`<section class="music-production-tools music-setting-section" aria-label="Harmony and Mastering candidates"><h2 data-work-harmony>Harmony（ハーモニーMIDI）</h2><p>主旋律の選択音符から長調・自然短調の3度／5度候補を作ります。試聴は確認用の音色です。主旋律と同音・声部交差になる候補は拒否します。選択範囲の保存済み歌詞は完全な音節単位で別Trackへ引き継ぎ、LyricsのMusicXML・Sinsy生成で利用できます。</p><form onsubmit="${handler(`MusicStudio.productionSubmit(event,${arg},'harmony')`)}"><div class="music-form-grid"><label>Track（主旋律）<select name="trackId" required>${(project.midiData?.tracks||[]).map(t=>`<option value="${escapeHtml(t.id)}"${t.id===hv.trackId?' selected':''}>${escapeHtml(t.name||t.id)}</option>`).join('')}</select></label><label>First / Last（開始／終了音符番号）<input name="first" type="number" value="${hv.fromNote??1}" min="1" required><input name="last" type="number" value="${hv.toNote??1}" min="1" required></label><label>Key（調）<select name="tonic">${['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map((n,i)=>`<option value="${i}"${i===hv.tonic?' selected':''}>${n}</option>`).join('')}</select><select name="scale"><option value="major"${hv.scale==='major'?' selected':''}>Major（長調）</option><option value="minor"${hv.scale==='minor'?' selected':''}>Natural minor（自然短調）</option></select></label><label>Interval（声部）<select name="steps"><option value="2"${hv.steps===2?' selected':''}>上3度</option><option value="-2"${hv.steps===-2?' selected':''}>下3度</option><option value="4"${hv.steps===4?' selected':''}>上5度</option><option value="-4"${hv.steps===-4?' selected':''}>下5度</option></select></label><label>Range（MIDI音域）<input name="low" type="number" value="${hv.low??48}" min="0" max="127" required><input name="high" type="number" value="${hv.high??84}" min="0" max="127" required></label></div><button${busy}>Preview harmony（候補作成）</button></form>${valid('harmony')?`<p>${h.notes.map(n=>`${escapeHtml(n.sourceNoteId)} → MIDI ${n.pitch}`).join(' / ')} / Lyrics（引継ぎ）: ${h.lyricRecords.length}</p>`:''}${actions('harmony')}<h2 data-work-master>Mastering（最終音量候補）</h2><button class="music-master-focus-open" onclick="${handler(`MusicStudio.masterOpenFocused(${arg})`)}">Master workspace（仕上げ専用画面）</button><p>48 kHz・mono/stereoの短いPCM音声が対象。K-weighting＋ゲートと4倍補間で測定。ピーク上限で音量増加を制限し、元音声を残して新しいMasterを保存します。目標に届かない場合も表示します。規格適合試験は未完了。</p><form onsubmit="${handler(`MusicStudio.productionSubmit(event,${arg},'master')`)}"><div class="music-form-grid"><label>Audio（対象）<select name="assetId" required>${(project.pcmMix?.assets||[]).map(a=>`<option value="${escapeHtml(a.id)}"${valid('master')&&a.id===m.assetId?' selected':''}>${escapeHtml(a.name)}</option>`).join('')}</select></label><label>Target（目標LUFS）<input name="target" type="number" min="-36" max="-5" step=".1" value="${valid('master')?m.targetLufs:-14}" required></label><label>Ceiling（上限dBTP）<input name="ceiling" type="number" min="-12" max="-.1" step=".1" value="${valid('master')?m.ceilingDb:-1}" required></label></div><button${busy}>Preview master（実音声候補）</button></form>${valid('master')?`<p>Before: ${metric(m.before)}<br>After: ${metric(m.after)} / Gain ${m.gainDb.toFixed(2)} dB${masterStatus(m)}</p>`:''}${actions('master')}<p role="status">${escapeHtml(productionPreview.message)}</p><button onclick="MusicStudio.productionCancel()">Cancel（候補取消）</button><button onclick="MusicStudio.pcmStop()">Stop（試聴停止）</button><h3>Saved masters（保存済みMaster）</h3>${(project.masteringNotes||[]).filter(n=>n.format==='nova-master-result-v1').map(n=>`<p>${escapeHtml(n.resultAssetId)} / ${escapeHtml(n.after?.lufs)} LUFS</p>`).join('')}<p>保存したMasterはAudioで選択してWAVを書き出せます。Harmonyは共通MIDIエディターで編集・MIDI書出しできます。</p></section>`;
  }


  // Explicit audio routing. No synthetic MIDI sound or automatic take selection.
  const finalExport={busy:false,generation:0,candidate:null,message:'',audio:null,url:null,playGeneration:0};
  const finalExportProof=new WeakMap();
  const midiRenderPanel={open:false,selectedTracks:new Map()};
  let midiStemBatch=null;
  async function midiRenderStems(id,trackIds){
    if(midiStemBatch||workspaceBusy()||lyricsEditor.busy||finalExport.busy||shutdownPromise)return{ok:false,error:'midi-stem-batch-busy'};
    const p=state.projects.find(p=>p.projectId===id);
    if(!p||!Array.isArray(trackIds)||!trackIds.length||trackIds.length>32||new Set(trackIds).size!==trackIds.length||trackIds.some(id=>typeof id!=='string'||!p.midiData?.tracks?.some(t=>t.id===id&&!t.muted&&t.notes?.length)))return{ok:false,error:'midi-stem-batch-selection'};
    const owner={},token=pcmEditor.generation,target=repository,completed=[];
    let baseline=JSON.stringify(p);midiStemBatch=owner;
    try{
      for(const trackId of trackIds){
        if(token!==pcmEditor.generation||target!==repository||JSON.stringify(state.projects.find(p=>p.projectId===id))!==baseline)throw Error('midi-stem-batch-cancelled-or-stale');
        const result=await midiRenderForMix(id,trackId,owner);
        if(!result.ok)throw Error(result.error);
        completed.push({trackId,assetId:result.assetId});baseline=JSON.stringify(result.project);
      }
      pcmEditor.message=`Stem保存 ${completed.length}/${trackIds.length}。Sourcesで選択できます。`;
      return{ok:true,completed};
    }catch(error){pcmEditor.message=`Stem保存 ${completed.length}/${trackIds.length}。保存済み成果は保持しました：${error.message}`;return{ok:false,error:error.message,completed}}
    finally{if(midiStemBatch===owner)midiStemBatch=null;requestPaint()}
  }
  // Bounded snapshot checks during expensive PCM loops; publication always
  // performs a fresh full comparison. Cancellation and dirty flags stay immediate.
  function audioProjectSnapshot(id,baseline){let last=-Infinity;return(force=false)=>{const clock=root.performance?.now?.()??Date.now();if(force===true||clock<last||clock-last>=50){if(JSON.stringify(state.projects.find(p=>p.projectId===id))!==baseline)return false;last=root.performance?.now?.()??Date.now()}return true}}
  async function midiStemZip(id,assetIds,download=false){
    if(midiStemBatch||workspaceBusy()||lyricsEditor.busy||finalExport.busy||shutdownPromise)return{ok:false,error:'midi-stem-export-busy'};
    const p=state.projects.find(p=>p.projectId===id),target=repository,token=pcmEditor.generation,baseline=JSON.stringify(p);
    if(!p||state.dirty||midiEditorHasPendingChanges()||!Array.isArray(assetIds)||!assetIds.length||assetIds.length>32||new Set(assetIds).size!==assetIds.length)return{ok:false,error:'midi-stem-export-selection'};
    const assets=assetIds.map(id=>p.longWavAssets?.find(a=>a.id===id&&a.midiRender?.stemTrackId));
    if(assets.some(a=>!a))return{ok:false,error:'midi-stem-export-selection'};
    const estimated=22+assets.reduce((n,a,i)=>n+a.size+76+2*(`Stem-${i+1}.wav`.length),0);
    if(!Number.isSafeInteger(estimated)||estimated>512*1048576)return{ok:false,error:'midi-stem-export-512mib-limit'};
    pcmEditor.busy=true;
    const snapshot=audioProjectSnapshot(id,baseline),guard=(force=false)=>{if(target!==repository||token!==pcmEditor.generation||!snapshot(force)||state.dirty||midiEditorHasPendingChanges()||shutdownPromise)throw Error('midi-stem-export-cancelled-or-stale')};
    try{
      guard();if(JSON.stringify(await target.get(id))!==baseline)throw Error('midi-stem-export-storage-conflict');
      const files=[];
      for(const [i,a]of assets.entries()){guard();pcmEditor.message=`Packaging Stems（楽器別WAVをまとめています） ${i+1}/${assets.length}`;requestPaint();files.push({name:`Stem-${i+1}.wav`,blob:await pcmLoadLongWav(id,a.id)})}
      const zip=await finalZip(files,guard,progress=>{guard();const message=`Packaging Stems（楽器別WAV） ${Math.floor(progress.ratio*100)}%`;if(pcmEditor.message!==message){pcmEditor.message=message;requestPaint()}});guard();if(JSON.stringify(await target.get(id))!==baseline)throw Error('midi-stem-export-storage-conflict');guard(true);
      if(download){if(!root.document||!root.URL?.createObjectURL)throw Error('midi-stem-export-download-unavailable');const url=root.URL.createObjectURL(zip);try{const link=root.document.createElement('a');link.href=url;link.download='Stems.zip';root.document.body.appendChild(link);link.click();link.remove()}finally{root.setTimeout?.(()=>root.URL.revokeObjectURL(url),1000)}}
      pcmEditor.message=`Stem ZIP ${zip.size} bytes。${download?'ブラウザへ保存を依頼しました（完了未確認）。':'作成しました。'}`;
      return{ok:true,zip,files,completion:download?'browser-download-requested':'prepared'};
    }catch(error){pcmEditor.message='Stem ZIPを書き出せません：'+error.message;return{ok:false,error:error.message}}
    finally{pcmEditor.busy=false;requestPaint()}
  }
  async function midiRenderForMix(id,trackId=null,batchOwner=null){
    if(midiStemBatch&&batchOwner!==midiStemBatch)return{ok:false,error:'midi-stem-batch-busy'};
    if(workspaceBusy()||lyricsEditor.busy||finalExport.busy||shutdownPromise)return{ok:false,error:'midi-render-production-busy'};
    const target=repository,p=state.projects.find(p=>p.projectId===id),baseline=JSON.stringify(p),token=pcmEditor.generation;
    if(!p||!validateProject(p).valid||state.dirty||midiEditorHasPendingChanges())return{ok:false,error:'midi-render-save-first'};
    if(target.kind!=='indexeddb'||typeof target.putLongWav!=='function')return{ok:false,error:'long-wav-durable-storage-required'};
    pcmEditor.busy=true;pcmEditor.message='Rendering MIDI（演奏音を音声化しています）';requestPaint();
    const snapshot=audioProjectSnapshot(id,baseline),guard=(force=false)=>{if(target!==repository||token!==pcmEditor.generation||!snapshot(force)||state.dirty||midiEditorHasPendingChanges()||state.midiInput.recording||state.midiInput.starting||vocalBusy()||archiveTransfer.busy||shutdownPromise)throw Error('midi-render-cancelled-or-stale')};
    try{
      guard();if(JSON.stringify(await target.get(id))!==baseline)throw Error('midi-render-storage-conflict');
      if(trackId!==null&&(typeof trackId!=='string'||!p.midiData.tracks.some(t=>t.id===trackId)))throw Error('midi-render-invalid-track-selection');
      const audio=root.MusicStudioAudio,onProgress=progress=>{guard();pcmEditor.message=`Rendering MIDI（演奏音を音声化） ${Math.floor(progress.ratio*100)}%`;requestPaint()};
      const result=await (audio.renderMidiStream||audio.renderMidi)(clone(p.midiData),instrumentEntries(p),{guard,onProgress,...(trackId===null?{}:{trackIds:[trackId]})});
      if(root.navigator?.storage?.estimate){const estimate=await root.navigator.storage.estimate();guard();const available=estimate.quota-estimate.usage;if(Number.isFinite(available)&&available<result.frames*4+1048576)throw Error('midi-render-storage-capacity')}
      async function* chunks(){for(let at=0;at<result.frames;at+=16384){guard();yield{sampleRate:48000,channels:[0,1].map(c=>Array.from(result.buffer.getChannelData(c).subarray(at,Math.min(at+16384,result.frames))))};if(root.setTimeout)await new Promise(r=>root.setTimeout(r,0))}}
      const blob=await finalWav(result.chunks||chunks(),guard);pcmEditor.message='Saving MIDI audio（音声を保存しています）';requestPaint();const hashes=await longWavDigest(blob,guard);guard();
      const assetId=uuid(),updated=clone(p),name=trackId===null?`MIDI Render（演奏音） r${p.revision}.wav`:`Stem ${p.midiData.tracks.find(t=>t.id===trackId).name||trackId} r${p.revision}.wav`;
      updated.longWavAssets=[...(updated.longWavAssets||[]),{id:assetId,name,size:blob.size,frames:result.frames,sampleRate:48000,channels:2,hashes,midiRender:{sourceRevision:p.revision,trackIds:result.trackIds,noteCount:result.noteCount,seconds:result.seconds,tail:result.tail,...(trackId===null?{}:{stemTrackId:trackId})}}];
      updated.revision++;updated.updatedAt=now();if(updated.aiWorkspace)updated.aiWorkspace=rebindAIWorkspace(updated.aiWorkspace,id,updated.revision);automaticEditRecord(p,updated,'audio-editor');
      if(!validateProject(updated).valid)throw Error('midi-render-invalid-project');
      await target.putLongWav(updated,{id:assetId,blob,hashes},baseline,()=>guard(true));guard(true);
      state.projects=state.projects.map(v=>v.projectId===id?updated:v);finalInvalidate();
      pcmEditor.message='MIDI演奏音を保存しました。Mix・Long Mastering・ExportのSourcesで選択できます。完全復元にはFull WAV Archiveを使ってください。';
      return{ok:true,project:updated,assetId};
    }catch(error){pcmEditor.message='音声化できません：'+error.message;return{ok:false,error:error.message}}
    finally{pcmEditor.busy=false;requestPaint()}
  }
  function midiRenderView(p){return `<details class="music-midi-render"${midiRenderPanel.open?' open':''} ontoggle="if(this.isConnected)MusicStudio.midiRenderPanel.open=this.open"><summary style="color:#eef6ff;background:#112031">MIDI Audio（演奏音をMixへ）</summary><p>保存済みMIDIを現在の簡易音源・指定サンプルで音声化します。8分・2万音符まで、48 kHz。30秒ずつ処理し、1音の余韻を含む長さは120秒まで。Muteを反映し、Solo・ループは反映しません。Stemは選択楽器だけを全曲と同じ時間軸で個別保存します。各WAVはSourcesから選択して書き出せます。元MIDIと既存音声は保持。古い音声化と重複しないようExportのSourcesで選択してください。</p><button type="button" class="music-secondary"${pcmEditor.busy?' disabled':''} onclick="${escapeHtml(`MusicStudio.midiRenderForMix(${JSON.stringify(p.projectId)})`)}">Render / Save（音声化・保存）</button><label style="color:#eef6ff;display:grid;gap:4px;max-width:420px">Stem（楽器別WAV）<select id="midiRenderTrack" style="color:#eef6ff;background:#112031;border:1px solid #5f7f9f;min-height:44px" onchange="${escapeHtml(`MusicStudio.midiRenderPanel.selectedTracks.set(${JSON.stringify(p.projectId)},this.value)`)}">${(p.midiData?.tracks||[]).filter(t=>!t.muted&&t.notes?.length).map(t=>`<option value="${escapeHtml(t.id)}"${midiRenderPanel.selectedTracks.get(p.projectId)===t.id?' selected':''}>${escapeHtml(t.name||t.id)}</option>`).join('')}</select></label><button type="button" class="music-secondary"${pcmEditor.busy?' disabled':''} onclick="${escapeHtml(`MusicStudio.midiRenderForMix(${JSON.stringify(p.projectId)},document.getElementById('midiRenderTrack').value)`)}">Render Stem（選択楽器を音声化・保存）</button><fieldset style="max-height:180px;overflow:auto"><legend>Batch Stems（複数楽器を順次保存）</legend>${(p.midiData?.tracks||[]).filter(t=>!t.muted&&t.notes?.length).map(t=>`<label style="display:inline-flex;align-items:center;min-height:44px;margin-right:12px"><input type="checkbox" name="midiStemTrack" value="${escapeHtml(t.id)}">${escapeHtml(t.name||t.id)}</label>`).join('')}</fieldset><button type="button" class="music-secondary"${pcmEditor.busy?' disabled':''} onclick="${escapeHtml(`MusicStudio.midiRenderStems(${JSON.stringify(p.projectId)},Array.from(document.querySelectorAll('[name=midiStemTrack]:checked'),el=>el.value))`)}">Render Selected Stems（選択楽器を順次保存）</button><fieldset style="max-height:160px;overflow:auto"><legend>Saved Stems（ZIPに含める保存済み音声）</legend>${(p.longWavAssets||[]).filter(a=>a.midiRender?.stemTrackId).map(a=>`<label style="display:flex;align-items:center;min-height:44px"><input type="checkbox" name="midiStemAsset" value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</label>`).join('')}</fieldset><button type="button" class="music-secondary"${pcmEditor.busy?' disabled':''} onclick="${escapeHtml(`MusicStudio.midiStemZip(${JSON.stringify(p.projectId)},Array.from(document.querySelectorAll('[name=midiStemAsset]:checked'),el=>el.value),true)`)}">Stem ZIP（選択WAVをまとめて出力・512 MiBまで）</button><button type="button" class="music-secondary" onclick="MusicStudio.pcmCancel()">Cancel Render（音声化を取消）</button><p role="status">${escapeHtml(pcmEditor.message)}</p></details>`}
  function finalSources(p){return[...(p.pcmMix?.assets||[]).map(a=>({key:'pcm:'+a.id,id:a.id,name:a.name,kind:'pcm'})),...(p.longWavAssets||[]).map(a=>({key:'wav:'+a.id,id:a.id,name:a.name,kind:a.vocalTake?'vocal':'wav'}))]}
  function finalPlan(p,input){
    if(!input||input.format!=='nova-final-export-plan-v1'||!Array.isArray(input.routes)||input.routes.length<1||input.routes.length>32)throw Error('final-route-count');
    if(input.mixMasterOnly!==undefined&&typeof input.mixMasterOnly!=='boolean')throw Error('final-output-selection');
    const masterCompressor=input.masterCompressor===undefined?null:pcmCompressorSetting(input.masterCompressor);
    masterTargets(input.targetLufs,input.ceilingDb);const sources=finalSources(p),keys=new Set();
    const routes=input.routes.map(r=>{if(!sources.some(s=>s.key===r.key)||keys.has(r.key)||!['vocal','instrument'].includes(r.role)||!Number.isFinite(r.startSeconds)||r.startSeconds<0||r.startSeconds>3600||!Number.isFinite(r.gainDb)||r.gainDb< -24||r.gainDb>24||typeof r.muted!=='boolean')throw Error('final-route-invalid');keys.add(r.key);return{key:r.key,role:r.role,startSeconds:r.startSeconds,gainDb:r.gainDb,muted:r.muted}});
    if(!routes.some(r=>!r.muted))throw Error('final-all-muted');return{format:input.format,routes,targetLufs:input.targetLufs,ceilingDb:input.ceilingDb,includeMidi:input.includeMidi===true,...(masterCompressor&&masterCompressor.ratio!==1?{masterCompressor}:{}),...(input.mixMasterOnly===true?{mixMasterOnly:true}:{})};
  }
  function finalCheckCapacity(frames,sourceCount,plan){
    // Output selection is explicit. Keep the existing full-package budget and
    // bound compact inputs separately from its two output WAVs.
    const bytes=frames*4,limit=480*1048576;
    if(!Number.isSafeInteger(bytes)||bytes<4||
      (plan.mixMasterOnly?(bytes*sourceCount>limit||bytes*2>limit):bytes*(sourceCount+4)>limit))throw Error('final-package-estimated-capacity');
  }
  function finalInvalidate(){finalExport.abort?.(Error('final-invalidated'));finalExport.generation++;finalExport.candidate=null;finalStop()}
  function finalStop(){const audio=finalExport.audio,url=finalExport.url;finalExport.audio=null;finalExport.url=null;finalExport.playGeneration++;if(audio){audio.onended=null;audio.pause();audio.removeAttribute?.('src');audio.load?.()}if(url)root.URL?.revokeObjectURL(url)}
  function finalCancel(){finalExport.abort?.(Error('final-export-cancelled'));finalExport.generation++;finalExport.candidate=null;finalExport.message='Cancel（候補を取り消しました）';finalStop();requestPaint()}
  // Read-only preparation: render selected sources to a common stereo timeline.
  async function autoFinishPrepare(id,routes){
    const p=state.projects.find(p=>p.projectId===id),target=repository,baseline=JSON.stringify(p);
    if(!p||workspaceBusy()||finalExport.busy||lyricsEditor.busy||shutdownPromise||state.dirty||hasUnsavedChanges())return{ok:false,error:'auto-finish-save-first'};
    if(!Array.isArray(routes)||routes.length<2||routes.length>16||routes.some(r=>!r||typeof r.key!=='string'||!['vocal','piano','strings','bass','drums'].includes(r.role)||!Number.isFinite(r.startSeconds)||r.startSeconds<0||r.startSeconds>3600)||new Set(routes.map(r=>r.key)).size!==routes.length)return{ok:false,error:'auto-finish-source-count'};
    const guard=()=>{if(target!==repository||baseline!==JSON.stringify(state.projects.find(p=>p.projectId===id))||state.dirty||hasUnsavedChanges()||shutdownPromise)throw Error('auto-finish-source-changed')};
    pcmEditor.busy=true;
    try{
      guard();if(JSON.stringify(await target.get(id))!==baseline)throw Error('auto-finish-storage-conflict');
      const sources=[];
      for(const r of routes){
        guard();if(!['vocal','piano','strings','bass','drums'].includes(r.role)||!Number.isFinite(r.startSeconds)||r.startSeconds<0||r.startSeconds>3600)throw Error('auto-finish-source-invalid');
        if(r.key.startsWith('midi:')){
          const trackId=r.key.slice(5),track=p.midiData?.tracks?.find(t=>t.id===trackId&&!t.muted&&t.notes?.length);
          if(!track)throw Error('auto-finish-midi-missing');
          const result=await root.MusicStudioAudio.renderMidiStream(clone(p.midiData),instrumentEntries(p),{guard,trackIds:[trackId]});
          if(result.sampleRate!==48000||result.channels!==2||!Number.isSafeInteger(result.frames)||result.frames<1||(result.frames+Math.round(r.startSeconds*48000))*4*routes.length>480*1048576)throw Error('auto-finish-stem-capacity');
          async function* verifiedChunks(){for await(const chunk of result.chunks){guard();if(chunk.sampleRate!==48000||chunk.channels?.length!==2)throw Error('auto-finish-render-format');yield chunk}}
          const blob=await finalWav(verifiedChunks(),guard);
          if(blob.size!==44+result.frames*4)throw Error('auto-finish-render-incomplete');
          sources.push({...r,blob,frames:result.frames,start:Math.round(r.startSeconds*48000),gainDb:0});
        }else{
          const metadata=finalSources(p).find(s=>s.key===r.key);if(!metadata)throw Error('auto-finish-source-missing');
          const asset=metadata.kind==='pcm'?p.pcmMix.assets.find(a=>a.id===metadata.id):p.longWavAssets.find(a=>a.id===metadata.id),estimate=metadata.kind==='pcm'?asset.original.channels[0].length:asset.frames;
          if((estimate+Math.round(r.startSeconds*48000))*4*routes.length>480*1048576)throw Error('auto-finish-stem-capacity');
          sources.push(await finalSource(p,{...r,gainDb:0,muted:false},guard));
        }
      }
      const frames=Math.max(...sources.map(s=>s.start+s.frames));
      if(frames<19200||frames>48000*3600||frames*4*sources.length>480*1048576)throw Error('auto-finish-stem-capacity');
      const stems=[];
      for(const [i,source]of sources.entries()){
        const blob=await finalWav(finalChunks([source],frames,guard),guard);guard();
        if(blob.size!==44+frames*4)throw Error('auto-finish-render-incomplete');
        blob.name=`Project-stem-${i+1}.wav`;stems.push({id:`stem-${i+1}`,role:source.role,file:blob});
      }
      if(JSON.stringify(await target.get(id))!==baseline)throw Error('auto-finish-storage-conflict');guard();
      return{ok:true,stems,frames,sampleRate:48000,channels:2,audioVersion:`project-revision-${p.revision}`};
    }catch(error){return{ok:false,error:error.message}}finally{pcmEditor.busy=false;requestPaint()}
  }
  async function finalSource(p,r,guard){
    guard();const s=finalSources(p).find(s=>s.key===r.key);let blob,startSeconds=r.startSeconds;
    if(s.kind!=='pcm'){const a=p.longWavAssets.find(a=>a.id===s.id);if(a.sampleRate!==48000)throw Error('final-48khz-required');if(a.frames+r.startSeconds*48000>48000*3600)throw Error('final-one-hour-limit')}
    if(s.kind==='pcm'&&p.pcmMix.assets.find(a=>a.id===s.id).original.sampleRate!==48000)throw Error('final-48khz-required');
    if(s.kind==='pcm'){blob=new Blob([pcmEncodeWav(pcmRenderAsset(p.pcmMix.assets.find(a=>a.id===s.id)))],{type:'audio/wav'})}
    else if(s.kind==='vocal'){const result=await vocalRender(p.projectId,s.id);blob=result.blob;startSeconds+=result.startSeconds}
    else{const a=p.longWavAssets.find(a=>a.id===s.id),h=longMixHistory(a),settings=h.settings[h.cursor],source=await pcmLoadLongWav(p.projectId,s.id,guard);
      // Reuse authenticated durable bytes for a bypassed channel strip. Four
      // eight-minute stems otherwise allocate four redundant 92 MB WAVs before
      // the mixer even starts. Decoding below still validates every frame.
      const bypass=!settings.postGainDb&&settings.gainDb===0&&settings.eq.gainDb===0&&settings.compressor.ratio===1&&(!settings.spatial||(settings.spatial.balance===0&&settings.spatial.width===1));
      blob=bypass?source:(await pcmRenderLongWavBlob(source,settings,16384,{guard})).blob;
    }
    guard();let frames=0;for await(const chunk of pcmDecodeWavStream(blob)){guard();if(chunk.sampleRate!==48000)throw Error('final-48khz-required');frames+=chunk.channels[0].length}
    const start=Math.round(startSeconds*48000);if(start+frames>48000*3600)throw Error('final-one-hour-limit');return{...r,start,frames,blob,name:s.name};
  }
  async function* finalChunks(sources,frames,guard){
    const readers=sources.map(s=>({s,it:pcmDecodeWavStream(s.blob)[Symbol.asyncIterator](),chunk:null,index:0,read:0}));
    for(let at=0;at<frames;at+=16384){guard();const n=Math.min(16384,frames-at),channels=[Array(n).fill(0),Array(n).fill(0)];
      for(const reader of readers){const s=reader.s,factor=10**(s.gainDb/20),begin=Math.max(at,s.start),end=Math.min(at+n,s.start+s.frames);
        for(let pos=begin;pos<end;pos++){if(!reader.chunk||reader.index>=reader.chunk.channels[0].length){const next=await reader.it.next();guard();if(next.done)throw Error('final-source-short');reader.chunk=next.value;reader.index=0}for(let c=0;c<2;c++)channels[c][pos-at]+=reader.chunk.channels[Math.min(c,reader.chunk.channels.length-1)][reader.index]*factor;reader.index++;reader.read++}
      }
      const chunk={sampleRate:48000,channels};pcmValidate(chunk);yield chunk;
      if(root.setTimeout)await new Promise(r=>root.setTimeout(r,0));
    }
    if(readers.some(r=>r.read!==r.s.frames))throw Error('final-source-frame-mismatch');
  }
  async function finalWav(chunks,guard){
    const pieces=[];let frames=0;for await(const chunk of chunks){guard();pieces.push(pcmEncodeWav(chunk).slice(44));frames+=chunk.channels[0].length;if(frames*4>0xffffffff-36)throw Error('final-wav-size')}
    const header=pcmEncodeWav({sampleRate:48000,channels:[[0],[0]]}).slice(0,44),v=new DataView(header);v.setUint32(4,36+frames*4,true);v.setUint32(40,frames*4,true);return new Blob([header,...pieces],{type:'audio/wav'});
  }
  const zipCrcTable=Uint32Array.from({length:256},(_,value)=>{let crc=value;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);return crc>>>0});
  // Measure and encode the same bounded stream once. For final Master
  // acceptance, measure the actual quantized PCM16 bytes before assembling Blob
  // pieces, rather than reading the entire encoded Blob back in a second pass.
  // Optional independent raw/compressed meters share source traversal only.
  async function finalMeasuredWav(chunks,guard,encoded=false,compressor=null){
    const pieces=[];let frames=0,buffered;
    const secondary=compressor?masterMeter():null;
    const queue={[Symbol.iterator](){return this},next(){if(!buffered)throw Error('master-bus-source-not-ready');const value=buffered;buffered=null;return{value,done:false}}};
    const processor=secondary?pcmProcessChunks(queue,{sampleRate:48000,channelCount:2,compressor}):null;
    async function* measured(){for await(const chunk of chunks){
      guard();const wav=pcmEncodeWav(chunk);pieces.push(wav.slice(44));
      frames+=chunk.channels[0].length;if(frames*4>0xffffffff-36)throw Error('final-wav-size');
      if(secondary){buffered=chunk;const out=processor.next();if(out.done)throw Error('master-bus-unexpected-end');secondary.push(out.value)}
      yield encoded?pcmDecodeWav(wav):chunk;
    }}
    const metrics=await masterMeasure(measured(),{guard});guard();
    const header=pcmEncodeWav({sampleRate:48000,channels:[[0],[0]]}).slice(0,44),v=new DataView(header);
    v.setUint32(4,36+frames*4,true);v.setUint32(40,frames*4,true);
    return{blob:new Blob([header,...pieces],{type:'audio/wav'}),metrics,...(secondary?{masterInput:secondary.finish()}:{})};
  }
  async function finalZip(files,guard=()=>{},onProgress=()=>{}){
    if(files.length>64)throw Error('final-package-file-limit');const local=[],central=[];let offset=0;const names=new Set();
    // Include both directories and EOCD before reading any large binary.
    const total=files.reduce((size,file)=>size+file.blob.size+76+2*file.name.length,22);
    if(!Number.isSafeInteger(total)||total>512*1048576)throw Error('final-package-512mib-limit');
    const totalBytes=files.reduce((size,file)=>size+file.blob.size,0);let completedBytes=0;
    for(const file of files){guard();if(!/^[A-Za-z0-9_.-]+$/.test(file.name)||names.has(file.name)||file.blob.size>0xffffffff)throw Error('final-package-name-or-size');names.add(file.name);let crc=0xffffffff;
      for(let at=0;at<file.blob.size;at+=65536){guard();if(at%1048576===0&&root.setTimeout)await new Promise(r=>root.setTimeout(r,0));guard();const bytes=new Uint8Array(await file.blob.slice(at,at+65536).arrayBuffer());for(let i=0;i<bytes.length;i++)crc=(crc>>>8)^zipCrcTable[(crc^bytes[i])&255];completedBytes+=bytes.length;onProgress({completedBytes,totalBytes,ratio:totalBytes?completedBytes/totalBytes:1});guard()}crc=(crc^0xffffffff)>>>0;
      const name=Uint8Array.from(file.name,c=>c.charCodeAt(0)),header=new Uint8Array(30+name.length),v=new DataView(header.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,file.blob.size,true);v.setUint32(22,file.blob.size,true);v.setUint16(26,name.length,true);header.set(name,30);
      const dir=new Uint8Array(46+name.length),d=new DataView(dir.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(14,33,true);d.setUint32(16,crc,true);d.setUint32(20,file.blob.size,true);d.setUint32(24,file.blob.size,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);dir.set(name,46);central.push(dir);local.push(header,file.blob);offset+=header.length+file.blob.size;if(offset>512*1048576)throw Error('final-package-512mib-limit');
    }
    const size=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);guard();return new Blob([...local,...central,end],{type:'application/zip'});
  }
  async function* finalMasterChunks(sources,frames,guard,compressor,gainDb=0){
    // One detector state across the whole stereo bus, including chunk boundaries.
    let buffered;const queue={[Symbol.iterator](){return this},next(){if(!buffered)throw Error('master-bus-source-not-ready');const value=buffered;buffered=null;return{value,done:false}}};
    const processor=pcmProcessChunks(queue,{sampleRate:48000,channelCount:2,compressor:compressor||PCM_COMP_BYPASS,postGainDb:gainDb});
    for await(const chunk of finalChunks(sources,frames,guard)){guard();buffered=chunk;const out=processor.next();guard();if(out.done)throw Error('master-bus-unexpected-end');yield out.value;}
  }
  async function finalFileRecord(file,guard=()=>{}){
    let crc=0xffffffff;
    for(let at=0;at<file.blob.size;at+=65536){
      guard();const bytes=new Uint8Array(await file.blob.slice(at,at+65536).arrayBuffer());
      for(const byte of bytes)crc=(crc>>>8)^zipCrcTable[(crc^byte)&255];
      if(at%1048576===0&&root.setTimeout)await new Promise(resolve=>root.setTimeout(resolve,0));
    }
    guard();const record={name:file.name,size:file.blob.size,checksum:{algorithm:'CRC32',value:((crc^0xffffffff)>>>0).toString(16).padStart(8,'0')}};
    if(file.name.endsWith('.wav')){
      const header=new DataView(await file.blob.slice(0,44).arrayBuffer());
      if(header.byteLength!==44||header.getUint32(0)!==0x52494646||header.getUint32(8)!==0x57415645||header.getUint32(36)!==0x64617461||header.getUint32(4,true)+8!==file.blob.size||header.getUint32(40,true)+44!==file.blob.size)throw Error('final-wav-integrity');
      record.audio={encoding:'PCM',sampleRate:header.getUint32(24,true),bitDepth:header.getUint16(34,true),channels:header.getUint16(22,true),frames:header.getUint32(40,true)/header.getUint16(32,true),startFrame:0};
      if(header.getUint16(20,true)!==1||record.audio.sampleRate!==48000||record.audio.bitDepth!==16||record.audio.channels!==2||!Number.isSafeInteger(record.audio.frames))throw Error('final-wav-format');
    }
    return record;
  }
  function finalHandoff(p,sources,frames){
    const midi=p.midiData||{},tracks=(midi.tracks||[]).map(t=>({id:t.id,name:t.name||t.part||t.id,channel:t.channel,part:t.part||t.roleAssignment||null,noteCount:t.notes?.length||0}));
    return {format:'nova-logic-handoff-v1',projectId:p.projectId,sourceRevision:p.revision,
      songTitle:p.songTitle||p.projectName,musicalSettings:clone(p.musicalSettings),
      timeline:{ppq:midi.ppq||480,tempo:midi.tempo||p.musicalSettings.bpm,tempoMap:clone(midi.tempoMap||[]),timeSignature:clone(midi.timeSignature||p.musicalSettings.timeSignature),timeSignatureMap:clone(midi.timeSignatureMap||[]),startFrame:0,frames,sampleRate:48000},
      midi:{file:'Song.mid',tracks},stems:sources.map((source,index)=>{
        const asset=source.key.startsWith('wav:')?p.longWavAssets?.find(a=>'wav:'+a.id===source.key):null;
        return {file:`${source.role==='vocal'?'Vocal':'Instrument'}-${index+1}.wav`,sourceKey:source.key,sourceName:source.name,role:source.role,sourceStartFrame:source.start,sourceFrames:source.frames,midiTrackIds:clone(asset?.midiRender?.trackIds||[])};
      }),instructions:['Import all WAV files at the same song start; each includes its leading silence and full song length.','Use Song.mid for tempo, meter and MIDI tracks. Key and source mappings are recorded here.','Keep the original project; import returned MIDI as a duplicate and returned WAV through Mix / Gain.','Instrumental and individual stems are pre-master; Master.wav includes mastering.'],physicalLogicAcceptance:false};
  }
  async function finalPreview(id,input){
    if(finalExport.busy||vocalBusy()||pcmEditor.busy||archiveTransfer.busy||shutdownPromise)return{ok:false,error:'final-production-busy'};
    finalStop();finalExport.candidate=null;const target=repository,p=state.projects.find(p=>p.projectId===id),baseline=JSON.stringify(p),token=++finalExport.generation;finalExport.busy=true;pcmEditor.busy=true;requestPaint();
    const snapshot=audioProjectSnapshot(id,baseline),guard=(force=false)=>{if(token!==finalExport.generation||repository!==target||!snapshot(force)||state.dirty||midiEditorHasPendingChanges()||state.midiInput.recording||state.midiInput.starting||archiveTransfer.busy||vocalBusy()||shutdownPromise)throw Error('final-cancelled-or-stale')};
    const started=root.performance?.now?.()??Date.now(),phaseMs={};let phase=null,phaseStart=started;
    const clock=()=>root.performance?.now?.()??Date.now(),finishPhase=()=>{const t=clock();if(phase)phaseMs[phase]=(phaseMs[phase]||0)+Math.max(0,t-phaseStart);phaseStart=t};
    try{guard();const stage=message=>{guard();finishPhase();phase=message.replace(/（.*$/,'');finalExport.message=message;requestPaint()};stage('Preparing sources（音声素材を準備中）');if(JSON.stringify(await target.get(id))!==baseline)throw Error('final-storage-conflict');const plan=finalPlan(p,input),sources=[],selected=plan.routes.filter(r=>!r.muted);
      const estimatedFrames=Math.max(...selected.map(r=>{const s=finalSources(p).find(s=>s.key===r.key),a=s.kind==='pcm'?p.pcmMix.assets.find(a=>a.id===s.id):p.longWavAssets.find(a=>a.id===s.id),frames=s.kind==='pcm'?a.original.channels[0].length:a.frames;if(!Number.isSafeInteger(frames)||frames<1)throw Error('final-source-metadata');return frames+Math.ceil(r.startSeconds*48000)}));
      finalCheckCapacity(estimatedFrames,selected.length,plan);
      for(const [index,r] of selected.entries()){stage(`Preparing sources（音声素材を準備中） ${index+1}/${selected.length}`);sources.push(await finalSource(p,r,guard))}guard();
      const frames=Math.max(...sources.map(s=>s.start+s.frames));finalCheckCapacity(frames,sources.length,plan);
      stage('Measuring and rendering mix（元Mixの作成・音量測定中）');const prepared=await finalMeasuredWav(finalChunks(sources,frames,guard),guard,false,plan.masterCompressor),before=prepared.metrics,original=prepared.blob;if(before.lufs===null)throw Error('final-silence-or-short');const masterInput=prepared.masterInput||before;const initial=masterGainPlan(masterInput,plan.targetLufs,plan.ceilingDb);
      stage('Rendering master（Master音声を作成・検査中）');const corrected=await masterConverge(initial.gainDb,plan.targetLufs,plan.ceilingDb,g=>finalMeasuredWav(finalMasterChunks(sources,frames,guard,plan.masterCompressor,g),guard,true),result=>result.metrics,{guard});
      const master=corrected.output.blob,after=corrected.after,gainDb=corrected.gainDb,peakLimited=corrected.peakLimited,gainLimited=corrected.gainLimited;
      const files=[{name:'Master.wav',blob:master},{name:'Mix.wav',blob:original}];
      if(!plan.mixMasterOnly){stage('Rendering stems（Instrumental・Stemを作成中）');
      for(const [role,name]of [['instrument','Instrumental.wav'],['vocal','Vocal-Stem.wav']]){const group=sources.filter(s=>s.role===role);if(group.length)files.push({name,blob:await finalWav(finalChunks(group,frames,guard),guard)})}
      for(const [i,s]of sources.entries())files.push({name:`${s.role==='vocal'?'Vocal':'Instrument'}-${i+1}.wav`,blob:await finalWav(finalChunks([s],frames,guard),guard)});
      }
      if(plan.includeMidi){const summary=midiExportSummary(p);if(!summary.validation.ok)throw Error('final-midi-invalid: '+summary.validation.errors.join(' '));files.push({name:'Song.mid',blob:root.MusicStudioMidi.createMidiBlob(root.MusicStudioMidi.createMidiFile(summary.input).bytes)})}
      const manifest={format:'nova-final-package-v1',projectId:id,sourceRevision:p.revision,plan,frames,sampleRate:48000,channels:2,gainDb,before,...(plan.masterCompressor?{masterInput}:{}),after,peakLimited,gainLimited,targetReached:corrected.targetReached,passes:corrected.passes,measurements:corrected.measurements,loudnessReason:corrected.reason,audioScope:'Explicit selected rendered audio; MIDI exported separately, no MIDI-to-audio synthesis',bitDepth:16,encoding:'PCM',handoff:finalHandoff(p,sources,frames),files:[]};
      if(!plan.includeMidi)manifest.handoff.midi.file=null;
      if(plan.mixMasterOnly)manifest.handoff.stems=[];
      for(const file of files){const record=await finalFileRecord(file,guard);if(record.audio&&record.audio.frames!==frames)throw Error('final-stem-length-mismatch');manifest.files.push(record)}
      files.push({name:'Manifest.json',blob:new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'})});stage('Packaging export（書き出しファイルをまとめています）');const zip=await finalZip(files,guard,progress=>{guard();const message=`Packaging Stems（楽器別WAV） ${Math.floor(progress.ratio*100)}%`;if(pcmEditor.message!==message){pcmEditor.message=message;requestPaint()}});guard();if(JSON.stringify(await target.get(id))!==baseline)throw Error('final-storage-conflict');guard(true);
      files.forEach(Object.freeze);Object.freeze(files);finishPhase();const candidate={baseline,plan,manifest,files,zip,performance:{totalMs:Math.max(0,clock()-started),phaseMs}};finalExportProof.set(candidate,{baseline,proof:JSON.stringify({plan,manifest}),files:files.slice(),zip});finalExport.candidate=candidate;finalExport.message='Preview（候補完成）：Mix / Masterを試聴してから設定を保存・書き出してください。';return{ok:true,candidate};
    }catch(e){finalExport.message='作成できません：'+e.message;return{ok:false,error:e.message}}finally{finalExport.busy=false;pcmEditor.busy=false;requestPaint()}
  }
  function finalCandidate(id){const c=finalExport.candidate,proof=c&&finalExportProof.get(c);if(!c||!proof||c.baseline!==proof.baseline||c.baseline!==JSON.stringify(state.projects.find(p=>p.projectId===id))||proof.proof!==JSON.stringify({plan:c.plan,manifest:c.manifest})||proof.zip!==c.zip||proof.files.length!==c.files.length||proof.files.some((f,i)=>f!==c.files[i]))throw Error('final-preview-stale-or-modified');return c}
  async function finalListen(id,name){let audio;try{const c=finalCandidate(id),file=c.files.find(f=>f.name===name);if(!file||!name.endsWith('.wav'))throw Error('final-audio-missing');pcmStop();longMixStop();vocalPlaybackStop();finalStop();const token=finalExport.generation,playToken=finalExport.playGeneration;finalExport.url=root.URL.createObjectURL(file.blob);audio=new root.Audio(finalExport.url);finalExport.audio=audio;await audio.play();if(token!==finalExport.generation||playToken!==finalExport.playGeneration||finalExport.audio!==audio)return{ok:false,error:'final-listen-cancelled'};audio.onended=()=>{if(finalExport.audio===audio&&playToken===finalExport.playGeneration)finalStop()};return{ok:true}}catch(e){if(audio&&finalExport.audio!==audio)return{ok:false,error:'final-listen-cancelled'};finalStop();finalExport.message=e.message;requestPaint();return{ok:false,error:e.message}}}

  async function finalSave(id){
    if(finalExport.busy||pcmEditor.busy||vocalBusy()||archiveTransfer.busy||shutdownPromise)return{ok:false,error:'final-production-busy'};finalExport.busy=true;pcmEditor.busy=true;const target=repository,token=finalExport.generation;requestPaint();
    try{const c=finalCandidate(id),guard=()=>{if(token!==finalExport.generation||repository!==target||state.dirty||midiEditorHasPendingChanges()||archiveTransfer.busy||shutdownPromise||state.midiInput.recording||state.midiInput.starting)throw Error('final-save-stale');finalCandidate(id)};guard.registerAbort=a=>{finalExport.abort=a};guard.clearAbort=()=>{finalExport.abort=null};guard();const previous=state.projects.find(p=>p.projectId===id),p=clone(previous);p.finalExportPlan=clone(c.plan);p.finalExportHistory=[...(p.finalExportHistory||[]),{id:uuid(),createdAt:now(),status:'prepared',...clone(c.manifest)}].slice(-100);p.revision++;p.updatedAt=now();if(p.aiWorkspace)p.aiWorkspace=rebindAIWorkspace(p.aiWorkspace,id,p.revision);automaticEditRecord(previous,p,'final-export');await target.compareAndPut(p,c.baseline,guard);state.projects=state.projects.map(x=>x.projectId===id?p:x);c.baseline=JSON.stringify(p);finalExportProof.get(c).baseline=c.baseline;finalExport.message='Save（設定・作成履歴を保存しました）。ブラウザのダウンロード完了は確認できません。';return{ok:true,project:p};
    }catch(e){finalExport.message=e.message;return{ok:false,error:e.message}}finally{finalExport.abort=null;finalExport.busy=false;pcmEditor.busy=false;requestPaint()}
  }
  function finalDeliveryValidate(items){
    if(!Array.isArray(items)||items.length>100)throw Error('final-delivery-history-invalid');
    for(const d of items)if(!d||typeof d.id!=='string'||!d.id||typeof d.createdAt!=='string'||!Number.isFinite(Date.parse(d.createdAt))||typeof d.name!=='string'||d.name.length>160||/[\/\\\x00-\x1f]/.test(d.name)||!Number.isSafeInteger(d.size)||d.size<1||d.size>512*1048576||!['browser-download-requested','file-written-verified'].includes(d.completion))throw Error('final-delivery-entry-invalid');
    return items;
  }
  async function finalReplay(id,historyId){
    try{const p=state.projects.find(p=>p.projectId===id),h=p?.finalExportHistory?.find(h=>h?.id===historyId);if(!h?.plan)throw Error('final-history-recipe-unavailable');const plan=finalPlan(p,clone(h.plan));const r=await finalPreview(id,plan);if(r.ok){finalExport.message='History（履歴の設定で再作成）：現在の保存済み音声を使います。元の出力と同一とは限りません。試聴後にSaveしてください。';requestPaint()}return r}
    catch(e){finalExport.message='再作成できません：'+e.message;requestPaint();return{ok:false,error:e.message}}
  }
  function finalDeliveryGuard(id,c,target,token){
    if(repository!==target||token!==finalExport.generation||state.dirty||midiEditorHasPendingChanges()||vocalBusy()||archiveTransfer.busy||shutdownPromise||state.midiInput.recording||state.midiInput.starting||c!==finalCandidate(id))throw Error('final-delivery-stale');
  }
  async function finalRecordDelivery(id,c,target,token,delivery){
    const guard=()=>finalDeliveryGuard(id,c,target,token);guard.registerAbort=a=>{finalExport.abort=a};guard.clearAbort=()=>{finalExport.abort=null};guard();
    const previous=state.projects.find(p=>p.projectId===id),p=clone(previous);p.finalExportDeliveries=[...(p.finalExportDeliveries||[]),{id:uuid(),createdAt:now(),...delivery}].slice(-100);finalDeliveryValidate(p.finalExportDeliveries);p.revision++;p.updatedAt=now();if(p.aiWorkspace)p.aiWorkspace=rebindAIWorkspace(p.aiWorkspace,id,p.revision);automaticEditRecord(previous,p,'final-export');
    await target.compareAndPut(p,c.baseline,guard);state.projects=state.projects.map(x=>x.projectId===id?p:x);c.baseline=JSON.stringify(p);finalExportProof.get(c).baseline=c.baseline;
  }
  async function finalDownload(id,name='Package.zip',chooseDestination=false){
    if(finalExport.busy||pcmEditor.busy||state.dirty||midiEditorHasPendingChanges()||vocalBusy()||archiveTransfer.busy||shutdownPromise)return{ok:false,error:'final-production-busy'};
    let c,file,handle,writable,completion,outputName;const target=repository,token=finalExport.generation;
    try{
      c=finalCandidate(id);finalDeliveryGuard(id,c,target,token);file=name==='Package.zip'?{name,blob:c.zip}:c.files.find(f=>f.name===name);if(!file)throw Error('final-file-missing');outputName=safeFileName(state.projects.find(p=>p.projectId===id).projectName,80,'Song')+'_'+name;
      // Invoke the chooser within the initiating click, before any asynchronous storage read.
      const picker=chooseDestination?(typeof root.showSaveFilePicker==='function'?root.showSaveFilePicker({suggestedName:outputName}):Promise.reject(Error('final-save-picker-unavailable'))):null;
      finalExport.busy=true;pcmEditor.busy=true;requestPaint();if(picker)handle=await picker;finalDeliveryGuard(id,c,target,token);
      if(JSON.stringify(await target.get(id))!==c.baseline)throw Error('final-storage-conflict');finalDeliveryGuard(id,c,target,token);
      if(handle){
        writable=await handle.createWritable();finalDeliveryGuard(id,c,target,token);await writable.write(file.blob);finalDeliveryGuard(id,c,target,token);await writable.close();writable=null;
        const actual=await handle.getFile();if(actual.size!==file.blob.size)throw Error('final-file-verification-failed');
        for(let at=0;at<actual.size;at+=65536){const [x,y]=await Promise.all([actual.slice(at,at+65536).arrayBuffer(),file.blob.slice(at,at+65536).arrayBuffer()]);const a=new Uint8Array(x),b=new Uint8Array(y);if(a.length!==b.length||a.some((v,i)=>v!==b[i]))throw Error('final-file-verification-failed')}
        outputName=handle.name;completion='file-written-verified';
      }else{
        if(!root.document||!root.URL?.createObjectURL)throw Error('final-download-unavailable');const url=root.URL.createObjectURL(file.blob);
        try{const a=root.document.createElement('a');a.href=url;a.download=outputName;root.document.body.appendChild(a);try{a.click()}finally{a.remove()}}finally{root.setTimeout?.(()=>root.URL.revokeObjectURL(url),1000)}
        completion='browser-download-requested';
      }
      let historySaved=true,historyError;try{await finalRecordDelivery(id,c,target,token,{name:outputName,size:file.blob.size,completion})}catch(e){historySaved=false;historyError=e.message}
      finalExport.message=(completion==='file-written-verified'?'Save as（選択したファイルへ保存・内容照合済み）。':'Download（ブラウザへ依頼済み・保存先と完了は確認できません）。')+(historySaved?'履歴を保存しました。':'履歴を保存できません：'+historyError);
      return{ok:true,name:outputName,size:file.blob.size,completion,historySaved,...(historyError?{historyError}:{})};
    }catch(e){if(writable)try{await writable.abort()}catch(_){}finalExport.message=e.name==='AbortError'?'Cancel（保存先の選択を取り消しました）':'書き出しできません：'+e.message;return{ok:false,error:e.message,...(handle?{fileMayHaveChanged:true}:{})}}
    finally{finalExport.abort=null;finalExport.busy=false;pcmEditor.busy=false;requestPaint()}
  }
  function finalSubmit(event,id){event.preventDefault();const f=event.target;try{const routes=[...f.querySelectorAll('[data-final-route]')].filter(row=>row.querySelector('[name=enabled]').checked).map(row=>({key:row.dataset.finalRoute,role:row.querySelector('[name=role]').value,startSeconds:Number(row.querySelector('[name=start]').value),gainDb:Number(row.querySelector('[name=gain]').value),muted:row.querySelector('[name=muted]').checked}));return finalPreview(id,{format:'nova-final-export-plan-v1',routes,targetLufs:Number(f.elements.target.value),ceilingDb:Number(f.elements.ceiling.value),includeMidi:f.elements.midi.checked,mixMasterOnly:f.elements.mixMasterOnly?.checked===true,...(f.elements.masterDynamics?.checked?{masterCompressor:{thresholdDb:Number(f.elements.masterThreshold.value),ratio:Number(f.elements.masterRatio.value),attackMs:Number(f.elements.masterAttack.value),releaseMs:Number(f.elements.masterRelease.value)}}:{})})}catch(e){finalExport.message=e.message;requestPaint();return{ok:false,error:e.message}}}
  function finalFocusedView(id){const p=state.projects.find(x=>x.projectId===id);if(!p)return '<main class="music-studio-shell"><p>曲を確認できません。</p></main>';return `<main class="music-studio-shell music-export-focused"><header class="music-vocal-focus-heading"><h1>${escapeHtml(p.songTitle||p.projectName)} · Export（書き出し）</h1><button class="music-secondary" onclick="${escapeHtml(`MusicStudio.openVocalSettings(${JSON.stringify(id)})`)}">Project（曲の設定）</button></header>${noticeView()}${autoFinishAuditionView(p)}${midiRenderView(p)}${finalView(p,true)}</main>`}
  // These are user-selected CLI output files. This does not run the CLI or adopt a candidate.
  function autoFinishListenInput(input){
    const audio=input.parentElement.querySelector('audio');
    if(audio.dataset.objectUrl)root.URL.revokeObjectURL(audio.dataset.objectUrl);
    const file=input.files?.[0];
    if(!file){audio.removeAttribute('src');delete audio.dataset.objectUrl;audio.load();return}
    const url=root.URL.createObjectURL(file);audio.dataset.objectUrl=url;audio.src=url;audio.load();
  }
  function autoFinishAuditionView(project){return root.MusicStudioAutoFinish?.view?.(project)||'<details class="music-setting-section"><summary>Stem Auto-Finish</summary><p>ローカル接続モジュールを読み込めません。</p></details>'}
  function finalView(p,focused=false){const id=JSON.stringify(p.projectId),handler=s=>escapeHtml(s),disabled=finalExport.busy?' disabled':'';let c;try{c=finalCandidate(p.projectId)}catch(_){}const plan=c?.plan||p.finalExportPlan;
    return`${focused?'<section class="music-setting-section music-final-export"><h2>Export（楽曲ミックス・一括書き出し）</h2>':'<details class="music-setting-section music-final-export" open><summary>Export（楽曲ミックス・一括書き出し）</summary>'}${focused?'<details class="music-export-help" onkeydown="MusicStudio.vocalDisclosureKey(event,this)"><summary>Help（書き出しの仕様）</summary>':''}<p>選んだ音声だけを配置・合成します。48 kHz、最大1時間・ZIP 512 MiB。MIDIは先にExport画面のMIDI Audioで音声化・保存し、Sourcesで選択してください。録音は保存済み編集と同期位置を反映。元ミックスが飽和する場合は音量を下げて再作成します。</p>${focused?'</details>':''}<form oninput="MusicStudio.finalInvalidate()" onsubmit="${handler(`MusicStudio.finalSubmit(event,${id})`)}">${focused?'<details class="music-export-sources" onkeydown="MusicStudio.vocalDisclosureKey(event,this)"><summary>Sources（音声の選択・配置・音量）</summary>':''}<div class="music-final-routes">${finalSources(p).map(s=>{const r=plan?.routes.find(r=>r.key===s.key);return`<fieldset data-final-route="${escapeHtml(s.key)}"${disabled}><legend>${escapeHtml(s.name)}</legend><label><input name="enabled" type="checkbox"${r?' checked':''}>Include（選択）</label><label>Role（用途）<select name="role"><option value="instrument"${r?.role==='instrument'?' selected':''}>Instrument（楽器）</option><option value="vocal"${r?.role==='vocal'||!r&&s.kind==='vocal'?' selected':''}>Vocal（歌声）</option></select></label><label>Offset（追加配置・秒）<input name="start" type="number" min="0" max="3600" step="0.001" value="${r?.startSeconds??0}"></label><label>Gain（音量・dB）<input name="gain" type="number" min="-24" max="24" step="0.1" value="${r?.gainDb??0}"></label><label><input name="muted" type="checkbox"${r?.muted?' checked':''}>Mute（消音）</label></fieldset>`}).join('')}</div>${focused?'</details>':''}<div class="music-form-grid"><label>Target（目標LUFS）<input name="target" type="number" min="-36" max="-5" step="0.1" value="${plan?.targetLufs??-14}"${disabled}></label><label>Ceiling（最大ピーク・dBTP）<input name="ceiling" type="number" min="-12" max="-0.1" step="0.1" value="${plan?.ceilingDb??-1}"${disabled}></label><label><input name="midi" type="checkbox"${plan?.includeMidi?' checked':''}${disabled}>MIDI（演奏データ）も含める</label><label><input name="mixMasterOnly" type="checkbox"${plan?.mixMasterOnly?' checked':''}${disabled}>Master / Mix only（完成音源と元ミックスだけを書き出す）</label><small>長い曲の複数楽器をまとめるときに選択します。楽器別WAVはSaved Stemsから別途書き出せます。</small><details class="music-master-dynamics"><summary>Master dynamics（仕上げの圧縮・任意）</summary><p>Masterだけを圧縮してから目標音量へ調整します。元Mix・Stemは保持します。音色と強弱が変わるためBefore / Afterで確認してください。ピーク制限で目標に届かない場合も表示します。</p><label><input name="masterDynamics" type="checkbox"${plan?.masterCompressor?' checked':''}${disabled}>Enable compression（Masterの圧縮を使う）</label>${[['masterThreshold','Threshold（圧縮開始 dBFS）',plan?.masterCompressor?.thresholdDb??-24,-60,0,.1],['masterRatio','Ratio（圧縮率）',plan?.masterCompressor?.ratio??2,1,20,.1],['masterAttack','Attack（反応 ms）',plan?.masterCompressor?.attackMs??10,.1,200,.1],['masterRelease','Release（戻り ms）',plan?.masterCompressor?.releaseMs??100,1,2000,1]].map(([name,label,value,min,max,step])=>`<label>${label}<input name="${name}" type="number" value="${value}" min="${min}" max="${max}" step="${step}"${disabled}></label>`).join('')}</details></div><button class="music-primary"${disabled}>Preview（ミックス候補を作成）</button></form>${c?`<p>Before（元ミックス）${c.manifest.before.lufs.toFixed(2)} LUFS → After（仕上げ）${c.manifest.after.lufs.toFixed(2)} LUFS / ${c.manifest.after.truePeakDb.toFixed(2)} dBTP${masterStatus({...c.manifest,targetLufs:c.plan.targetLufs})}</p><div class="music-form-actions"><button class="music-secondary" onclick="${handler(`MusicStudio.finalListen(${id},'Mix.wav')`)}">Before（元ミックス試聴）</button><button class="music-secondary" onclick="${handler(`MusicStudio.finalListen(${id},'Master.wav')`)}">After（仕上げ試聴）</button><button class="music-primary"${disabled} onclick="${handler(`MusicStudio.finalSave(${id})`)}">Save（設定・履歴を保存）</button><button class="music-primary"${disabled} onclick="${handler(`MusicStudio.finalDownload(${id})`)}">ZIP（まとめて書き出し）</button>${focused?'<details class="music-export-files" onkeydown="MusicStudio.vocalDisclosureKey(event,this)"><summary>Files（個別ファイル・保存先）</summary>':''}${c.files.map(f=>`<button class="music-secondary"${disabled} onclick="${handler(`MusicStudio.finalDownload(${id},${JSON.stringify(f.name)})`)}">${escapeHtml(f.name)}（書き出し）</button>`).join('')}${typeof root.showSaveFilePicker==='function'?`<label>Save as（保存先を選ぶ）<select data-final-file>${['Package.zip',...c.files.map(f=>f.name)].map(n=>`<option>${escapeHtml(n)}</option>`).join('')}</select></label><button class="music-primary"${disabled} onclick="${handler(`MusicStudio.finalDownload(${id},this.parentElement.querySelector('[data-final-file]').value,true)`)}">Save as（保存先を選んで保存）</button>`:'<p>保存先はブラウザのダウンロード設定で指定します。この環境はSave asに対応していません。</p>'}${focused?'</details>':''}</div>`:''}${focused?'<div class="music-export-stop">':''}<button class="music-secondary" onclick="MusicStudio.finalStop()">Stop（試聴停止）</button><button class="music-secondary" onclick="MusicStudio.finalCancel()">Cancel（候補取消）</button>${focused?'</div>':''}<p role="status">${escapeHtml(finalExport.message)}</p><details class="music-export-history" onkeydown="MusicStudio.vocalDisclosureKey(event,this)"><summary>History（作成履歴・直近100件）</summary>${(p.finalExportHistory||[]).slice().reverse().map(h=>`<div class="music-final-history-row"><p>${escapeHtml(h.createdAt)} / Revision ${escapeHtml(h.sourceRevision)} / ${escapeHtml(h.frames)} frames / ${escapeHtml(h.after?.lufs)} LUFS</p>${h.plan?`<button class="music-secondary"${disabled} onclick="${handler(`MusicStudio.finalReplay(${id},${JSON.stringify(h.id)})`)}">Retry（この設定で再作成）</button>`:'<p>この旧履歴には再作成用の設定がありません。</p>'}</div>`).join('')}</details><details class="music-export-delivery" onkeydown="MusicStudio.vocalDisclosureKey(event,this)"><summary>Delivery（書き出し履歴・直近100件）</summary><p>履歴はファイルの現在の存在を保証しません。再出力にはPreviewまたはRetryを使います。</p>${(p.finalExportDeliveries||[]).slice().reverse().map(d=>`<p>${escapeHtml(d.createdAt)} / ${escapeHtml(d.name)} / ${escapeHtml(d.size)} bytes / ${d.completion==='file-written-verified'?'保存・内容照合済み':'ブラウザへ依頼済み・完了未確認'}</p>`).join('')}</details>${focused?'</section>':'</details>'}`;
  }

  const api={autoFinishPrepare,vocalImportRescue,vocalJournalAction,vocalRecovery,vocalDiscoverRecovery,vocalRecoverJournal,VOCAL_CAPTURE_MAX_SECONDS,vocalCapturedWav,vocalCapturedTakes,vocalReplacementListen,vocalReplacementHistory,vocalReplacementUndo,vocalReadWindow,vocalReplacementRender,vocalReplacementApply,vocalReplacementForm,vocalReplacementView,vocalRangeProject,generateLocalScoreVocalRange,japaneseVocalProject,editLyricsNoteToken,editSavedLyrics,kanaReadingTokens,splitLyricsReading,localGenerationRequest,generateLocalScoreVocal,cancelLocalScoreVocal,inspectScoreVocal,inspectScoreVocalForm,scoreVocalTiming,scoreVocalLinkedView,openScoreVocalTake,importScoreVocal,importScoreVocalForm,scoreVocalReturnView,lyricsScoreXML,exportLyricsScore,editorAuditionCandidate,editorStopCandidateAudition,vocalLoopbackLive,vocalCalibrationCancel,vocalGaplessTakes,vocalLoopbackFile,vocalLoopbackApply,vocalInputChoices,midiRenderPanel,productionOpenAction,midiRenderForMix,midiRenderStems,midiStemZip,midiRenderView,finalFocusedView,vocalDisclosureKey,vocalRefreshInputs,vocalInputProfiles,vocalInputProfileSave,vocalInputProfileRemove,vocalInputCompensation,vocalInputProfileForm,vocalInputProfilesView,openVocalSettings,vocalCompToggle,vocalFocusedView,vocalCompMove,vocalWorkspace,vocalWorkspaceView,vocalSelectTake,vocalStepTake,vocalRenameTake,finalReplay,finalDeliveryValidate,finalInvalidate,finalExport,finalSources,finalPlan,finalPreview,finalSave,finalDownload,finalCancel,finalStop,finalListen,finalView,finalSubmit,finalZip,finalChunks,finalWav,vocalLyricRows,vocalLyricAt,vocalLyricView,vocalLyricFollow,vocalLyricStop,vocalPeakPlan,vocalNormalizePreview,vocalCycle,vocalCycleStart,vocalTransportPlan,vocalInputLevel,vocalMonitor,vocalPause,vocalResume,vocalBreathPreview,vocalBreathForm,retainReferenceFile,loadReferenceFile,downloadReferenceFile,referenceFilesView,archiveTransfer,cancelArchiveTransfer,previewLongWavArchive,restorePreviewedArchive,mixAlignedProposal,pcmSavedSpatial,pcmSpatialAdopt,pcmSpatialHistory,pcmShowSpatialPreview,pcmUndoRedoSpatial,pcmSpatialView,mixAlignedPair,mixAlignedSubmit,mixAlignedView,pcmSpatial,pcmSpatialSetting,pcmSuggestions,pcmSettings,pcmSettingsPreview,pcmSettingsAdopt,pcmAnalyzeSuggestions,pcmSelectSuggestion,pcmSuggestionsView,mixRelationships,mixAnalyzeRelationships,mixRelationshipsView,mixMeasure,mixPropose,longMixAnalyze,longMixSelect,longMixProposalsView,longMix,longMixSettings,longMixHistory,longMixRender,longMixPreview,longMixSave,longMixListen,longMixExport,longMixSubmit,longMixView,longMixCancel,vocalRecordingWindow,vocalWaveOverlay,vocalCorrection,VOCAL_EDIT_SAMPLE_LIMIT,vocalRegions,vocalReadPCM,vocalDetectPitch,vocalDetectPitchAsync,vocalGrain,vocalProcessPCM,vocalTimeline,vocalKeyPitches,vocalCompareReference,vocalComparisonAction,vocalCompareForm,vocalComparisonView,vocalVibratoCandidates,vocalAnalyze,vocalCorrectionCancel,vocalCorrectionToggle,vocalReplaceRegions,vocalTrimSetting,vocalCandidateSetting,vocalCorrectionListen,vocalCorrectionApply,vocalRegionEdit,vocalLyricOffset,vocalSelectRange,vocalWaveDown,vocalCompPreflight,vocalCompHistory,vocalCompEdit,vocalCompAdd,vocalCompRemove,vocalCompMove,vocalCompRender,vocalCompSave,vocalCompListen,vocalAnalysisForm,vocalRegionForm,vocalSyncSelect,vocalLyricForm,vocalAdvancedToggle,vocalAdvancedView,vocalCompView,vocal,vocalBusy,vocalStart,vocalStop,vocalSave,vocalDiscard,vocalWav,vocalHistory,vocalSetting,vocalPosition,vocalEdit,vocalRender,vocalPlay,vocalPlaybackStop,vocalPublishForMix,vocalSourceOrigin,vocalTimelineRender,vocalTimelineExport,vocalExport,vocalStartForm,vocalEditForm,vocalView,VOCAL_MAX_SECONDS,VOCAL_MAX_BYTES,createLongWavArchive,restoreLongWavArchive,exportLongWavArchive,pcmImportLongFile,pcmLoadLongWav,pcmDownloadLongOriginal,PCM_LIMIT,PCM_FORMAT,pcmValidate,pcmAnalyze,pcmGain,pcmEq,pcmCompress,pcmCompressorSetting,pcmProcessChunks,pcmDecodeWavStream,pcmRenderLongWav,pcmRenderLongWavBlob,pcmCompressorPreview,pcmCompressorAdopt,pcmCompressorHistory,pcmSavedCompressor,pcmShowCompressorPreview,pcmUndoRedoCompressor,pcmEqPreview,pcmEqAdopt,pcmEqHistory,pcmSavedEq,pcmRenderAsset,pcmShowEqPreview,pcmUndoRedoEq,pcmDecodeWav,pcmEncodeWav,pcmMixValidate,pcmPreview,pcmAdopt,pcmImport,pcmHistory,pcmEditor,pcmOpen,pcmChange,pcmShowPreview,pcmCancel,pcmCommit,pcmImportFile,pcmApply,pcmUndoRedo,pcmListen,pcmStop,pcmDownload,pcmMixView,pcmInvalidate,lyricsAssignmentPreview,adoptLyricsAssignment,lyricsSavedRows,lyricsAssignmentView,openLyricsAssignment,changeLyricsAssignment,cancelLyricsAssignment,previewLyricsAssignment,saveLyricsAssignment,lyricsEditor,ASSET_VERSION,HOME_ROUTE,PROJECTS_ROUTE,NEW_ROUTE,EDIT_ROUTE,MIDI_EDITOR_ROUTE,SETTINGS_ROUTE,BACKUP_ROUTE,LOGIC_PRO_ROUTE,FORMAT,SCHEMA_VERSION,APP_VERSION,DB_NAME,STORE_NAME,SETTINGS_STORE_NAME,AUTO_BACKUP_STORE_NAME,MIDI_HISTORY_STORE_NAME,MIDI_IMPORT_HISTORY_STORE_NAME,SETTINGS_FORMAT,SETTINGS_VERSION,BACKUP_FORMAT,BACKUP_VERSION,LAST_PROJECT_KEY,FEATURES:FEATURES.map(item=>({...item})),STATUS_LABELS:{...STATUS_LABELS},PROJECT_STATUS_LABELS:{...PROJECT_STATUS_LABELS},state,defaultSettings,normalizeSettings,validateSettings,makeProject,validateProject,safeFileName,fileNameTemplateErrors,renderFileName,memoryRepository,indexedDbRepository,setRepository,loadSettings,refresh,homeView,createView,listView,editView,midiEditorView,settingsView,backupView,logicProView,placeholderView,renderRoute,isMusicRoute,installHostRoutes,mountStandalone,initialize,submitCreate,submitEdit,duplicateProject,askDelete,exportProject,importText,importFile,selectedMidiProject,midiExportInput,midiExportSummary,requestMidiExport,cancelMidiExport,createMidiTestProject,performMidiExport,loadMidiHistory,inspectMidiFile,cancelMidiImport,loadMidiImportHistory,saveMidiImport,importMidiAsNew,importMidiAsDuplicate,inspectAudioReference,openMidiEditor,openPart,openMelody,openLogicPro,drumNoteName,noteLabelMode,updateNoteLabelElement,updateNoteLabelLayout,editorVisibleBarRange,syncEditorPianoPosition,editorPlaybackTracks,editorSelectPart,editorSelectNote,editorToggleMultiSelect,editorSelectAllNotes,editorStartNoteDrag,editorStartMarqueeSelection,editorStartNoteResize,editorMoveSelected,editorResizeSelected,editorSetSnap,editorToggleSnap,editorResetZoom,editorMatchDuration,editorMatchVelocity,editorClearSelection,editorHandleShortcut,editorZoom,editorAddMeasures,editorRemoveMeasures,editorFitPitchRange,editorRememberPitchScroll,editorPreviewPitch,editorAddNote,editorDeleteNote,editorLockSelectedNotes,editorUnlockSelectedNotes,editorUndo,editorRedo,editorCopy,editorPaste,editorDuplicate,editorToggleMeasure,editorSelectMeasureRange,editorToggleLock,editorPrepareRegeneration,editorPianoInput,editorInitializeMidi,editorSelectMidiInput,editorSelectMidiTarget,editorStartMidiRecording,editorStopMidiRecording,editorStopTransport,editorPlayMelody,editorStopMelody,editorUpdateTransposeSettings,editorPreviewTranspose,editorCancelTranspose,editorApplyTranspose,editorPreviewSongTranspose,editorCancelSongTranspose,editorApplySongTranspose,editorUpdateCorrectionGuide,editorPreviewCorrection,editorToggleCorrectionPreview,editorCancelCorrection,editorApplyCorrection,editorDrumInput,editorGenerateCandidate,editorApplyCandidate,editorUpdateSelected,saveMidiEditor,hasUnsavedChanges,markDirty,markSettingsDirty,updateFileNamePreview,saveSettingsForm,persistSettings,discardSettings,resetSettings,exportSettings,importSettingsText,importFile,backupObject,validateBackup,inspectBackupCompleteness,exportBackup,previewBackupText,previewBackupFile,restoreBackup,restorePreflight,cancelBackupRestore,restorePreviewedBackup,clearBackupPreview,loadAutoBackups,runAutoBackupCheck,checkAutoBackupNow,restoreAutoBackup,backupSignature,saveCurrentProject,configureAutosave,cancelScheduledSave,cancelEdit,clearNotice,getSettings(){return clone(state.settings||defaultSettings())},getMidiSettings(){return clone((state.settings||defaultSettings()).midi)},getLogicProSettings(){return clone((state.settings||defaultSettings()).logicPro)},searchProjects(value){state.search=value;const query=String(value).normalize('NFKC').trim().toLocaleLowerCase('ja');const items=matchingProjects(query);const target=root.document?.querySelector('.music-project-list');if(target)target.innerHTML=items.map(projectRow).join('')||`<div class="music-empty"><p>${query?'検索条件に一致するプロジェクトはありません。':'プロジェクトはまだありません。'}</p><button class="music-primary" onclick="MusicStudio.goNew()">最初のプロジェクトを作る</button></div>`},openProject(id){if(!guardLeave())return false;cancelScheduledSave();state.dirty=false;setLastProject(id);routeTo(`${EDIT_ROUTE}/${encodeURIComponent(id)}`);return true},goHome(){go(HOME_ROUTE)},goProjects(){go(PROJECTS_ROUTE)},goNew(){go(NEW_ROUTE)},goBackup(){go(BACKUP_ROUTE)},goSettings(){go(SETTINGS_ROUTE)}};
  Object.assign(api,{longMasterWorkspaceState,longMasterOpenFocused,longMasterFocusedView,longMasterSelectAsset,longMixVersionsValidate,longMixVersionCapture,longMixVersionSave,longMixVersionRecall,longMixVersionsView,masterOpenFocused,masterFocusedView,masterRecipesValidate,masterRecipeCapture,masterCompare,masterChoose,masterCompareSubmit,masterRecipeSave,masterRecipeRecall,masterChoices,pcmOpenFocused,pcmFocusedView,mixWorkspaceToggle,pcmVersionsValidate,pcmVersionCapture,pcmVersionPreview,pcmVersionSave,pcmVersionSelect,pcmVersionsView,longMasterInvalidate,longMasterCompare,longMasterSelect,longMasterCompareSubmit,longMasterPreview,longMasterSubmit,longMasterView,masterGainPlan,masterMeasure,masterPreview,harmonyPreview,harmonyTone,productionPreview,productionSubmit,productionSave,productionListen,productionCancel,productionView});
  api.prepareForShutdown=prepareForShutdown;
  api.finalFileRecord=finalFileRecord;
  api.finalHandoff=finalHandoff;
  api.logicMidiDifference=logicMidiDifference;
  api.logicConfirmTrackCandidates=logicConfirmTrackCandidates;
  api.logicImportAudioReturn=logicImportAudioReturn;
  api.logicImportStemReturns=logicImportStemReturns;api.logicSelectStems=logicSelectStems;api.logicImportStemForm=logicImportStemForm;
  api.createAIProject=createAIProject;
  api.repaintEditor=repaintEditor;
  api.editorSetBpm=editorSetBpm;
  api.midiExportTrackInput=midiExportTrackInput;
  api.performCurrentTrackMidiExport=performCurrentTrackMidiExport;
  Object.assign(api,{editorUpdateTempoChange,editorPreviewTempoChange,editorApplyTempoChange,editorRemoveTempoChange,editorClearTempoChanges});
  api.editorToggleMidiRecording=editorToggleMidiRecording;
  api.editorSetTrackMuted=editorSetTrackMuted;
  api.editorSetTrackSolo=editorSetTrackSolo;
  api.editorToggleCountIn=editorToggleCountIn;
  api.editorToggleMetronome=editorToggleMetronome;
  api.editorSetQuantize=editorSetQuantize;
  api.editorToggleQuantize=editorToggleQuantize;
  api.editorApplyQuantize=editorApplyQuantize;
  api.editorSetSelectedNoteLength=editorSetSelectedNoteLength;
  api.editorStartPartialEdit=editorStartPartialEdit;
  api.editorPreviewPartialEditPitchUp=editorPreviewPartialEditPitchUp;
  api.editorRunPartialEditProvider=editorRunPartialEditProvider;
  api.editorApplyPartialEdit=editorApplyPartialEdit;
  api.editorCancelPartialEdit=editorCancelPartialEdit;
  api.editorPreviewPitchFromKey=editorPreviewPitchFromKey;
  api.pianoPitchY=pianoPitchY;api.pianoYToPitch=pianoYToPitch;
  api.editorToggleMelodyPlayback=editorToggleMelodyPlayback;
  api.editorSetPlayheadPosition=editorSetPlayheadPosition;
  api.editorStartPlayheadMove=editorStartPlayheadMove;
  api.editorStartLoopRange=editorStartLoopRange;
  api.editorToggleLoop=editorToggleLoop;
  api.editorClearLoop=editorClearLoop;
  api.editorUpdateNoteLengthSettings=editorUpdateNoteLengthSettings;
  api.editorPreviewNoteLength=editorPreviewNoteLength;
  api.editorCancelNoteLength=editorCancelNoteLength;
  api.editorApplyNoteLength=editorApplyNoteLength;
  api.editorPreviewScopedMidiRepair=editorPreviewScopedMidiRepair;
  api.editorCancelScopedMidiRepair=editorCancelScopedMidiRepair;
  api.editorApplyScopedMidiRepair=editorApplyScopedMidiRepair;
  api.editorPreviewGeneratedMidiCleanup=editorPreviewGeneratedMidiCleanup;
  api.editorCancelGeneratedMidiCleanup=editorCancelGeneratedMidiCleanup;
  api.editorApplyGeneratedMidiCleanup=editorApplyGeneratedMidiCleanup;
  api.editorSetEditRange=editorSetEditRange;
  api.editorCloseCorrectionPanel=editorCloseCorrectionPanel;
  api.editorClosePopup=editorClosePopup;
  api.editorHandlePopupToggle=editorHandlePopupToggle;
  api.importSettingsFile=importSettingsFile;
  api.cancelFileIngress=cancelFileIngress;
  api.guardedJsonFile=guardedJsonFile;
  api.openHelp=openHelp;
  api.closeHelp=closeHelp;
  api.externalSongImportHtml=externalSongImportHtml;
  api.importExternalSongFile=importExternalSongFile;
  api.externalTrackReviewHtml=externalTrackReviewHtml;
  api.COORDINATED_REVISION=1;
  api.editorDraftExternalTrackAssignment=editorDraftExternalTrackAssignment;
  api.editorApplyExternalTrackAssignments=editorApplyExternalTrackAssignments;
  api.editorCancelExternalTrackAssignments=editorCancelExternalTrackAssignments;
  api.openFirstSongWindow=openFirstSongWindow;
  api.focusMusicStudio=focusMusicStudio;
  api.goDreamArchitect=goDreamArchitect;
  api.openProject=function(id){if(!guardLeave())return false;cancelScheduledSave();state.dirty=false;setLastProject(id);routeTo(`${EDIT_ROUTE}/${encodeURIComponent(id)}`);return true};
  Object.assign(api,{setWorkRequestText(value){workspaceRequestText=String(value||'').slice(0,240)},setWorkProject(id){if(state.projects.some(p=>p.projectId===id)||id==='')workspaceProjectId=id},setWorkspaceExpanded(open){workspaceExpanded=Boolean(open)},normalizeWorkspace,setWorkMode,toggleFavorite,setWorkActionVisible,resolveWorkRequest,previewWorkRequest,openRequestedWorkAction,workActionTarget,openWorkAction,workspaceView});
  Object.assign(api,{editorLoadAcoustic,editorAdoptInstrument,editorAutoMapInstrument,instrumentEditPreset,instrumentDuplicatePreset,instrumentEntries,prepareInstruments,instrumentMenu,editorSetInstrument,instrumentAdvancedMenu,editorAddInstrumentRegion,editorEditInstrumentRegion,editorRemoveInstrumentRegion,editorLoadInstrumentPreset,editorAuditionInstrument,instrumentSavePreset,instrumentRenameAsset,instrumentOpenMix,instrumentProjectCommit});
  Object.assign(api,{matchingProjects,versionDisclosureChanged,versionCaptureChanged,productionDraftChange,productionDayChange,productionDaySave,productionDaySubmit,finishedFork,finishedOpen,finishedOpenSubmit,productionSessionChange,productionSessionSave,productionSessionSubmit,finishedVersions,productionHistoryView,repaint:requestPaint,inspectStoredDependencies,archiveCapacity,versionTimeline,recoverMissingBinary,recoverMissingBinarySubmit,binaryRecoveryView,versionRangeCompose,versionRebind,versionPanel,versionSnapshot,versionSnapshots,versionValidate,versionCapture,versionCompare,versionCompose,versionStep,versionCancel,versionCommit,versionSave,versionPreview,versionListen,versionListenStop,versionAuditionRender,versionApply,versionUndoRedo,versionSubmit,versionPreviewSubmit,versionSelectionChanged,versionView});
  Object.assign(api,{logicInstrumentOpen,logicInstrumentView,logicInstrumentRecommend,logicInstrumentRegister,logicInstrumentApply,logicInstrumentUndo,logicInstrumentBatchApply,logicInstrumentInventory,logicInstrumentExport});
  api.autoFinishListenInput=autoFinishListenInput;
  // Project-owned MIDI materials travel through the existing atomic project and backup paths.
  function materialValidate(items){
    if(!Array.isArray(items)||items.length>64)throw Error('material-library-capacity');const ids=new Set();
    for(const m of items){if(!m||m.format!=='nova-midi-material-v1'||typeof m.id!=='string'||!m.id||ids.has(m.id)||typeof m.name!=='string'||!m.name.trim()||m.name.length>120||typeof m.description!=='string'||m.description.length>1000||!Number.isFinite(m.bpm)||m.bpm<20||m.bpm>400)throw Error('material-invalid');ids.add(m.id);
      if(!m.midiData||!Array.isArray(m.midiData.tracks)||!m.midiData.tracks.length||m.midiData.tracks.some(t=>t.sampleInstrument||!t.id))throw Error('material-external-instrument-unsupported');
      if(m.midiData.tempo!==m.bpm)throw Error('material-tempo-mismatch');if(m.midiData.tracks.some(t=>!Array.isArray(t.notes)||t.notes.some(n=>!Number.isSafeInteger(n.pitch)||!Number.isSafeInteger(n.startTick)||!Number.isSafeInteger(n.durationTicks))))throw Error('material-canonical-notes-required');const check=validateRestoredMidi({midiData:m.midiData});if(check.errors.length)throw Error(check.errors.join(';'));}
    if(JSON.stringify(items).length>2097152)throw Error('material-library-capacity');return items;
  }
  let materialSaving=false;const projectDiagnostics=new Map();
  function materialSearch(query=''){const terms=String(query).normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);return state.projects.flatMap(p=>(p.materialLibrary||[]).map(m=>({...clone(m),owner:p.projectId}))).filter(m=>terms.every(t=>(m.name+' '+m.description).normalize('NFKC').toLocaleLowerCase().includes(t)));}
  async function materialCapture(id,input={}){
    if(materialSaving||workspaceBusy())return{ok:false,error:'material-busy'};const target=repository,p=state.projects.find(p=>p.projectId===id),baseline=JSON.stringify(p);materialSaving=true;
    try{if(!p?.midiData)throw Error('material-midi-required');const midi=clone(p.midiData);if(midi.tempo===undefined)midi.tempo=p.musicalSettings.bpm;const start=Number(input.startTick??0),end=Number(input.endTick??midi.totalTick??Math.max(0,...midi.tracks.flatMap(t=>t.notes.map(n=>n.startTick+n.durationTicks))));
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start)throw Error('material-range-invalid');
      if(start!==0&&['tempoMap','timeSignatureMap','keySignatureMap'].some(f=>(midi[f]||[]).some(e=>e.tick>0)))throw Error('material-range-variable-map-unsupported');
      for(const t of midi.tracks){if(t.notes.some(n=>n.startTick<start&&n.startTick+n.durationTicks>start||n.startTick<end&&n.startTick+n.durationTicks>end))throw Error('material-boundary-note');t.notes=t.notes.filter(n=>n.startTick>=start&&n.startTick<end).map(n=>({...n,startTick:n.startTick-start}));}
      if(!midi.tracks.some(t=>t.notes.length))throw Error('material-empty');midi.totalTick=end-start;delete midi.editor;
      for(const f of ['tempoMap','timeSignatureMap','keySignatureMap'])if(midi[f])midi[f]=midi[f].filter(e=>e.tick===0||e.tick>=start&&e.tick<end).map(e=>({...e,tick:e.tick===0?0:e.tick-start}));
      if(midi.markers)midi.markers=midi.markers.filter(e=>e.tick>=start&&e.tick<end).map(e=>({...e,tick:e.tick-start}));
      const item={format:'nova-midi-material-v1',id:uuid(),name:String(input.name||'').trim(),description:String(input.description||''),bpm:p.musicalSettings.bpm,key:p.musicalSettings.key,createdAt:now(),sourceRevision:p.revision,sourceRange:{startTick:start,endTick:end},midiData:midi};const next=versionTouch(clone(p));next.materialLibrary=[...(p.materialLibrary||[]),item];materialValidate(next.materialLibrary);
      next.productionHistory.push({id:uuid(),type:'material-capture',createdAt:now(),materialId:item.id});automaticEditRecord(p,next,'material-library');if(!validateProject(next).valid)throw Error('material-project-invalid');
      const guard=()=>{if(repository!==target||workspaceBusy()||JSON.stringify(state.projects.find(x=>x.projectId===id))!==baseline)throw Error('material-stale')};guard();await target.compareAndPut(next,baseline,guard);state.projects=state.projects.map(x=>x.projectId===id?next:x);return{ok:true,material:item};
    }catch(e){return{ok:false,error:e.message}}finally{materialSaving=false;requestPaint()}
  }
  function materialExport(owner){const p=state.projects.find(p=>p.projectId===owner);materialValidate(p?.materialLibrary);return downloadJson('nova-midi-materials.json',{format:'nova-midi-library-v1',materials:clone(p.materialLibrary)});}
  async function materialImport(owner,file){
    if(materialSaving||workspaceBusy())return{ok:false,error:'material-busy'};const target=repository,p=state.projects.find(p=>p.projectId===owner),baseline=JSON.stringify(p);materialSaving=true;
    try{if(!p||!file||!Number.isSafeInteger(file.size)||file.size>2097152)throw Error('material-file-invalid');const text=await file.text();if(text.length>2097152)throw Error('material-library-capacity');const bundle=JSON.parse(text);if(bundle.format!=='nova-midi-library-v1')throw Error('material-file-format');materialValidate(bundle.materials);if(!bundle.materials.length)throw Error('material-empty');
      const next=versionTouch(clone(p));next.materialLibrary=[...(p.materialLibrary||[]),...bundle.materials.map(m=>({...clone(m),id:uuid()}))];materialValidate(next.materialLibrary);next.productionHistory.push({id:uuid(),type:'material-import',createdAt:now(),count:bundle.materials.length});automaticEditRecord(p,next,'material-library');if(!validateProject(next).valid)throw Error('material-project-invalid');
      const guard=()=>{if(repository!==target||workspaceBusy()||JSON.stringify(state.projects.find(x=>x.projectId===owner))!==baseline)throw Error('material-stale')};guard();await target.compareAndPut(next,baseline,guard);state.projects=state.projects.map(x=>x.projectId===owner?next:x);return{ok:true,count:bundle.materials.length};
    }catch(e){return{ok:false,error:e.message}}finally{materialSaving=false;requestPaint()}
  }
  async function materialImportSubmit(event,owner){const r=await materialImport(owner,event.target.elements.materialFile.files[0]);notice(r.ok?'MIDI素材を読み込みました。':r.error,r.ok?'success':'error');return r;}
  async function materialCreate(owner,materialId,options={}){
    if(materialSaving||workspaceBusy())return{ok:false,error:'material-busy'};const target=repository,p=state.projects.find(p=>p.projectId===owner),baseline=JSON.stringify(p);materialSaving=true;
    try{materialValidate(p?.materialLibrary);const m=p.materialLibrary.find(m=>m.id===materialId);if(!m)throw Error('material-not-found');const shift=Number(options.semitones??0),bpm=Number(options.bpm??m.bpm);if(!Number.isInteger(shift)||Math.abs(shift)>24||!Number.isFinite(bpm)||bpm<20||bpm>400)throw Error('material-adjustment-invalid');
      const midi=clone(m.midiData);for(const t of midi.tracks){t.id=uuid();for(const n of t.notes){n.id=uuid();if(t.channel!==10&&t.part!=='drums'){n.pitch+=shift;if(n.pitch<0||n.pitch>127)throw Error('material-pitch-range');}}}midi.tempo=bpm;for(const e of midi.tempoMap||[]){e.bpm=(e.bpm??60000000/e.microsecondsPerQuarter)*bpm/m.bpm;if(e.bpm<20||e.bpm>400)throw Error('material-tempo-range');e.microsecondsPerQuarter=Math.round(60000000/e.bpm);}
      // Transposed key signatures require spelling policy; omit old key declarations rather than retain false ones.
      if(shift)delete midi.keySignatureMap;
      const out=makeProject({projectName:m.name+' — 素材から作成',bpm,key:shift?null:m.key,timeSignature:`${midi.timeSignature?.numerator||4}/${midi.timeSignature?.denominator||4}`,midiData:midi});out.productionHistory.push({id:uuid(),type:'material-create',createdAt:now(),sourceProjectId:owner,materialId,sourceRevision:m.sourceRevision,semitones:shift,bpm});if(!validateProject(out).valid||validateRestoredMidi(out).errors.length)throw Error('material-project-invalid');
      const guard=()=>{if(repository!==target||workspaceBusy()||JSON.stringify(state.projects.find(x=>x.projectId===owner))!==baseline)throw Error('material-stale')};guard();await target.compareAndFork(out,owner,baseline,guard);if(repository!==target)return{ok:true,committed:true,refreshPending:true,project:out};state.projects.push(out);return{ok:true,committed:true,project:out};
    }catch(e){return{ok:false,error:e.message}}finally{materialSaving=false;requestPaint()}
  }
  let performanceDisplayReduced=false;
  const performanceReports=new Map();
  function performanceSnapshot(){return JSON.stringify(state.projects)}
  async function performanceDiagnose(id){
    if(workspaceBusy()||!state.projects.some(p=>p.projectId===id))return{ok:false,error:'performance-busy-or-missing'};
    const baseline=performanceSnapshot(),route=currentRoute(),target=repository,clock=()=>root.performance?.now?.()??Date.now(),start=clock();
    const projects=state.projects.map(p=>({id:p.projectId,tracks:p.midiData?.tracks?.length||0,notes:(p.midiData?.tracks||[]).reduce((n,t)=>n+(t.notes?.length||0),0),audioAssets:p.audioAssets?.length||0}));
    const report={checkedAt:now(),projects,totals:{projects:projects.length,tracks:projects.reduce((n,p)=>n+p.tracks,0),notes:projects.reduce((n,p)=>n+p.notes,0)},domNodes:root.document?.querySelectorAll?.('*')?.length??null,noteElements:root.document?.querySelectorAll?.('.music-midi-note')?.length??null,inventoryMs:Math.max(0,clock()-start),eventLoopDelayMs:null,measurements:null,storage:null,causes:[],unavailable:['CPU使用率・音声dropout・聴感・実機効果は確認できません']};
    if(root.setTimeout){const samples=[];for(let i=0;i<3;i++){const at=clock();await new Promise(resolve=>root.setTimeout(resolve,16));samples.push(Math.max(0,clock()-at-16))}report.eventLoopDelayMs=samples;}
    report.measurements={...performanceMeasurementReport(),audio:root.MusicStudioAudio?.performanceSnapshot?.()??null};
    const context=state.melodyAudio.synth?.context;
    report.audioContext=context?{state:context.state??'unknown',sampleRate:Number.isFinite(context.sampleRate)?context.sampleRate:null,baseLatencySeconds:Number.isFinite(context.baseLatency)?context.baseLatency:null,outputLatencySeconds:Number.isFinite(context.outputLatency)?context.outputLatency:null}:null;
    report.measurementNotes=['render: 画面再描画の同期JavaScript時間（GPU/paintは含まない）','paintDispatch: DOM更新を含む再描画呼出。renderを含むため合算不可','noteLayout: 音符ラベル更新時間。renderと重なる場合があり合算不可','scheduling: 音源準備とノート予約の同期処理時間','audio: OfflineAudioContext.startRendering完了までの実測経過時間（CPU時間ではない）','eventLoopDelayMs: 16msタイマーの超過時間。単独では原因を確定しない','計測値はこの起動中の直近64回以内。未実行・非対応はnull/未観測。閾値は診断目安で品質合否ではない'];
    for(const [kind,threshold] of [['render',16.67],['paintDispatch',16.67],['noteLayout',16.67],['scheduling',10]]){const metric=report.measurements[kind];if(metric?.maxMs>threshold)report.causes.push({id:kind+'-duration',kind:'実処理の計測・原因候補',evidence:metric,threshold,unit:'ms',action:kind==='noteLayout'?'short-labels':null})}
    if(!report.measurements.render)report.unavailable.push('画面描画の実処理はまだ未観測');
    if(!report.measurements.scheduling)report.unavailable.push('ノート予約処理はまだ未観測');
    if(!report.measurements.audio?.count)report.unavailable.push('音声レンダリングの実処理はまだ未観測');
    if(root.document?.visibilityState==='hidden')report.unavailable.push('バックグラウンド中のタイマーは制限されるため前面で再測定してください');
    try{const estimate=await root.navigator?.storage?.estimate?.();if(estimate)report.storage={usage:estimate.usage??null,quota:estimate.quota??null}}catch(e){report.unavailable.push('保存容量を確認できません')}
    if(report.noteElements>=500)report.causes.push({id:'note-label-layout',evidence:report.noteElements,threshold:500,kind:'負荷候補',action:'short-labels'});
    if(report.domNodes>=5000)report.causes.push({id:'large-dom',evidence:report.domNodes,threshold:5000,kind:'負荷候補'});
    if(report.eventLoopDelayMs?.some(n=>n>50))report.causes.push({id:'event-loop-delay',evidence:report.eventLoopDelayMs,threshold:50,kind:'観測された遅延・原因未確定'});
    if(target!==repository||route!==currentRoute()||baseline!==performanceSnapshot()||workspaceBusy())return{ok:false,error:'performance-stale'};
    performanceReports.set(id,{baseline,route,report});const panels=root.document?.querySelectorAll?.('[data-performance-panel]')||[];for(const panel of panels)if(panel.dataset?.performancePanel===id){panel.outerHTML=performanceView(state.projects.find(p=>p.projectId===id)).replace('<details>','<details open>');}return{ok:true,report};
  }
  function performanceReduce(id,enabled=true){
    const d=performanceReports.get(id);if(workspaceBusy()||typeof enabled!=='boolean'||enabled&&(!d||d.route!==currentRoute()||d.baseline!==performanceSnapshot()||!d.report.causes.some(c=>c.action==='short-labels')))return{ok:false,error:'performance-reduction-requires-current-diagnosis'};
    performanceDisplayReduced=enabled;updateNoteLabelLayout();const status=root.document?.querySelector?.('[data-performance-status]');if(status)status.textContent=enabled?'表示を軽量化しました。音声・曲は変更していません。':'通常表示に戻しました。';return{ok:true,enabled,scope:'音符ラベルの自動幅計測のみ。再起動で通常表示。音声・曲・Undo・保存設定は変更しません。'};
  }
  function performanceView(p){const d=performanceReports.get(p.projectId),id=escapeHtml(JSON.stringify(p.projectId));return `<div data-performance-panel="${escapeHtml(p.projectId)}"><details><summary>全体性能診断・表示の軽量化</summary><button type="button" onclick="MusicStudio.performanceDiagnose(${id})">全プロジェクトと現在の画面を測定</button><p>数値は観測値です。原因候補は確定原因ではありません。音声は変更しません。</p><p data-performance-status role="status">${performanceDisplayReduced?'短縮ラベル表示中':'通常表示'}</p>${d?`<pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(d.baseline===performanceSnapshot()?JSON.stringify(d.report,null,2):'変更されています。再診断してください。')}</pre><button type="button" onclick="MusicStudio.performanceReduce(${id},true)">診断に基づき音符ラベルを短縮</button><button type="button" onclick="MusicStudio.performanceReduce(${id},false)">通常ラベルに戻す</button>`:''}</details></div>`}
  async function productionDiagnose(id){
    if(workspaceBusy()||materialSaving)return{ok:false,error:'diagnosis-busy'};try{const p=state.projects.find(p=>p.projectId===id);if(!p)return{ok:false,error:'project-not-found'};const baseline=JSON.stringify(p),target=repository;
    const report={checkedAt:now(),project:validateProject(p),midi:validateRestoredMidi(p),recordings:[],backup:validateBackup(backupObject()),automaticBackups:[],dependencies:null};
    try{for(const b of await target.listAutoBackups?.()||[])report.automaticBackups.push({id:b.backupId,createdAt:b.createdAt,metadata:validateBackup(b.snapshot),audio:b.archive?'archive-present-bytes-unverified':'no-archive'});}catch(e){report.automaticBackupError=e.message}
    const dependencies=await inspectStoredDependencies(id);report.dependencies=dependencies.ok?dependencies.report:{error:dependencies.error};
    for(const m of await target.listVocalJournals?.()||[])if(m.owner===id){const r=await vocalJournalAction(m.id,false,true);report.recordings.push({id:m.id,...r});}
    if(target!==repository||JSON.stringify(state.projects.find(x=>x.projectId===id))!==baseline)return{ok:false,error:'diagnosis-stale'};
    report.scope='Stored project/MIDI, metadata backup, authenticated dependencies and recording journals; performance and audible quality unverified';projectDiagnostics.set(id,{baseline,report});requestPaint();return{ok:true,report};}catch(e){notice('診断できません：'+e.message,'error');return{ok:false,error:e.message}}
  }
  function openDiagnosticRepair(){const panel=root.document?.querySelector?.('.music-song-versions');if(!panel)return false;panel.open=true;const input=panel.querySelector('[name=recoveryFile]');if(input){const details=input.closest('details');if(details)details.open=true;input.scrollIntoView?.({block:'center'});}else panel.scrollIntoView?.({block:'start'});return true;}
  function projectCostSummary(p){try{return root.MusicStudioAIWorkflow?.localCostSummary?.(p.aiWorkspace)||{status:'unavailable'}}catch(e){return{status:'unverified',error:e.message}}}
  function productionToolsView(p){const h=escapeHtml,id=JSON.stringify(p.projectId),d=projectDiagnostics.get(p.projectId);return `<details><summary>診断・素材・AI料金</summary>${performanceView(p)}<button type="button" onclick="${h(`MusicStudio.productionDiagnose(${id})`)}">診断する（原本保持）</button>${d?`<pre style="white-space:pre-wrap;overflow-wrap:anywhere">${h(d.baseline===JSON.stringify(p)?JSON.stringify(d.report,null,2):'曲が変更されています。再診断してください。')}</pre>`:''}<button type="button" onclick="MusicStudio.openDiagnosticRepair()">元ファイルの復旧画面を開く</button><p>録音の修復・退避はボーカル画面の未完了録音から選択します。欠落した依存ファイルはCheckpoints内の照合復旧を使用します。破損本体は置換しません。</p><p>AI料金：現在のアプリ内ローカル処理のAPI料金は0。有料処理・未確認料金は実行を拒否します。外部サービスでの利用額は確認できません。有料Providerの月額台帳・精算は未実装です。</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${h(JSON.stringify(projectCostSummary(p),null,2))}</pre><form onsubmit="event.preventDefault();MusicStudio.materialCaptureSubmit(event,${h(id)})"><label>素材名<input name="name" maxlength="120" required></label><label>検索用の説明<input name="description" maxlength="1000"></label><label>開始tick<input name="startTick" type="number" min="0" value="0"></label><label>終了tick（空欄は曲末）<input name="endTick" type="number" min="1"></label><button>現在のMIDIを素材保存</button></form><p>MIDIだけを保存します。音声・歌詞・外部音源設定は含みません。境界をまたぐ音符や途中からの可変テンポ素材は拒否します。</p><form onsubmit="event.preventDefault();MusicStudio.materialSearchSubmit(event)"><label>素材を文章で絞り込み<input name="query" maxlength="240"></label><button>検索</button></form><button type="button" onclick="${h(`MusicStudio.materialExport(${id})`)}">MIDI素材JSONを書き出す</button><form onsubmit="event.preventDefault();MusicStudio.materialImportSubmit(event,${h(id)})"><label>MIDI素材JSON<input type="file" name="materialFile" accept=".json,application/json" required></label><button>このプロジェクトへ素材を読み込む</button></form><div id="music-material-results">${materialResults('')}</div></details>`;}
  function materialResults(query){const h=escapeHtml;return materialSearch(query).map(m=>`<form onsubmit="event.preventDefault();MusicStudio.materialCreateSubmit(event,${h(JSON.stringify(m.owner))},${h(JSON.stringify(m.id))})"><p>${h(m.name)} · ${h(m.description)}</p><label>BPM<input name="bpm" type="number" min="20" max="400" step="any" value="${h(m.bpm)}"></label><label>移調（半音）<input name="semitones" type="number" min="-24" max="24" value="0"></label><button>別プロジェクトを作成</button></form>`).join('')||'<p>一致する素材はありません。</p>';}
  async function materialCaptureSubmit(event,id){const f=event.target.elements,input={name:f.name.value,description:f.description.value,startTick:Number(f.startTick.value)};if(f.endTick.value)input.endTick=Number(f.endTick.value);const r=await materialCapture(id,input);notice(r.ok?'MIDI素材を保存しました。':r.error,r.ok?'success':'error');requestPaint();return r;}
  async function materialCreateSubmit(event,owner,id){const f=event.target.elements,r=await materialCreate(owner,id,{bpm:Number(f.bpm.value),semitones:Number(f.semitones.value)});notice(r.ok?'別プロジェクトに保存しました。':r.error,r.ok?'success':'error');requestPaint();return r;}
  function materialSearchSubmit(event){const el=root.document?.getElementById('music-material-results');if(el)el.innerHTML=materialResults(event.target.elements.query.value);}
  Object.assign(api,{performanceDiagnose,performanceReduce,performanceView,previewProductionRequest,materialExport,materialImport,materialImportSubmit,openDiagnosticRepair,materialValidate,materialCapture,materialCreate,materialSearch,materialCaptureSubmit,materialCreateSubmit,materialSearchSubmit,productionDiagnose,productionToolsView});
  root.MusicStudio=api;
  if(root.document){for(const type of ['pointerdown','wheel','touchstart','keydown'])root.addEventListener?.(type,event=>{if(state.midiEditor?.coordinatedTimeline&&isMidiEditorRoute(currentRoute()))state.midiEditor.viewInteractionStarted=true},{capture:true,passive:true});root.addEventListener?.('resize',()=>{scheduleNoteLabelLayout();scheduleEditorPianoPosition();root.requestAnimationFrame?.(()=>alignEditorPitchBottomToC(root.document?.querySelector?.('.music-piano-viewport')))});root.addEventListener?.('pagehide',()=>{finalInvalidate();vocalRelease();vocalPlaybackStop();discardLiveRecordingOnUnload();if(state.midiEditor?.dirty)flushMidiEditorAutosave()});root.document.addEventListener?.('visibilitychange',()=>{if(root.document.visibilityState==='hidden'&&vocal.phase==='recording')vocalStop();if(root.document.visibilityState==='hidden'&&state.midiEditor?.dirty)flushMidiEditorAutosave()});root.document.addEventListener?.('toggle',event=>{if(event.target?.matches?.('.music-editor-topbar > .music-editor-menu'))editorHandlePopupToggle(event.target)},true);root.addEventListener?.('beforeunload',event=>{if(state.midiEditor?.dirty)flushMidiEditorAutosave();if(hasUnsavedChanges()){event.preventDefault?.();event.returnValue=''}});if(root.document.body?.dataset.musicStudioStandalone==='true')mountStandalone();else installHostRoutes();initialize()}
})(typeof window!=='undefined'?window:globalThis);
