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
    if((core.resolveCoreTrackRole?.(track)==='drums'||core.resolveTrackCapabilities?.(track)?.supportsDrumLabels)&&!options.allowDrums)throw Error('melodic-track-required');
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
  function importedMidiProposal(request,track,value,session){
    const data=value.importedMidi;
    if(value.kind!=='melody'||data?.version!==1||data.ppq!==session.midiData.ppq||!Array.isArray(data.notes)||data.notes.length<1||data.notes.length>4096)throw Error('invalid-imported-midi-candidate');
    if(['startTick','endTick','startMeasure','endMeasure'].some(k=>value.range?.[k]!==request.range[k]))throw Error('stale-imported-midi-range');
    const adds=data.notes.map((note,index)=>{
      if(!Number.isSafeInteger(note.pitch)||note.pitch<0||note.pitch>127||!Number.isSafeInteger(note.velocity)||note.velocity<1||note.velocity>127||!Number.isSafeInteger(note.startTick)||note.startTick<0||!Number.isSafeInteger(note.durationTicks)||note.durationTicks<1||!Number.isSafeInteger(note.startTick+note.durationTicks)||note.startTick+note.durationTicks>request.range.endTick-request.range.startTick)throw Error('invalid-imported-midi-note');
      const startTick=request.range.startTick+note.startTick;
      return{...clone(note),startTick,id:uniqueId(track,`midi-candidate-${value.variant}`,index,startTick)};
    });
    return{updates:[],adds,deleteNoteIds:[]};
  }
  function coreTrackForRemake(session,id){const tracks=session.midiData.tracks.filter(t=>t.id===id);if(tracks.length!==1)throw Error('remake-source-track-required');return tracks[0]}
  function remakeProposal(request,track,value,session){
    const source=value.remake;
    if(source?.version!==1||(source.destinationTrackId||source.trackId)!==track.id||source.midiSignature!==JSON.stringify(session.midiData))throw Error('stale-remake-source');
    if(JSON.stringify(source.range)!==JSON.stringify(value.range)||!['revise','layer','delete'].includes(source.mode)||![25,50,100].includes(source.amount))throw Error('invalid-remake-operation');
    const sourceTrack=coreTrackForRemake(session,source.trackId);
    const observed=sourceTrack.notes.filter(n=>n.startTick>=source.range.startTick&&n.startTick<source.range.endTick).sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch);
    if(JSON.stringify(observed)!==JSON.stringify(source.notes))throw Error('stale-remake-notes');
    const editable=new Set(request.targetNoteIds),targets=observed.filter(n=>editable.has(n.id));
    if(source.mode!=='layer'&&!targets.length)throw Error('remake-editable-notes-required');
    if(source.mode==='layer')return importedMidiProposal(request,track,value,session);
    if(source.mode==='delete')return{updates:[],adds:[],deleteNoteIds:targets.map(n=>n.id)};
    const generated=importedMidiProposal(request,track,value,session).adds;
    if(source.mode==='layer')return{updates:[],adds:generated,deleteNoteIds:[]};
    const count=Math.ceil(targets.length*source.amount/100);
    return{updates:targets.filter((_,i)=>Math.floor(i*count/targets.length)!==Math.floor((i-1)*count/targets.length)).map((n,i)=>({...clone(n),pitch:generated[i%generated.length].pitch})),adds:[],deleteNoteIds:[]};
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
      return{updates:targets.map((note,index)=>({...clone(note),pitch:degreePitch(value.key,degrees[index%degrees.length],value.register||'mid')})),adds:[],deleteNoteIds:[]};
    }
    return{updates:[],adds:phraseAdds(track,request.range,{...value,register:value.register||'mid'},84,`ai-cont-${value.variant||'A'}`),deleteNoteIds:[]};
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
  function continuationSource(value,session,core){
    if(value?.kind!=='continuation')throw Error('continuation-required');
    const start=value.range?.startMeasure,end=value.range?.endMeasure,source=value.sourcePhrase;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start)throw Error('invalid-continuation-range');
    if(typeof source?.trackId!=='string'||!source.trackId||!Number.isSafeInteger(source.noteCount)||source.noteCount<0||source.noteCount>64||typeof source.fingerprint!=='string'||!Array.isArray(source.intervals)||source.intervals.length!==Math.max(0,source.noteCount-1)||source.intervals.some(n=>!Number.isSafeInteger(n)||Math.abs(n)>127)||value.derivedFromExisting!==(source.noteCount>0))throw Error('invalid-continuation-source');
    const matches=(session?.midiData?.tracks||[]).filter(track=>track.id===source.trackId);
    if(matches.length!==1||core.resolveCoreTrackRole?.(matches[0])==='drums')throw Error('continuation-source-track-required');
    if(typeof core.measureRangeToTicks!=='function')throw Error('continuation-source-timeline-unavailable');
    const ticks=core.measureRangeToTicks({startMeasure:start,endMeasure:end},session.midiData);
    if(!Number.isSafeInteger(ticks.startTick)||!Number.isSafeInteger(ticks.endTick)||ticks.startTick<0||ticks.endTick<=ticks.startTick)throw Error('invalid-continuation-source-ticks');
    if(value.range.startTick!==ticks.startTick||value.range.endTick!==ticks.endTick)throw Error('stale-continuation-source-range');
    const notes=matches[0].notes;
    if(!Array.isArray(notes))throw Error('invalid-continuation-source-notes');
    // Reuse the existing generator's observed window and 64-note limit. Do not
    // infer a new phrase boundary, destination or continuation composition rule.
    const observed=notes.filter(note=>note?.startTick>=ticks.startTick&&note.startTick<ticks.endTick).sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch).slice(0,64);
    if(observed.some(note=>typeof note.id!=='string'||!note.id||!Number.isSafeInteger(note.pitch)||note.pitch<0||note.pitch>127||!Number.isSafeInteger(note.startTick)||!Number.isSafeInteger(note.durationTicks)||note.durationTicks<1||!Number.isSafeInteger(note.startTick+note.durationTicks)||!Number.isSafeInteger(note.velocity)||note.velocity<1||note.velocity>127)||new Set(observed.map(note=>note.id)).size!==observed.length)throw Error('invalid-continuation-source-notes');
    const view={...session,selectedTrackId:source.trackId,editRange:{startMeasure:start,endMeasure:end}};
    const context=requireComposition().createContext({musicalSettings:{key:value.key}},view,core),current=context.sourcePhrase;
    if(context.key!==value.key||current.trackId!==source.trackId||current.noteCount!==source.noteCount||current.fingerprint!==source.fingerprint||JSON.stringify(current.intervals)!==JSON.stringify(source.intervals))throw Error('stale-continuation-source');
    return{kind:'continuation-source-preview',trackId:source.trackId,range:{startMeasure:start,endMeasure:end,startTick:ticks.startTick,endTick:ticks.endTick},noteCount:source.noteCount,fingerprint:source.fingerprint,intervals:clone(source.intervals),observedNoteLimit:64,notes:clone(observed),mutates:false};
  }
  function continuationSourceRows(source){
    if(source?.kind!=='continuation-source-preview')return[];
    return[`Continuation source: ${source.trackId} / M${source.range.startMeasure}-${source.range.endMeasure} / tick ${source.range.startTick}-${source.range.endTick} / ${source.noteCount} observed notes (limit ${source.observedNoteLimit}) / recorded fingerprint and intervals verified; generation rules unchanged`];
  }
  function previewEdits(value){
    if(value==null)return{transpose:0,velocity:0,lengthPercent:100};
    if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['transpose','velocity','lengthPercent'].includes(k)))throw Error('invalid-candidate-edits');
    const result={transpose:value.transpose??0,velocity:value.velocity??0,lengthPercent:value.lengthPercent??100};
    for(const [key,min,max] of [['transpose',-24,24],['velocity',-64,64],['lengthPercent',25,200]])if(!Number.isSafeInteger(result[key])||result[key]<min||result[key]>max)throw Error('invalid-candidate-edit:'+key);
    return result;
  }
  function editProposals(proposals,range,settings,instrument){
    const edits=previewEdits(settings),map=note=>{
      const pitch=note.pitch+edits.transpose,velocity=note.velocity+edits.velocity;
      if(pitch<0||pitch>127||velocity<1||velocity>127)throw Error('candidate-edit-midi-boundary');
      const durationTicks=Math.max(1,Math.round(note.durationTicks*edits.lengthPercent/100));
      if(note.startTick+durationTicks>range.endTick)throw Error('candidate-edit-range-boundary');
      const next={...note,pitch,velocity,durationTicks};
      // Explicit edits must sound as entered, rather than silently fitting an octave.
      if(instrument){const fitted=root.MusicStudioInstruments.fitNotes(instrument,[next])[0];if(fitted.pitch!==pitch||fitted.velocity!==velocity)throw Error('candidate-edit-instrument-boundary')}
      return next;
    };
    return{updates:proposals.updates.map(map),adds:proposals.adds.map(map),deleteNoteIds:[...proposals.deleteNoteIds]};
  }
  function newTrackSession(session,core,value){
    const source=value.remake,track=source?.newTrack;
    if(!track||source.mode!=='layer'||source.midiSignature!==JSON.stringify(session.midiData))throw Error('stale-remake-source');
    const expected=requireComposition().remakeNewTrack(session,track.roleAssignment);
    if(JSON.stringify(track)!==JSON.stringify(expected)||source.destinationTrackId!==track.id)throw Error('invalid-remake-new-track');
    const copy=clone(session);copy.midiData.tracks.push(clone(track));
    if(copy.midiData.editor?.measureLocks)copy.midiData.editor.measureLocks.tracks.push({trackId:track.id,legacyMeasures:[],legacyRanges:[],rangeLocks:[]});
    // Select only the disposable session; preserve the original editor state.
    copy.selectedTrackId=track.id;copy.selectionTrackId=null;copy.selectedNoteId=null;copy.selectedNoteIds=[];
    return copy;
  }
  function ensembleSnapshot(session,core,value,measureRange=null){
    const ensemble=value.ensemble,source=ensemble?.source;
    if(ensemble?.version!==1||ensemble.method!=='model-phrase-plus-rule-orchestration-v1'||source?.midiSignature!==JSON.stringify(session.midiData))throw Error('stale-ensemble-source');
    if(JSON.stringify(source.range)!==JSON.stringify(value.range)||JSON.stringify(ensemble.roles)!==JSON.stringify(['piano','bass','strings','drums']))throw Error('invalid-ensemble');
    const roles=measureRange?.roles||ensemble.roles;
    if(!Array.isArray(roles)||!roles.length||new Set(roles).size!==roles.length||roles.some(r=>!ensemble.roles.includes(r)))throw Error('invalid-ensemble-instruments');
    const from=measureRange?.startMeasure??value.range.startMeasure,to=measureRange?.endMeasure??value.range.endMeasure;
    if(!Number.isInteger(from)||!Number.isInteger(to)||from<value.range.startMeasure||to>value.range.endMeasure||to<from||to-from>255)throw Error('invalid-ensemble-range');
    const selection={startMeasure:from,endMeasure:to},range=core.measureRangeToTicks(selection,session.midiData),copy=clone(session),diff=[];
    for(const role of roles){
      if(role==='drums'){
        if(copy.midiData.tracks.length>=64)throw Error('arrangement-track-limit');
        if(copy.midiData.tracks.some(t=>t.channel===10&&!core.isDrumTrack(t)))throw Error('drum-channel-conflict');
        let id='arrange-drums',suffix=2;while(copy.midiData.tracks.some(t=>t.id===id))id=`arrange-drums-${suffix++}`;
        const notes=[];for(let bar=from;bar<=to;bar++){
          const span=core.measureRangeToTicks({startMeasure:bar,endMeasure:bar},copy.midiData),ppq=copy.midiData.ppq||480;
          // Quarter-note kick/snare with eighth hats, clipped at actual meter boundaries.
          for(let tick=span.startTick,step=0;tick<span.endTick;tick+=Math.max(1,Math.round(ppq/2)),step++){
            const add=(pitch,velocity)=>notes.push({id:`${id}-${bar}-${step}-${pitch}`,pitch,startTick:tick,durationTicks:Math.min(Math.max(1,Math.round(ppq/8)),span.endTick-tick),velocity});
            add(42,step%2?54:66);if(step%2===0)add(step%4===0?36:38,step%4===0?90:80);
          }
        }
        const track={id,name:'Rule drums（規則ドラム）',trackType:'midi-drums',roleAssignment:'drums',role:'drums',channel:10,program:null,muted:false,notes,generationProvenance:{method:'meter-grid-rule',model:null,variant:value.variant}};
        copy.midiData.tracks.push(track);if(copy.midiData.editor?.measureLocks)copy.midiData.editor.measureLocks.tracks.push({trackId:id,legacyMeasures:[],legacyRanges:[],rangeLocks:[]});
        diff.push({role,trackId:id,notes:notes.length,method:'meter-grid-rule'});continue;
      }
      const instrument=requireComposition().remakeNewTrack(copy,role),part=clone(value);delete part.ensemble;part.variant=`${value.variant}-${role}`;
      const limits=role==='bass'?[28,55]:role==='strings'?[48,84]:[48,84];
      part.importedMidi.notes=part.importedMidi.notes.filter((n,i)=>role==='piano'||role==='strings'?true:i%2===0).map(n=>{
        let pitch=n.pitch;while(pitch<limits[0])pitch+=12;while(pitch>limits[1])pitch-=12;
        return{...n,pitch,velocity:Math.min(n.velocity||80,role==='strings'?64:role==='bass'?90:100)};
      });
      const binding={...clone(source),midiSignature:JSON.stringify(copy.midiData)};
      const candidate={candidateId:value.variant,value:requireComposition().bindRemake(part,binding,'layer',100,instrument.id,instrument)};
      const bundle=createPreview(copy,core,candidate);applyPreview(copy,core,bundle,selection);
      const added=core.getTrackById(copy.midiData.tracks,instrument.id);added.generationProvenance={method:role==='piano'?'model-output-octave-fit':'model-pitches-rule-orchestration',variant:value.variant,model:clone(value.modelGeneration||null),sourceTrackId:source.trackId};diff.push({role,trackId:instrument.id,notes:added.notes.length,method:role==='piano'?'model-output-octave-fit':'model-pitches-rule-orchestration'});
    }
    if(!core.validateTrackRegistry(copy.midiData.tracks).ok)throw Error('invalid-ensemble-track-registry');
    return{midiData:copy.midiData,range,diff};
  }
  function createPreview(session,core,candidate,options={}){
    if(!candidate||typeof candidate!=='object'||!candidate.value||typeof candidate.value!=='object')throw Error('candidate-required');
    const value=clone(candidate.value),kind=value.kind||candidate.kind;
    if(value.ensemble){const plan=ensembleSnapshot(session,core,value);return{version:VERSION,type:'midi-preview',kind,candidateId:candidate.candidateId||value.variant,targetTrackId:value.ensemble.source.trackId,value,request:{range:clone(value.range)},result:{changes:{updates:[],adds:plan.midiData.tracks.slice(session.midiData.tracks.length).flatMap(t=>t.notes),deleteNoteIds:[]}},companion:{ensembleDiff:plan.diff},mutates:false};}
    if(!kind)throw Error('candidate-kind-required');
    const composition=requireComposition(),context=options.context||composition.createContext(options.project||{},session,core),companion=companionPlan(value,context);
    if(kind==='continuation')companion.sourcePreview=continuationSource(value,session,core);
    if(kind==='arrangement')companion.timeline=composition.arrangementTimeline(value,session,core,options.measureRange??null);
    if(kind==='section')companion.timeline=composition.sectionTimeline(value,session,core,options.measureRange??null);
    if(kind==='lyrics-structure'){companion.timeline=composition.lyricsTimeline(value,session,core,options.measureRange??null);companion.phraseSlots=clone(companion.timeline.slots)}
    if(!['melody','continuation','chord'].includes(kind)){
      return{version:VERSION,type:'metadata-preview',candidateId:candidate.candidateId||value.variant||null,kind,value,context:clone(context),companion,mutates:false};
    }
    if(value.remake?.newTrack&&!options.newTrackWorking){
      const working=newTrackSession(session,core,value),inner=clone(candidate);
      inner.value.remake.midiSignature=JSON.stringify(working.midiData);
      const bundle=createPreview(working,core,inner,{...options,newTrackWorking:true});
      bundle.value=value;bundle.newTrackBaseline=clone(session.midiData);return bundle;
    }
    const track=targetTrack(session,core,kind,value.remake?{...options,trackId:value.remake.destinationTrackId||value.remake.trackId,allowDrums:value.remake.mode==='delete'}:options),range=safeRange(value,session),request=core.createPartialEditRequest(session,{trackId:track.id,range});
    let proposals=value.remake?remakeProposal(request,track,value,session):value.source==='imported-midi-output'?importedMidiProposal(request,track,value,session):kind==='melody'?melodyProposal(request,track,value):kind==='continuation'?continuationProposal(request,track,value):chordBassProposal(request,track,value);
    let instrumentSnapshot;if(track.sampleInstrument?.version===2){if(!root.MusicStudioInstruments)throw Error('instrument-module-unavailable');instrumentSnapshot=clone(track.sampleInstrument);const before=JSON.stringify(proposals);proposals.updates=root.MusicStudioInstruments.fitNotes(instrumentSnapshot,proposals.updates);proposals.adds=root.MusicStudioInstruments.fitNotes(instrumentSnapshot,proposals.adds);companion.instrumentFit={method:'octave-and-velocity',changed:before!==JSON.stringify(proposals),instrument:instrumentSnapshot.name};}
    if(value.previewEdits!=null)proposals=editProposals(proposals,request.range,value.previewEdits,instrumentSnapshot);
    const result=core.createPartialEditResult(request,proposals),preview=core.createPartialEditPreview(request,result);
    return{version:VERSION,type:'midi-preview',candidateId:candidate.candidateId||value.variant||null,kind,targetTrackId:track.id,value,context:clone(context),request,result,preview,companion,...(instrumentSnapshot?{instrumentSnapshot}:{}),mutates:false};
  }
  function selectionForRange(bundle,measureRange){
    if(!bundle||bundle.type!=='midi-preview')throw Error('midi-preview-required');
    if(!measureRange)return null;
    const start=Number(measureRange.startMeasure??measureRange[0]),end=Number(measureRange.endMeasure??measureRange[1]);
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<bundle.request.range.startMeasure||end>bundle.request.range.endMeasure||end<start)throw Error('invalid-preview-selection');
    return{startMeasure:start,endMeasure:end};
  }
  function narrowed(bundle,session,core,measureRange){
    if(bundle?.instrumentSnapshot&&JSON.stringify(core.getTrackById(session.midiData.tracks,bundle.targetTrackId)?.sampleInstrument)!==JSON.stringify(bundle.instrumentSnapshot))throw Error('stale-candidate-instrument');
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
    if(bundle.value?.ensemble){const plan=ensembleSnapshot(session,core,bundle.value,measureRange),applied=core.applyAtomicMidiSnapshot(session,session.midiData,plan.midiData);if(!applied.applied)throw Error(`ensemble-apply-rejected:${applied.reason}`);return{ok:true,applied,targetTrackId:bundle.targetTrackId,diff:plan.diff};}
    if(bundle.value?.remake?.newTrack){
      if(JSON.stringify(bundle.newTrackBaseline)!==JSON.stringify(session.midiData))throw Error('stale-remake-source');
      const working=newTrackSession(session,core,bundle.value),inner=clone(bundle);
      delete inner.value.remake.newTrack;delete inner.newTrackBaseline;
      inner.value.remake.midiSignature=JSON.stringify(working.midiData);
      applyPreview(working,core,inner,measureRange);
      if(!core.getTrackById(working.midiData.tracks,bundle.targetTrackId)?.notes.length)throw Error('candidate-selection-has-no-new-notes');
      const applied=core.applyAtomicMidiSnapshot(session,bundle.newTrackBaseline,working.midiData);
      if(!applied?.applied)throw Error(`candidate-apply-rejected:${applied?.reason}`);
      return{ok:true,applied:clone(applied),candidateId:bundle.candidateId,kind:bundle.kind,targetTrackId:bundle.targetTrackId,selection:measureRange?clone(measureRange):null};
    }
    if(bundle.value?.remake&&bundle.value.remake.midiSignature!==JSON.stringify(session.midiData))throw Error('stale-remake-source');
    if(bundle.kind==='continuation'){const source=continuationSource(bundle.value,session,core);if(JSON.stringify(source)!==JSON.stringify(bundle.companion?.sourcePreview))throw Error('stale-continuation-source-preview')}
    const subset=narrowed(bundle,session,core,measureRange),applied=core.applyPartialEditPreview(session,bundle.request,subset.result,subset.preview);
    if(applied?.applied!==true)throw Error(`candidate-apply-rejected:${applied?.reason||'protected'}`);
    return{ok:true,applied:clone(applied),candidateId:bundle.candidateId,kind:bundle.kind,targetTrackId:bundle.targetTrackId,selection:clone(subset.selection)};
  }
  // Apply to a disposable session so audition uses the same stale/lock/range
  // checks and exact notes as adoption, without touching the editor or Undo.
  function auditionPlan(session,core,bundle,measureRange=null){
    if(bundle?.type!=='midi-preview')throw Error('midi-preview-required');
    const copy=clone(session);
    core.selectTrackById(copy,bundle.targetTrackId);
    applyPreview(copy,core,bundle,measureRange);
    const range=measureRange?core.measureRangeToTicks(measureRange,copy.midiData):bundle.request.range;
    const selected=core.getTrackById(copy.midiData.tracks,bundle.targetTrackId);
    const tracks=(bundle.value.remake||bundle.value.ensemble?copy.midiData.tracks:[selected]).map(track=>{
      const notes=track.notes.filter(n=>n.startTick<range.endTick&&n.startTick+n.durationTicks>range.startTick).map(n=>{
        const startTick=Math.max(n.startTick,range.startTick);
        return{...clone(n),startTick,durationTicks:Math.min(n.startTick+n.durationTicks,range.endTick)-startTick};
      });
      return{...clone(track),...(track.id===selected.id?{muted:false,solo:false}:{}),notes};
    });
    const count=tracks.reduce((n,t)=>n+t.notes.length,0);
    if(!count&&!bundle.value.remake)throw Error('audition-no-notes');
    if(count>4096)throw Error('audition-note-limit-select-shorter-range');
    return{tracks,transport:{ppq:copy.midiData.ppq,bpm:copy.midiData.tempo,tempoMap:clone(copy.midiData.tempoMap||[]),startTick:range.startTick,endTick:range.endTick},silent:!count,mutates:false};
  }
  root.MusicStudioAICandidatePreview=Object.freeze({VERSION,previewEdits,auditionPlan,continuationSource,continuationSourceRows,degreePitch,chordRootPitch,companionPlan,createPreview,selectionForRange,previewSelection:narrowed,applyPreview});
})(typeof window!=='undefined'?window:globalThis);
