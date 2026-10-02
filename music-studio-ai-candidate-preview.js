/* Music Studio local candidate-to-edit preview bridge. No network/provider path. */
(function(root){
  'use strict';
  const VERSION=1;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const MAJOR=[0,2,4,5,7,9,11],MINOR=[0,2,3,5,7,8,10];
  const NOTE_PCS={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11};
  function requireComposition(){const api=root.MusicStudioAIComposition;if(!api)throw Error('ai-composition-unavailable');return api}
  function safeRange(value,session){
    const start=Number(value?.range?.startMeasure??session?.editRange?.startMeasure??1),end=Number(value?.range?.endMeasure??session?.editRange?.endMeasure??start);
    return{startMeasure:Number.isInteger(start)&&start>0?start:1,endMeasure:Number.isInteger(end)&&end>=start?end:start};
  }
  function targetTrack(session,core,kind,options={}){
    if(kind==='chord'){
      const bass=(session?.midiData?.tracks||[]).find(track=>core.resolveCoreTrackRole?.(track)==='bass');
      if(!bass)throw Error('bass-track-required');
      return bass;
    }
    const id=String(options.trackId||core.currentTrackId?.(session)||'');
    const track=core.getTrackById?.(session?.midiData?.tracks||[],id);
    if(!track)throw Error('target-track-required');
    if(core.resolveCoreTrackRole?.(track)==='drums')throw Error('melodic-track-required');
    return track;
  }
  function keyInfo(label){
    const parsed=requireComposition().parseKey(label||'C'),scale=parsed.mode==='minor'?MINOR:MAJOR;
    return{...parsed,scale};
  }
  function degreePitch(label,degree,register='mid'){
    const key=keyInfo(label),index=Math.max(1,Math.min(7,Number(degree)||1))-1,pc=(key.pc+key.scale[index])%12;
    const octave=register==='low'||register==='low-mid'?3:register==='high'||register==='mid-high'?5:4;
    return clamp((octave+1)*12+pc,0,127);
  }
  function chordRootPitch(name){
    const match=String(name||'C').match(/^([A-G](?:#|b)?)/),pc=NOTE_PCS[match?.[1]||'C']??0;
    return 36+pc;
  }
  function uniqueId(track,prefix,index,tick){
    const ids=new Set((track?.notes||[]).map(note=>String(note.id))),base=`${prefix}-${index+1}-${tick}`;
    if(!ids.has(base))return base;
    let suffix=2;while(ids.has(`${base}-${suffix}`))suffix++;return`${base}-${suffix}`;
  }
  function spreadAdds(track,range,pitches,velocity=90,prefix='ai'){
    const span=Math.max(1,Math.floor(range.endTick-range.startTick)),count=Math.max(1,pitches.length),step=Math.max(1,Math.floor(span/count));
    return pitches.map((pitch,index)=>{
      const startTick=Math.min(range.endTick-1,range.startTick+index*step),durationTicks=Math.max(1,Math.min(step,range.endTick-startTick));
      return{id:uniqueId(track,prefix,index,startTick),pitch:clamp(Math.round(pitch),0,127),startTick,durationTicks,velocity:clamp(Math.round(velocity),1,127)};
    });
  }
  function phraseAdds(track,range,value,velocity,prefix){
    const events=Array.isArray(value.phraseEvents)&&value.phraseEvents.length?value.phraseEvents:null;
    if(!events)return spreadAdds(track,range,(value.scaleDegrees||[1,3,5,3,2,4,5,1]).map(degree=>degreePitch(value.key,degree,value.register)),velocity,prefix);
    const units=events.reduce((sum,event)=>sum+clamp(Math.round(Number(event.durationUnits)||1),1,8),0),span=Math.max(1,range.endTick-range.startTick),unitTicks=Math.max(1,Math.floor(span/Math.max(1,units)));
    let cursor=range.startTick;
    return events.map((event,index)=>{
      const eventUnits=clamp(Math.round(Number(event.durationUnits)||1),1,8),startTick=Math.min(range.endTick-1,cursor),durationTicks=Math.max(1,Math.min(eventUnits*unitTicks,range.endTick-startTick));cursor+=eventUnits*unitTicks;
      return{id:uniqueId(track,prefix,index,startTick),pitch:degreePitch(value.key,event.degree,value.register),startTick,durationTicks,velocity:clamp(Math.round(velocity),1,127)};
    });
  }
  function melodyProposal(request,track,value){
    const ids=new Set(request.targetNoteIds||[]),targets=(request.notes||[]).filter(note=>ids.has(note.id)),degrees=Array.isArray(value.scaleDegrees)&&value.scaleDegrees.length?value.scaleDegrees:[1,3,5,3,2,4,5,1];
    if(targets.length){
      return{updates:targets.map((note,index)=>({...clone(note),pitch:degreePitch(value.key,degrees[index%degrees.length],value.register)})),adds:[],deleteNoteIds:[]};
    }
    return{updates:[],adds:phraseAdds(track,request.range,value,88,`ai-melody-${value.variant||'A'}`),deleteNoteIds:[]};
  }
  function continuationProposal(request,track,value){
    const ids=new Set(request.targetNoteIds||[]),targets=(request.notes||[]).filter(note=>ids.has(note.id)),degrees=Array.isArray(value.phraseEvents)&&value.phraseEvents.length?value.phraseEvents.map(event=>event.degree):value.method==='answer'?[5,4,2,1]:value.method==='sequence'?[2,3,4,3,5,4,3,2]:[1,3,2,1,1,3,2,1];
    if(targets.length){
      return{updates:targets.map((note,index)=>({...clone(note),pitch:degreePitch(value.key,degrees[index%degrees.length],'mid')})),adds:[],deleteNoteIds:[]};
    }
    return{updates:[],adds:phraseAdds(track,request.range,{...value,register:'mid'},84,`ai-cont-${value.variant||'A'}`),deleteNoteIds:[]};
  }
  function chordBassProposal(request,track,value){
    const progression=Array.isArray(value.progression)&&value.progression.length?value.progression:['C','F','G','C'],pitches=progression.map(chordRootPitch),ids=new Set(request.targetNoteIds||[]),targets=(request.notes||[]).filter(note=>ids.has(note.id));
    if(targets.length){
      return{updates:targets.map((note,index)=>({...clone(note),pitch:pitches[index%pitches.length]})),adds:[],deleteNoteIds:[]};
    }
    return{updates:[],adds:spreadAdds(track,request.range,pitches,82,`ai-bass-${value.variant||'A'}`),deleteNoteIds:[]};
  }
  function companionPlan(value,context={}){
    if(value.kind==='chord'){
      const melodyPhrase=context.melodyPhrase||context.sourcePhrase||{},sourceNotes=melodyPhrase.notes||[],slots=(value.progression||[]).map((chord,index)=>{const root=chordRootPitch(chord)%12,minor=/m(?!aj)/.test(chord),dim=/dim/.test(chord),tones=[root,(root+(minor||dim?3:4))%12,(root+(dim?6:7))%12],notes=sourceNotes.filter((_,noteIndex)=>noteIndex%(value.progression.length||1)===index),outside=notes.filter(note=>!tones.includes(((note.pitch%12)+12)%12));return{slot:index+1,chord,compatiblePitchClasses:tones,sourceNoteIds:notes.map(note=>note.id),outsideChordToneNoteIds:outside.map(note=>note.id),suggestion:outside.length?'review-passing-or-neighbor-tone':'compatible'};});
      return{kind:'chord-companion',candidateFamily:clone(value.candidateFamily||null),bass:{candidateId:value.bassCandidate?.candidateId||value.variant,familyId:value.candidateFamily?.id,roots:(value.progression||[]).map(chord=>({chord,rootPitch:chordRootPitch(chord)})),policy:'candidate-only'},arrangement:{candidateId:value.arrangementCandidateRef?.candidateId||value.variant,familyId:value.candidateFamily?.id,roles:['melody','bass','drums'].filter(role=>(context.trackRoles||[]).includes(role)),policy:'candidate-only'},melodyAlignment:{policy:'preview-only',mutates:false,sourcePhraseFingerprint:melodyPhrase.fingerprint||'empty',sourceTrackId:melodyPhrase.trackId||null,slots}};
    }
    if(value.kind==='lyrics-structure'){
      const lines=Array.isArray(value.lines)&&value.lines.length?value.lines:Array.from({length:Math.max(1,Number(value.lineCount)||4)},(_,index)=>({line:index+1,syllableCount:0,stress:[],melodyPhraseSlot:index+1}));
      return{kind:'lyrics-melody-link',candidateFamily:clone(value.candidateFamily||null),linkedMelodyCandidate:value.linkedMelodyCandidate||value.variant||'A',phraseSlots:lines.map(line=>({line:line.line,melodySlot:line.melodyPhraseSlot,measureSlot:line.measureSlot,syllableCount:line.syllableCount,stress:clone(line.stress||[]),stressPolicy:value.stressPolicy||'speech-first'})),policy:'metadata-only'};
    }
    if(value.kind==='arrangement')return{kind:'arrangement-plan',candidateFamily:clone(value.candidateFamily||null),sectionCandidateRef:clone(value.sectionCandidateRef||null),chordCandidateRef:clone(value.chordCandidateRef||null),tracks:clone(value.tracks||[]),register:value.register,density:value.density,dynamics:value.dynamics,entry:value.entry,policy:'metadata-only'};
    if(value.kind==='section')return{kind:'section-plan',candidateFamily:clone(value.candidateFamily||null),arrangementCandidateRef:clone(value.arrangementCandidateRef||null),shape:value.shape,plan:clone(value.plan||[]),policy:'metadata-only'};
    if(value.kind==='melody'||value.kind==='continuation')return{kind:'phrase-plan',candidateFamily:clone(value.candidateFamily||null),phrases:clone(value.phrases||[]),motif:clone(value.motif||null),sourcePhrase:clone(value.sourcePhrase||null),policy:'candidate-only'};
    return null;
  }
  function createPreview(session,core,candidate,options={}){
    if(!candidate||typeof candidate!=='object'||!candidate.value||typeof candidate.value!=='object')throw Error('candidate-required');
    const value=clone(candidate.value),kind=value.kind||candidate.kind;
    if(!kind)throw Error('candidate-kind-required');
    const composition=requireComposition(),context=options.context||composition.createContext(options.project||{},session,core),companion=companionPlan(value,context);
    if(!['melody','continuation','chord'].includes(kind)){
      return{version:VERSION,type:'metadata-preview',candidateId:candidate.candidateId||value.variant||null,kind,value,context:clone(context),companion,mutates:false};
    }
    const track=targetTrack(session,core,kind,options),range=safeRange(value,session),request=core.createPartialEditRequest(session,{trackId:track.id,range});
    const proposals=kind==='melody'?melodyProposal(request,track,value):kind==='continuation'?continuationProposal(request,track,value):chordBassProposal(request,track,value);
    const result=core.createPartialEditResult(request,proposals),preview=core.createPartialEditPreview(request,result);
    return{version:VERSION,type:'midi-preview',candidateId:candidate.candidateId||value.variant||null,kind,targetTrackId:track.id,value,context:clone(context),request,result,preview,companion,mutates:false};
  }
  function selectionForRange(bundle,measureRange){
    if(!bundle||bundle.type!=='midi-preview')throw Error('midi-preview-required');
    if(!measureRange)return null;
    const start=Number(measureRange.startMeasure??measureRange[0]),end=Number(measureRange.endMeasure??measureRange[1]);
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<bundle.request.range.startMeasure||end>bundle.request.range.endMeasure||end<start)throw Error('invalid-preview-selection');
    return{startMeasure:start,endMeasure:end};
  }
  function narrowed(bundle,session,core,measureRange){
    if(!measureRange)return{result:bundle.result,preview:bundle.preview,selection:null};
    const selection=selectionForRange(bundle,measureRange),ticks=core.measureRangeToTicks(selection,session.midiData),inTicks=note=>note.startTick>=ticks.startTick&&note.startTick<ticks.endTick,changes=bundle.result.changes;
    const originals=new Map((bundle.request.notes||[]).map(note=>[note.id,note])),contained=note=>note&&inTicks(note)&&note.startTick+note.durationTicks<=ticks.endTick;
    const updates=changes.updates.filter(inTicks),deleteNoteIds=changes.deleteNoteIds.filter(id=>inTicks(originals.get(id)||{}));
    // Existing notes are indivisible: reject rather than alter their sound outside
    // the adopted interval. New proposals can be shortened at the exact end.
    if(updates.some(note=>!contained(note)||!contained(originals.get(note.id)))||deleteNoteIds.some(id=>!contained(originals.get(id))))throw Error('candidate-selection-boundary');
    const proposals={updates,adds:changes.adds.filter(inTicks).map(note=>({...clone(note),durationTicks:Math.min(note.durationTicks,ticks.endTick-note.startTick)})),deleteNoteIds};
    const result=core.createPartialEditResult(bundle.request,proposals),preview=core.createPartialEditPreview(bundle.request,result);
    return{result,preview,selection};
  }
  function applyPreview(session,core,bundle,measureRange=null){
    if(!bundle||bundle.type!=='midi-preview'||bundle.mutates===true)throw Error('midi-preview-required');
    const subset=narrowed(bundle,session,core,measureRange),applied=core.applyPartialEditPreview(session,bundle.request,subset.result,subset.preview);
    if(applied?.applied!==true)throw Error(`candidate-apply-rejected:${applied?.reason||'protected'}`);
    return{ok:true,applied:clone(applied),candidateId:bundle.candidateId,kind:bundle.kind,targetTrackId:bundle.targetTrackId,selection:clone(subset.selection)};
  }
  root.MusicStudioAICandidatePreview=Object.freeze({VERSION,degreePitch,chordRootPitch,companionPlan,createPreview,selectionForRange,previewSelection:narrowed,applyPreview});
})(typeof window!=='undefined'?window:globalThis);
