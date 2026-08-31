/* Music Studio 0.5: shared track playback contract and scheduler boundary. */
(function(root){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const TRACK_ROLES=new Set(['melody','drums','bass']);
  const hasOwn=(value,key)=>Boolean(value)&&Object.prototype.hasOwnProperty.call(value,key);
  const runtimeValue=(state,key,id,fallback)=>{
    const source=state?.[key];
    if(source instanceof Set)return source.has(id);
    if(source instanceof Map)return source.has(id)?source.get(id):fallback;
    if(source&&typeof source==='object'&&hasOwn(source,id))return source[id];
    return fallback
  };
  function playbackRole(track={}){
    const part=String(track.part||'').toLowerCase();
    if(TRACK_ROLES.has(part))return part;
    const id=String(track.id||'').toLowerCase();
    return TRACK_ROLES.has(id)?id:null
  }
  function createPlaybackDescriptor(track={},playbackState={}){
    const id=String(track.id||''),part=String(track.part||playbackRole(track)||''),role=playbackRole({...track,part}),storedMuted=track.muted===true;
    return{id,part,role,channel:Number(track.channel),program:track.program==null?null:Number(track.program),notes:Array.isArray(track.notes)?track.notes.map(clone):[],muted:runtimeValue(playbackState,'mutedByTrackId',id,storedMuted)===true,solo:runtimeValue(playbackState,'soloByTrackId',id,false)===true,soloEligible:role!==null}
  }
  function createPlaybackDescriptors(tracks=[],playbackState={}){return(Array.isArray(tracks)?tracks:[]).map(track=>createPlaybackDescriptor(track,playbackState))}
  function activePlaybackTracks(tracks=[],playbackState={}){const descriptors=createPlaybackDescriptors(tracks,playbackState),hasSolo=descriptors.some(track=>track.solo&&track.soloEligible);return(hasSolo?descriptors.filter(track=>track.solo&&track.soloEligible&&!track.muted):descriptors.filter(track=>!track.muted)).map(clone)}
  function createTransportState(midiData={},runtime={}){
    const editor=midiData.editor||{},loopStart=Number(editor.loopStart),loopEnd=Number(editor.loopEnd),hasLoop=editor.loopEnabled===true&&Number.isFinite(loopStart)&&Number.isFinite(loopEnd)&&loopStart>=0&&loopEnd>loopStart;
    return{playing:runtime.playing===true,currentTick:Math.max(0,Number(runtime.currentTick)||0),ppq:Number(midiData.ppq)||480,bpm:Number(midiData.tempo)||120,loopEnabled:hasLoop,loopStart:hasLoop?loopStart:null,loopEnd:hasLoop?loopEnd:null,playbackStartOrigin:Number.isFinite(Number(runtime.playbackStartOrigin))?Number(runtime.playbackStartOrigin):null,activePlaybackTrackIds:activePlaybackTracks(midiData.tracks||[],runtime.playbackState||runtime).map(track=>track.id)}
  }
  function schedulePlaybackTracks(synth,tracks=[],transportState={}){
    const active=activePlaybackTracks(tracks,transportState.playbackState||{}),timing={ppq:transportState.ppq,tempo:transportState.bpm??transportState.tempo,startTick:transportState.startTick??transportState.currentTick,endTick:transportState.endTick,startTime:transportState.startTime,leadSeconds:transportState.leadSeconds};
    if(synth?.playTracks)return synth.playTracks(active,timing);
    const playable=active.filter(track=>track.notes.length);
    if(playable.length===1&&synth?.playNotes)return synth.playNotes(playable[0].notes,timing);
    return{ok:false,trackCount:active.length,noteCount:0,durationMs:0,reason:'track-playback-unavailable'}
  }
  root.MusicStudioPlayback={playbackRole,createPlaybackDescriptor,createPlaybackDescriptors,activePlaybackTracks,createTransportState,schedulePlaybackTracks};
})(typeof window!=='undefined'?window:globalThis);
