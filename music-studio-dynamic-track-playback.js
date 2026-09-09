/* Dynamic Track Playback Routing: connect the selected External MIDI Track to the existing transport without expanding editing or recording. */
(function(root){
  'use strict';

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

  function resolveExternalPlaybackTrack(api=root.MusicStudio,core=root.MusicStudioEditor){
    const current=currentExternalSelection(api);if(!current)return null;
    const track=sourceTrack(api,current);if(!track)return null;
    return{...track,id:track.id,part:playbackPart(track,core),notes:Array.isArray(track.notes)?track.notes.map(note=>({...note})):[]}
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

  async function playExternalTrack(api=root.MusicStudio,core=root.MusicStudioEditor){
    const session=api?.state?.midiEditor,audio=api?.state?.melodyAudio,midi=api?.state?.midiInput,track=resolveExternalPlaybackTrack(api,core);
    if(!session||!audio||!track)return{ok:false,reason:'external-track-required'};
    if(!track.notes.length)return{ok:false,reason:'no-notes'};
    if(audio.starting||audio.playing||midi?.recording)return{ok:false,reason:'transport-busy'};
    const synth=audio.synth||(audio.synth=root.MusicStudioAudio?.createSynth?.({volume:.12}));
    if(!synth?.supported?.())return{ok:false,reason:'playback-unavailable'};
    const request=++audio.playRequest;audio.starting=true;audio.status='External Track再生を準備中';
    const unlocked=await synth.unlock();if(request!==audio.playRequest)return{ok:false,reason:'cancelled'};
    if(!unlocked){audio.starting=false;audio.status='';return{ok:false,reason:'playback-unavailable'}}
    audio.starting=false;
    const loop=loopRange(session),total=timelineTicks(session),initial=loop.enabled&&(session.playheadTick<loop.start||session.playheadTick>=loop.end)?loop.start:Math.max(0,Number(session.playheadTick)||0);
    setPlayhead(session,initial);
    const transport=root.MusicStudioPlayback?.createTransportState?.(session.midiData,{playing:true,currentTick:initial,playbackState:audio.playbackState||{}})||{ppq:session.midiData.ppq,bpm:session.midiData.tempo,tempoMap:session.midiData.tempoMap,currentTick:initial};
    const schedule=(startTick,endTick,looping)=>{
      if(request!==audio.playRequest)return{ok:false,reason:'cancelled'};
      synth.stopPlayback?.();
      const result=root.MusicStudioPlayback?.schedulePlaybackTracks?.(synth,[track],{...transport,startTick,endTick,leadSeconds:looping?0:undefined,playbackState:audio.playbackState||{}})||{ok:false,noteCount:0,reason:'track-playback-contract-unavailable'};
      audio.playing=result.ok&&result.noteCount>0;audio.transport={...transport,playing:audio.playing,currentTick:startTick,playbackStartOrigin:result.playbackStart,activePlaybackTrackIds:[track.id]};audio.status=audio.playing?(looping?'External Trackループ再生中':'External Track再生中'):'この範囲に再生できるノートがありません';
      if(!audio.playing)return result;
      const duration=looping?(result.timelineDurationSeconds??Math.max(1,endTick-startTick)*(result.secondsPerTick||0))*1000:result.durationMs;
      audio.playbackTimer=root.setTimeout?.(()=>{if(request!==audio.playRequest)return;if(loop.enabled)schedule(loop.start,loop.end,true);else api.__dynamicTrackPlaybackOriginalToggle?.()},Math.max(1,Number(duration)||1))??null;
      startPlayhead(session,result,request,audio);return result
    };
    return schedule(initial,Math.min(loop.enabled?loop.end:total,total),false)
  }

  function enhancePlaybackUi(api=root.MusicStudio){
    const current=currentExternalSelection(api),page=root.document?.querySelector?.('.music-midi-editor-page');if(!current||!page)return false;
    const track=sourceTrack(api,current),play=page.querySelector?.('[onclick*="editorToggleMelodyPlayback"]'),hasNotes=Array.isArray(track?.notes)&&track.notes.length>0,busy=api.state?.midiInput?.recording||api.state?.midiInput?.countingIn;
    if(play){play.disabled=!hasNotes||Boolean(busy);play.setAttribute('aria-disabled',String(play.disabled));if(!play.disabled)play.title=`${current.name}をTrack IDで再生`}
    page.dataset.currentTrackMode='playback';page.dataset.currentTrackPlaybackId=current.id;
    const heading=page.querySelector?.('#midiEditorTitle');if(heading)heading.title='External MIDI playback is connected by Track ID. Recording / full editing remain gated.';
    return true
  }

  function install(api=root.MusicStudio,core=root.MusicStudioEditor){
    if(!api||!core||!root.MusicStudioPlayback||!api.__dynamicTrackSelectionInstalled||api.__dynamicTrackPlaybackInstalled)return false;
    api.__dynamicTrackPlaybackInstalled=true;
    const originalToggle=api.editorToggleMelodyPlayback,originalShortcut=api.editorHandleShortcut;
    api.__dynamicTrackPlaybackOriginalToggle=originalToggle;
    api.resolveExternalPlaybackTrack=()=>resolveExternalPlaybackTrack(api,core);
    api.editorPlayExternalTrack=()=>playExternalTrack(api,core);
    api.editorToggleMelodyPlayback=function(...args){
      const current=currentExternalSelection(api),audio=api.state?.melodyAudio;
      if(!current)return originalToggle?.apply(this,args);
      if(audio?.playing||audio?.starting||api.state?.midiInput?.recording)return originalToggle?.apply(this,args);
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

  root.MusicStudioDynamicTrackPlayback={currentExternalSelection,resolveExternalPlaybackTrack,playExternalTrack,enhancePlaybackUi,install,bootWithRetry};
  bootWithRetry();if(typeof root.addEventListener==='function')root.addEventListener('hashchange',bootWithRetry);
})(typeof window!=='undefined'?window:globalThis);
