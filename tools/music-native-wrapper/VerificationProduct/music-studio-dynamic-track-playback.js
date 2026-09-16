/* Dynamic Track Playback Routing: connect the selected External MIDI Track to the existing transport without expanding editing or recording. */
(function(root){
  'use strict';

  const ASSET_VERSION='1.0.3';
  const CORE_AUDIO_ROLES=new Set(['melody','drums','bass']);

  function currentExternalSelection(api=root.MusicStudio){
    const current=api?.resolveCurrentTrackSelection?.();
    return current?.kind==='external'&&current?.capabilities?.canPlayMidi===true?current:null
  }

  function sourceTrack(api,current){
    return api?.state?.midiEditor?.midiData?.tracks?.find(track=>String(track?.id||'')===String(current?.id||''))||null
  }

  function playbackPart(track,core=root.MusicStudioEditor){
    const type=core?.resolveTrackType?.(track);
    if(type==='midi-drums')return'drums';
    const role=core?.resolveTrackRole?.(track);
    return CORE_AUDIO_ROLES.has(role)?role:'melody'
  }

  function playbackTrack(api,current,core=root.MusicStudioEditor){
    const track=sourceTrack(api,current);if(!track)return null;
    return{...track,id:track.id,part:playbackPart(track,core),notes:Array.isArray(track.notes)?track.notes.map(note=>({...note})):[]}
  }

  function resolveExternalPlaybackTrack(api=root.MusicStudio,core=root.MusicStudioEditor){
    const current=currentExternalSelection(api);if(!current)return null;
    return playbackTrack(api,current,core)
  }

  function resolveExternalPlaybackTracks(api=root.MusicStudio,core=root.MusicStudioEditor){
    const solos=api?.state?.melodyAudio?.playbackState?.soloByTrackId||{},soloIds=new Set(Object.entries(solos).filter(([,value])=>value===true).map(([id])=>id));
    const model=api?.createTrackSelectionModel?.()||[];
    if(soloIds.size)return model.filter(item=>item?.capabilities?.canPlayMidi===true&&soloIds.has(item.id)).map(item=>playbackTrack(api,item,core)).filter(Boolean);
    const selected=resolveExternalPlaybackTrack(api,core);return selected?[selected]:[]
  }

  function hasExternalSolo(api=root.MusicStudio){const solos=api?.state?.melodyAudio?.playbackState?.soloByTrackId||{},model=api?.createTrackSelectionModel?.()||[];return model.some(item=>item?.kind==='external'&&item?.capabilities?.canPlayMidi===true&&solos[item.id]===true)}

  function externalTrackAudible(trackId,playbackState={}){
    const muted=playbackState?.mutedByTrackId?.[trackId]===true;
    const solos=playbackState?.soloByTrackId||{},hasSolo=Object.values(solos).some(value=>value===true);
    return !muted&&(!hasSolo||solos[trackId]===true)
  }

  function playbackRuntime(tracks=[],playbackState={}){
    const muted={...(playbackState?.mutedByTrackId||{})};
    for(const track of tracks)if(track?.muted===true)muted[track.id]=true;
    return{...(playbackState||{}),mutedByTrackId:muted}
  }

  function timelineTicks(session){
    const ppq=Number(session?.midiData?.ppq)||480,signature=session?.midiData?.timeSignature||{numerator:4,denominator:4},measures=Math.max(1,Number(session?.midiData?.editor?.measureCount)||4);
    return ppq*4/Number(signature.denominator||4)*Number(signature.numerator||4)*measures
  }

  function loopRange(session){
    const editor=session?.midiData?.editor||{},start=Number(editor.loopStart),end=Number(editor.loopEnd),enabled=editor.loopEnabled===true&&Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end>start;
    return{enabled,start:enabled?start:null,end:enabled?end:null}
  }

  function setPlayhead(session,tick){
    if(!session)return;session.playheadTick=Math.max(0,Number(tick)||0);
    const line=root.document?.querySelector?.('.music-playhead'),total=timelineTicks(session);
    if(line&&total>0)line.style.left=`${Math.min(100,session.playheadTick/total*100)}%`
  }

  function startPlayhead(session,result,request,audio){
    if(!root.requestAnimationFrame||!Number.isFinite(result?.playbackStart))return;
    const start=Number(result.startTick)||0;
    const advance=()=>{
      if(!audio.playing||request!==audio.playRequest)return;
      const now=audio.synth?.context?.currentTime;if(!Number.isFinite(now))return;
      const elapsed=Math.max(0,now-result.playbackStart),tick=root.MusicStudioPlayback?.tickAtSeconds?root.MusicStudioPlayback.tickAtSeconds(start,elapsed,session.midiData.ppq,result.tempoMap,session.midiData.tempo):start+elapsed/(result.secondsPerTick||1);
      const current=Math.min(Number(result.endTick)||tick,tick);if(audio.transport)audio.transport.currentTick=current;setPlayhead(session,current);audio.playbackFrame=root.requestAnimationFrame(advance)
    };
    audio.playbackFrame=root.requestAnimationFrame(advance)
  }

  function enhancePlaybackUi(api=root.MusicStudio){
    const current=currentExternalSelection(api),page=root.document?.querySelector?.('.music-midi-editor-page');if(!current||!page)return false;
    const tracks=resolveExternalPlaybackTracks(api),audio=api.state?.melodyAudio||{},play=page.querySelector?.('[onclick*="editorToggleMelodyPlayback"]'),stop=page.querySelector?.('[onclick*="editorStopTransport"]'),hasNotes=tracks.some(track=>Array.isArray(track?.notes)&&track.notes.length>0),busy=api.state?.midiInput?.recording||api.state?.midiInput?.countingIn;
    if(play){play.disabled=!hasNotes||Boolean(busy);play.setAttribute('aria-disabled',String(play.disabled));play.setAttribute('aria-pressed',String(Boolean(audio.playing||audio.starting)));if(!play.disabled)play.title=`${current.name}をTrack IDで再生`}
    if(stop){stop.disabled=!(audio.playing||audio.starting||busy);stop.setAttribute('aria-disabled',String(stop.disabled))}
    page.dataset.currentTrackMode='playback';page.dataset.currentTrackPlaybackId=current.id;
    const heading=page.querySelector?.('#midiEditorTitle');if(heading)heading.title='External MIDI playback is connected by Track ID. Recording / full editing remain gated.';
    return true
  }

  async function stopExternalPlayback(api=root.MusicStudio){
    const stop=api?.editorStopTransport;if(typeof stop!=='function')return{ok:false,reason:'transport-stop-unavailable'};
    const result=await stop.call(api);enhancePlaybackUi(api);return result
  }

  async function playExternalTrack(api=root.MusicStudio,core=root.MusicStudioEditor){
    const session=api?.state?.midiEditor,audio=api?.state?.melodyAudio,midi=api?.state?.midiInput,selected=resolveExternalPlaybackTrack(api,core),tracks=resolveExternalPlaybackTracks(api,core);
    if(!session||!audio||!selected&&!hasExternalSolo(api))return{ok:false,reason:'external-track-required'};
    if(!tracks.length)return{ok:false,reason:'solo-filtered'};
    if(!tracks.some(track=>track.notes.length))return{ok:false,reason:'no-notes'};
    const runtime=playbackRuntime(tracks,audio.playbackState||{}),active=root.MusicStudioPlayback?.activePlaybackTracks?.(tracks,runtime)||tracks.filter(track=>externalTrackAudible(track.id,runtime));
    if(!active.length)return{ok:false,reason:tracks.every(track=>runtime.mutedByTrackId?.[track.id]===true)?'muted':'solo-filtered'};
    if(audio.starting||audio.playing||midi?.recording)return{ok:false,reason:'transport-busy'};
    const synth=audio.synth||(audio.synth=root.MusicStudioAudio?.createSynth?.({volume:.12}));
    if(!synth?.supported?.())return{ok:false,reason:'playback-unavailable'};
    const request=++audio.playRequest;audio.starting=true;audio.status='External Track再生を準備中';enhancePlaybackUi(api);
    const unlocked=await synth.unlock();if(request!==audio.playRequest)return{ok:false,reason:'cancelled'};
    if(!unlocked){audio.starting=false;audio.status='';enhancePlaybackUi(api);return{ok:false,reason:'playback-unavailable'}}
    audio.starting=false;
    const loop=loopRange(session),total=timelineTicks(session),initial=loop.enabled&&(session.playheadTick<loop.start||session.playheadTick>=loop.end)?loop.start:Math.max(0,Number(session.playheadTick)||0);
    setPlayhead(session,initial);
    const transport=root.MusicStudioPlayback?.createTransportState?.(session.midiData,{playing:true,currentTick:initial,playbackState:runtime})||{ppq:session.midiData.ppq,bpm:session.midiData.tempo,tempoMap:session.midiData.tempoMap,currentTick:initial};
    const schedule=(startTick,endTick,looping)=>{
      if(request!==audio.playRequest)return{ok:false,reason:'cancelled'};
      synth.stopPlayback?.();
      const result=root.MusicStudioPlayback?.schedulePlaybackTracks?.(synth,tracks,{...transport,startTick,endTick,leadSeconds:looping?0:undefined,playbackState:runtime})||{ok:false,noteCount:0,reason:'track-playback-contract-unavailable'};
      const activeIds=(root.MusicStudioPlayback?.activePlaybackTracks?.(tracks,runtime)||active).map(track=>track.id);
      audio.playing=result.ok&&result.noteCount>0;audio.transport={...transport,playing:audio.playing,currentTick:startTick,playbackStartOrigin:result.playbackStart,activePlaybackTrackIds:activeIds};audio.status=audio.playing?(looping?(activeIds.length>1?'External Tracksループ再生中':'External Trackループ再生中'):(activeIds.length>1?'External Tracks再生中':'External Track再生中')):'この範囲に再生できるノートがありません';enhancePlaybackUi(api);
      if(!audio.playing)return result;
      const duration=looping?(result.timelineDurationSeconds??Math.max(1,endTick-startTick)*(result.secondsPerTick||0))*1000:result.durationMs;
      audio.playbackTimer=root.setTimeout?.(()=>{if(request!==audio.playRequest)return;if(loop.enabled)schedule(loop.start,loop.end,true);else stopExternalPlayback(api)},Math.max(1,Number(duration)||1))??null;
      startPlayhead(session,result,request,audio);return result
    };
    return schedule(initial,Math.min(loop.enabled?loop.end:total,total),false)
  }

  function install(api=root.MusicStudio,core=root.MusicStudioEditor){
    if(!api||!core||!root.MusicStudioPlayback||!api.__dynamicTrackSelectionInstalled||api.__dynamicTrackPlaybackInstalled)return false;
    api.__dynamicTrackPlaybackInstalled=true;
    api.__dynamicTrackPlaybackVersion=ASSET_VERSION;
    const originalToggle=api.editorToggleMelodyPlayback,originalShortcut=api.editorHandleShortcut;
    api.resolveExternalPlaybackTrack=()=>resolveExternalPlaybackTrack(api,core);
    api.resolveExternalPlaybackTracks=()=>resolveExternalPlaybackTracks(api,core);
    api.editorPlayExternalTrack=()=>playExternalTrack(api,core);
    api.editorToggleMelodyPlayback=function(...args){
      const current=currentExternalSelection(api),externalSolo=hasExternalSolo(api),audio=api.state?.melodyAudio;
      if(!current&&!externalSolo)return originalToggle?.apply(this,args);
      if(audio?.playing||audio?.starting||api.state?.midiInput?.recording)return stopExternalPlayback(api);
      return playExternalTrack(api,core)
    };
    if(typeof originalShortcut==='function')api.editorHandleShortcut=function(event,...args){
      if(currentExternalSelection(api)&&(event?.key===' '||event?.key==='Spacebar')){event?.preventDefault?.();api.editorToggleMelodyPlayback();return true}
      return originalShortcut.call(this,event,...args)
    };
    const run=()=>enhancePlaybackUi(api);run();
    if(typeof root.MutationObserver==='function'&&root.document?.body){const observer=new root.MutationObserver(()=>run());observer.observe(root.document.body,{childList:true,subtree:true});api.__dynamicTrackPlaybackObserver=observer}
    return true
  }

  let timer=null;
  function bootWithRetry(){
    if(install())return true;if(root.MusicStudio?.__dynamicTrackPlaybackInstalled)return true;if(typeof root.setInterval!=='function')return false;
    if(timer!=null)root.clearInterval(timer);let attempts=0;timer=root.setInterval(()=>{attempts+=1;if(install()||root.MusicStudio?.__dynamicTrackPlaybackInstalled||attempts>=200){root.clearInterval(timer);timer=null}},25);return false
  }

  root.MusicStudioDynamicTrackPlayback={ASSET_VERSION,currentExternalSelection,resolveExternalPlaybackTrack,resolveExternalPlaybackTracks,hasExternalSolo,externalTrackAudible,playExternalTrack,stopExternalPlayback,enhancePlaybackUi,install,bootWithRetry};
  bootWithRetry();if(typeof root.addEventListener==='function')root.addEventListener('hashchange',bootWithRetry);
})(typeof window!=='undefined'?window:globalThis);
