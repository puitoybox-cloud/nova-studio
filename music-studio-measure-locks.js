/* Explicit tick protection for legacy and new measure locks. Opt-in; no automatic migration. */
(function(root){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function range(value){
    if(!Number.isFinite(value?.startTick)||!Number.isFinite(value?.endTick)||value.startTick<0||value.endTick<=value.startTick||value.endTick>Number.MAX_SAFE_INTEGER)throw Error('invalid-lock-range');
    return{startTick:value.startTick,endTick:value.endTick};
  }
  function measures(value){
    if(value==null)return[];
    if(!Array.isArray(value)||value.some(n=>!Number.isSafeInteger(n)||n<1))throw Error('unrecoverable-legacy-locks');
    return[...new Set(value)].sort((a,b)=>a-b);
  }
  function tracks(data){
    if(!Array.isArray(data?.tracks))throw Error('missing-tracks');
    const ids=new Set();
    for(const track of data.tracks){if(typeof track.id!=='string'||!track.id||ids.has(track.id))throw Error('ambiguous-track-id');ids.add(track.id)}
    return data.tracks;
  }
  function legacyMeasures(data,core,track){
    const editor=data.editor||{},role=core.resolveCoreTrackRole(track),part=role?editor.parts?.[role]:null;
    return measures(editor.trackStates?.[track.id]?.lockedMeasures??part?.lockedMeasures??(role==='melody'?editor.lockedMeasures:null));
  }
  function legacyMeter(data){
    const ppq=data.ppq,numerator=data.timeSignature?.numerator,denominator=data.timeSignature?.denominator;
    // Caller must supply the existing Editor's normalized working copy. Never guess a migration.
    if(!Number.isInteger(ppq)||ppq<24||ppq>9600||!Number.isInteger(numerator)||numerator<1||numerator>16||![1,2,4,8,16,32].includes(denominator))throw Error('unrecoverable-legacy-meter');
    return{ppq,numerator,denominator};
  }
  function legacyRanges(locked,bar){return locked.map(n=>range({startTick:(n-1)*bar,endTick:n*bar}))}
  function readState(data,core){
    if(typeof core?.measureRangeToTicks!=='function'||typeof core?.resolveCoreTrackRole!=='function')throw Error('missing-editor-dependency');
    const list=tracks(data),meter=legacyMeter(data),bar=meter.ppq*4*meter.numerator/meter.denominator;
    const saved=data.editor?.measureLocks;
    if(saved==null)return{version:1,legacyMeter:meter,tracks:list.map(track=>{const locked=legacyMeasures(data,core,track);return{trackId:track.id,legacyMeasures:locked,legacyRanges:legacyRanges(locked,bar),rangeLocks:[]}})};
    if(saved.version!==1||!Array.isArray(saved.tracks)||!equal(saved.legacyMeter,meter))throw Error('unsupported-or-changed-lock-context');
    if(saved.tracks.length!==list.length)throw Error('stale-lock-tracks');
    const seen=new Set();
    for(const item of saved.tracks){
      const track=list.find(t=>t.id===item.trackId);
      if(!track||seen.has(item.trackId))throw Error('stale-lock-track-id');seen.add(item.trackId);
      const locked=legacyMeasures(data,core,track),expected=legacyRanges(locked,bar);
      if(!equal(item.legacyMeasures,locked)||!equal(item.legacyRanges,expected)||!Array.isArray(item.rangeLocks))throw Error('stale-or-corrupt-legacy-protection');
      item.rangeLocks.forEach(range);
      if(Object.prototype.hasOwnProperty.call(item,'releaseRanges')){if(!Array.isArray(item.releaseRanges))throw Error('invalid-release-ranges');item.releaseRanges.forEach(range)}
    }
    return clone(saved);
  }
  function noteRange(note){
    if(!Number.isFinite(note?.durationTicks)||note.durationTicks<=0)throw Error('invalid-note-duration');
    return range({startTick:note.startTick,endTick:note.startTick+note.durationTicks});
  }
  function createSession(project,core){
    // Inspect raw locks before the legacy normalizer can filter malformed numbers away.
    const editor=project?.midiData?.editor||{};
    for(const scope of [editor,...Object.values(editor.parts||{}),...Object.values(editor.trackStates||{})])measures(scope?.lockedMeasures);
    const raw=project?.midiData?.tracks||[],ids=raw.map(t=>t.id).filter(id=>id!=null);
    if(new Set(ids).size!==ids.length)throw Error('ambiguous-track-id');
    const session=core.createSession(project);readState(session.midiData,core);return session;
  }
  function overlaps(a,b){return a.startTick<b.endTick&&a.endTick>b.startTick}
  function union(values){
    const result=[];
    for(const span of values.map(range).sort((a,b)=>a.startTick-b.startTick||a.endTick-b.endTick)){
      const last=result[result.length-1];if(last&&span.startTick<=last.endTick)last.endTick=Math.max(last.endTick,span.endTick);else result.push(span);
    }
    return result;
  }
  function subtract(values,releases){
    let result=union(values);
    for(const cut of union(releases))result=result.flatMap(span=>!overlaps(span,cut)?[span]:[
      ...(span.startTick<cut.startTick?[{startTick:span.startTick,endTick:cut.startTick}]:[]),
      ...(cut.endTick<span.endTick?[{startTick:cut.endTick,endTick:span.endTick}]:[])
    ]);
    return result;
  }
  function rangesFor(state,trackId){const value=state.tracks.find(t=>t.trackId===trackId);if(!value)throw Error('missing-lock-track');return subtract([...value.legacyRanges,...value.rangeLocks],value.releaseRanges||[])}
  function protectedRanges(data,core,trackId){return rangesFor(readState(data,core),trackId)}
  function isProtected(data,core,trackId,note){const span=noteRange(note);return note.locked===true||protectedRanges(data,core,trackId).some(r=>overlaps(span,r))}
  function mutateRange(session,core,input,release){
    const state=readState(session?.midiData,core),span=range(input),target=state.tracks.find(t=>t.trackId===input.trackId);
    if(!target)throw Error('missing-lock-track');
    const active=core.currentTrack(session),activeState=state.tracks.find(t=>t.trackId===active?.id);
    if(!activeState||!equal(measures(session.lockedMeasures),activeState.legacyMeasures))throw Error('stale-session-locks');
    const original=clone(target);
    if(release){
      const cuts=rangesFor(state,input.trackId).filter(r=>overlaps(r,span)).map(r=>({startTick:Math.max(r.startTick,span.startTick),endTick:Math.min(r.endTick,span.endTick)}));
      if(!cuts.length)return{ok:true,changed:false};
      target.releaseRanges=union([...(target.releaseRanges||[]),...cuts]);
    }else{
      if(!target.rangeLocks.some(item=>equal(item,span))){target.rangeLocks.push(span);target.rangeLocks.sort((a,b)=>a.startTick-b.startTick||a.endTick-b.endTick)}
      if(target.releaseRanges)target.releaseRanges=subtract(target.releaseRanges,[span]);
    }
    if(equal(original,target))return{ok:true,changed:false};
    const originalEditor=clone(session.midiData.editor);
    core.setSelectedMeasures(session,session.selectedMeasures);
    session.midiData.editor=originalEditor;
    session.midiData.editor.measureLocks=state;core.updateDirty(session);
    return{ok:true,changed:true,range:clone(span)};
  }
  function addRangeLock(session,core,input){return mutateRange(session,core,input,false)}
  function unlockRange(session,core,input){return mutateRange(session,core,input,true)}
  function unlockMeasures(session,core,meter,input){
    if(typeof meter?.rangeToTicks!=='function')throw Error('missing-meter-dependency');
    const span=meter.rangeToTicks(session.midiData,input.startMeasure,input.endMeasure??input.startMeasure);
    return unlockRange(session,core,{trackId:input.trackId,startTick:span.startTick,endTick:span.endTick});
  }
  function addMeasureLock(session,core,meter,input){
    if(typeof meter?.rangeToTicks!=='function')throw Error('missing-meter-dependency');
    const span=meter.rangeToTicks(session.midiData,input.startMeasure,input.endMeasure??input.startMeasure);
    return addRangeLock(session,core,{trackId:input.trackId,startTick:span.startTick,endTick:span.endTick});
  }
  function noteMap(track){
    if(!Array.isArray(track.notes))throw Error('invalid-track-notes');
    const map=new Map();
    for(const note of track.notes){if(typeof note.id!=='string'||!note.id||map.has(note.id))throw Error('ambiguous-note-id');noteRange(note);map.set(note.id,note)}
    return map;
  }
  function validateEdit(before,after,core){
    const state=readState(before,core);
    if(!equal(state,readState(after,core)))throw Error('edit-changed-lock-protection');
    // Normal note edits never move musical metadata as a side effect.
    for(const field of ['ppq','timeSignature','timeSignatureMap','tempoMap','keySignatureMap','markers'])if(!equal(before[field],after[field]))throw Error('edit-moved-musical-metadata');
    for(const track of tracks(before)){
      const next=tracks(after).find(t=>t.id===track.id);if(!next)throw Error('edit-removed-lock-track');
      const original=noteMap(track),updated=noteMap(next),protectedRanges=rangesFor(state,track.id);
      for(const [id,note] of original){const replacement=updated.get(id),locked=note.locked===true||protectedRanges.some(r=>overlaps(noteRange(note),r));if(locked&&(!replacement||!equal(note,replacement)))throw Error('edit-changed-protected-note')}
      for(const [id,note] of updated){if(protectedRanges.some(r=>overlaps(noteRange(note),r))&&!equal(original.get(id),note))throw Error('edit-entered-protected-range')}
    }
    // Even empty locked space must survive a timeline shrink.
    if(after.totalTick!==before.totalTick&&Number.isFinite(after.totalTick)&&state.tracks.some(t=>rangesFor(state,t.trackId).some(r=>r.endTick>after.totalTick)))throw Error('edit-truncated-protected-range');
    return true;
  }
  function edit(session,core,operation){
    try{
      if(typeof operation!=='function'||operation.constructor?.name==='AsyncFunction')throw Error('async-or-invalid-edit-not-supported');
      readState(session?.midiData,core);
      const working=clone(session),result=operation(working);
      if(result&&typeof result.then==='function')throw Error('async-edit-not-supported');
      if(result?.ok===false)throw Error(result.reason||'editor-rejected-edit');
      validateEdit(session.midiData,working.midiData,core);
      Object.assign(session,working);return{ok:true,result};
    }catch(error){return{ok:false,reason:error.message}}
  }
  root.MusicStudioMeasureLocks=Object.freeze({createSession,readState,protectedRanges,isProtected,addRangeLock,addMeasureLock,unlockRange,unlockMeasures,validateEdit,edit});
})(typeof window!=='undefined'?window:globalThis);
