/* Dynamic Track Recording Routing: connect the selected Track ID to the existing MIDI recording path without expanding editing scope. */
(function(root){
  'use strict';

  const ASSET_VERSION='1.0.1';

  function resolveRecordingDestination(api=root.MusicStudio,core=root.MusicStudioEditor){
    const session=api?.state?.midiEditor,current=api?.resolveCurrentTrackSelection?.(session);
    if(!session||!current?.id)return null;
    const track=core?.getTrackById?.(session.midiData?.tracks,current.id)||null;
    if(!track||String(track.id)!==String(current.id))return null;
    const capabilities=core?.resolveTrackCapabilities?.(track)||current.capabilities||{};
    return{track,current,trackId:track.id,canRecordMidi:capabilities.canRecordMidi===true,capabilities}
  }

  function currentExternalRecording(api=root.MusicStudio,core=root.MusicStudioEditor){
    const destination=resolveRecordingDestination(api,core);
    return destination?.current?.kind==='external'?destination:null
  }

  function shortcutTargetBlocked(event){
    const raw=event?.target,target=raw?.nodeType===3?raw.parentElement:raw;
    return Boolean(target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))
  }

  function transportShortcut(event){
    if(!event||event.isComposing||event.repeat||shortcutTargetBlocked(event))return null;
    const key=String(event.key||''),code=String(event.code||''),lower=key.toLowerCase(),meta=Boolean(event.metaKey),control=Boolean(event.ctrlKey),shift=Boolean(event.shiftKey),option=Boolean(event.altKey);
    if(!meta&&!control&&!option&&!shift&&(code==='KeyR'||lower==='r'))return'record';
    if(!meta&&!control&&!option&&!shift&&(code==='Space'||key===' '||key==='Spacebar'))return'playback';
    if(!meta&&!option&&(code==='Enter'||code==='NumpadEnter'||key==='Enter'||key==='Return'))return'go-start';
    return null
  }

  function goToStart(api=root.MusicStudio){
    const session=api?.state?.midiEditor;if(!session)return false;
    session.playheadTick=0;
    const line=root.document?.querySelector?.('.music-playhead');if(line)line.style.left='0%';
    return true
  }

  function enhanceRecordingUi(api=root.MusicStudio,core=root.MusicStudioEditor){
    const destination=currentExternalRecording(api,core),page=root.document?.querySelector?.('.music-midi-editor-page');
    if(!destination||!page)return false;
    const midi=api.state?.midiInput||{},busy=Boolean(midi.starting||midi.stopping),active=Boolean(midi.recording||midi.countingIn),record=page.querySelector?.('[onclick*="editorToggleMidiRecording"]');
    if(record){
      record.disabled=!destination.canRecordMidi||busy;
      record.setAttribute('aria-disabled',String(record.disabled));
      record.setAttribute('aria-pressed',String(active));
      record.title=destination.canRecordMidi?`${destination.current.name}へTrack ID ${destination.trackId}で録音`:'このTrackはRecording capabilityを持っていません。';
    }
    page.dataset.currentTrackRecordingId=destination.trackId;
    page.dataset.currentTrackCanRecordMidi=String(destination.canRecordMidi);
    page.dataset.recordingCapabilityGate=destination.canRecordMidi?'open':'closed';
    return true
  }

  function install(api=root.MusicStudio,core=root.MusicStudioEditor){
    if(!api||!core||!api.__dynamicTrackSelectionInstalled||api.__dynamicTrackRecordingInstalled)return false;
    const originalStart=api.editorStartMidiRecording,originalToggle=api.editorToggleMidiRecording,originalShortcut=api.editorHandleShortcut;
    if(typeof originalStart!=='function'||typeof originalToggle!=='function'||typeof originalShortcut!=='function')return false;
    api.__dynamicTrackRecordingInstalled=true;
    api.__dynamicTrackRecordingVersion=ASSET_VERSION;
    api.resolveRecordingDestination=()=>resolveRecordingDestination(api,core);

    api.editorStartMidiRecording=async function(...args){
      const destination=resolveRecordingDestination(api,core);
      if(!destination)return{ok:false,reason:'recording-track-required'};
      if(!destination.canRecordMidi)return{ok:false,reason:'recording-capability-required',targetTrackId:destination.trackId};
      const expectedTrackId=String(destination.trackId),result=await originalStart.apply(this,args);
      const midi=api.state?.midiInput;
      if((midi?.recording||midi?.countingIn)&&String(midi.recordingTrackId||'')!==expectedTrackId){
        await api.editorStopTransport?.();
        return{ok:false,reason:'recording-track-id-mismatch',expectedTrackId,actualTrackId:midi?.recordingTrackId||null}
      }
      enhanceRecordingUi(api,core);
      return result
    };

    api.editorToggleMidiRecording=function(...args){
      const destination=currentExternalRecording(api,core);
      if(!destination)return originalToggle.apply(this,args);
      const midi=api.state?.midiInput||{};
      if(!destination.canRecordMidi)return Promise.resolve({ok:false,reason:'recording-capability-required',targetTrackId:destination.trackId});
      if(midi.stopping||midi.starting)return Promise.resolve({ok:false,reason:'transport-busy'});
      if(midi.countingIn||midi.recording)return Promise.resolve(api.editorStopTransport?.());
      return Promise.resolve(api.editorStartMidiRecording())
    };

    api.editorHandleShortcut=function(event){
      const intent=transportShortcut(event);
      if(intent==='record'){
        event.preventDefault?.();
        api.editorToggleMidiRecording();
        return true
      }
      if(intent==='playback'){
        event.preventDefault?.();
        api.editorToggleMelodyPlayback?.();
        return true
      }
      if(intent==='go-start'){
        event.preventDefault?.();
        return goToStart(api)
      }
      return originalShortcut.call(this,event)
    };

    const run=()=>enhanceRecordingUi(api,core);run();
    if(typeof root.MutationObserver==='function'&&root.document?.body){const observer=new root.MutationObserver(()=>run());observer.observe(root.document.body,{childList:true,subtree:true});api.__dynamicTrackRecordingObserver=observer}
    return true
  }

  let timer=null;
  function bootWithRetry(){
    if(install())return true;if(root.MusicStudio?.__dynamicTrackRecordingInstalled)return true;if(typeof root.setInterval!=='function')return false;
    if(timer!=null)root.clearInterval(timer);let attempts=0;timer=root.setInterval(()=>{attempts+=1;if(install()||root.MusicStudio?.__dynamicTrackRecordingInstalled||attempts>=200){root.clearInterval(timer);timer=null}},25);return false
  }

  root.MusicStudioDynamicTrackRecording={ASSET_VERSION,resolveRecordingDestination,currentExternalRecording,transportShortcut,goToStart,enhanceRecordingUi,install,bootWithRetry};
  bootWithRetry();if(typeof root.addEventListener==='function')root.addEventListener('hashchange',bootWithRetry);
})(typeof window!=='undefined'?window:globalThis);
