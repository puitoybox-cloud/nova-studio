/* Music Studio deterministic composition candidate service. Local-only; no network/provider path. */
(function(root){
  'use strict';
  const VERSION=1;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const integer=(value,min,max,fallback)=>Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):fallback;
  const text=(value,max=200)=>String(value??'').trim().slice(0,max);
  const MAJOR_KEYS=['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#'];
  const MINOR_KEYS=['Abm','Ebm','Bbm','Fm','Cm','Gm','Dm','Am','Em','Bm','F#m','C#m','G#m','D#m','A#m'];
  const NOTE_PCS={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11};
  const SHARP_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const FLAT_NAMES=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  const MODES={major:{intervals:[0,2,4,5,7,9,11],qualities:['','m','m','','','m','dim']},minor:{intervals:[0,2,3,5,7,8,10],qualities:['m','dim','','m','m','','']}};
  const KINDS=new Set(['melody','chord','section','arrangement','continuation','lyrics-structure']);
  function defaultContext(){return{version:VERSION,key:'C',mode:'major',range:{startMeasure:1,endMeasure:4,startTick:0,endTick:7680},trackRoles:['melody','drums','bass'],source:'default-local'};}
  function keyFromEvent(event){
    if(!event||!Number.isInteger(event.sharps)||event.sharps<-7||event.sharps>7)return null;
    return(event.minor?MINOR_KEYS:MAJOR_KEYS)[event.sharps+7]||null;
  }
  function parseKey(value){
    const raw=text(value,20);
    if(!raw)return{label:'C',tonic:'C',mode:'major',pc:0,preferFlats:false};
    const minor=/m$/i.test(raw),tonic=raw.replace(/m$/i,''),pc=NOTE_PCS[tonic];
    if(pc==null)return{label:raw,tonic:'C',mode:minor?'minor':'major',pc:0,preferFlats:/b/.test(raw)};
    return{label:raw,tonic,mode:minor?'minor':'major',pc,preferFlats:/b/.test(tonic)};
  }
  function selectedRange(session,core){
    const range=session?.editRange||session?.midiData?.editor?.editRange||{startMeasure:1,endMeasure:4};
    if(typeof core?.measureRangeToTicks==='function'){
      try{
        const ticks=core.measureRangeToTicks(range,session.midiData);
        return{startMeasure:ticks.startMeasure,endMeasure:ticks.endMeasure,startTick:ticks.startTick,endTick:ticks.endTick};
      }catch(_){}
    }
    return{startMeasure:integer(range.startMeasure,1,10000,1),endMeasure:integer(range.endMeasure,1,10000,4),startTick:0,endTick:0};
  }
  function createContext(project,session,core){
    const range=selectedRange(session,core),events=Array.isArray(session?.midiData?.keySignatureMap)?session.midiData.keySignatureMap:[];
    const active=[...events].filter(item=>Number.isFinite(item?.tick)&&item.tick<=range.startTick).sort((a,b)=>a.tick-b.tick).at(-1);
    const fromEvent=keyFromEvent(active),projectKey=project?.musicalSettings?.key||project?.key||project?.songKey||null,parsed=parseKey(fromEvent||projectKey||'C');
    const tracks=session?.midiData?.tracks||[],roles=[...new Set(tracks.map(track=>core?.resolveCoreTrackRole?.(track)||track.roleAssignment||track.part||null).filter(Boolean))];
    const currentId=core?.currentTrackId?.(session),current=core?.getTrackById?.(tracks,currentId),canonicalMelody=tracks.find(track=>core?.resolveCoreTrackRole?.(track)==='melody'),sourceTrack=current&&core?.resolveCoreTrackRole?.(current)!=='drums'?current:canonicalMelody;
    const scale=(MODES[parsed.mode]||MODES.major).intervals,degreeForPitch=pitch=>{const pc=((Number(pitch)-parsed.pc)%12+12)%12;let best=0,distance=13;scale.forEach((value,index)=>{const next=Math.min((pc-value+12)%12,(value-pc+12)%12);if(next<distance){best=index;distance=next}});return best+1};
    const phraseForTrack=track=>{const notes=(track?.notes||[]).filter(note=>Number.isFinite(note?.startTick)&&note.startTick>=range.startTick&&note.startTick<range.endTick).sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch).slice(0,64),phrase={trackId:track?.id||null,noteCount:notes.length,notes:notes.map(note=>({id:String(note.id),pitch:Number(note.pitch),degree:degreeForPitch(note.pitch),offsetTick:note.startTick-range.startTick,durationTicks:Number(note.durationTicks),velocity:Number(note.velocity)}))};phrase.intervals=phrase.notes.slice(1).map((note,index)=>note.pitch-phrase.notes[index].pitch);phrase.fingerprint=phrase.notes.length?phrase.notes.map(note=>`${note.degree}:${note.offsetTick}:${note.durationTicks}`).join('|'):'empty';return phrase};
    const sourcePhrase=phraseForTrack(sourceTrack),melodyPhrase=sourceTrack===canonicalMelody?clone(sourcePhrase):phraseForTrack(canonicalMelody);
    return{version:VERSION,key:parsed.label,mode:parsed.mode,range,trackRoles:roles.length?roles:['melody','drums','bass'],source:fromEvent?'midi-key-map':projectKey?'project-key':'default-local',sourcePhrase,melodyPhrase};
  }
  function degreeChord(parsed,degree){
    const mode=MODES[parsed.mode]||MODES.major,index=Math.max(1,Math.min(7,degree))-1,pc=(parsed.pc+mode.intervals[index])%12,names=parsed.preferFlats?FLAT_NAMES:SHARP_NAMES;
    return names[pc]+mode.qualities[index];
  }
  function chordsForKey(key,degrees){const parsed=parseKey(key);return degrees.map(degree=>degreeChord(parsed,degree));}
  function base(kind,index,context){
    const variant=String.fromCharCode(65+index),seed=`${context.key}|${context.range.startMeasure}|${context.range.endMeasure}|${variant}`;
    let hash=2166136261;for(const char of seed){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}
    const dependencies={melody:[],chord:[],section:[],arrangement:['section','chord'],continuation:['melody'],'lyrics-structure':['melody']}[kind]||[];
    return{version:VERSION,candidateMetadataVersion:1,kind,variant,synthetic:true,localOnly:true,key:context.key,source:context.source,range:clone(context.range),candidateFamily:{id:`local-family-${(hash>>>0).toString(16)}`,variant,key:context.key,range:clone(context.range),dependencies:dependencies.map(item=>({kind:item,candidateId:variant})),policy:'candidate-only'}};
  }
  function melody(index,context){
    const variants=[
      {label:'simple',contour:'stepwise',scaleDegrees:[1,2,3,2,1,3,2,1],durationUnits:[2,1,1,2,1,1,2,2],rhythm:'breathing',density:'low',register:'mid',motifBars:2,cadence:'tonic'},
      {label:'balanced',contour:'arch',scaleDegrees:[1,3,4,5,6,5,3,2],durationUnits:[1,1,2,2,1,1,1,3],rhythm:'balanced',density:'medium',register:'mid-high',motifBars:2,cadence:'open'},
      {label:'contrast',contour:'leap-and-answer',scaleDegrees:[1,5,3,6,4,2,7,1],durationUnits:[1,2,1,1,1,1,1,4],rhythm:'active',density:'high',register:'wide',motifBars:1,cadence:'resolved'}
    ][index];
    const family=base('melody',index,context),phraseEvents=variants.scaleDegrees.map((degree,eventIndex)=>({slot:eventIndex+1,degree,durationUnits:variants.durationUnits[eventIndex],phrase:eventIndex<4?1:2,role:eventIndex<4?'motif':'answer'}));
    const phrases=[{slot:1,role:'motif',eventSlots:[1,2,3,4],transform:'identity'},{slot:2,role:'answer',eventSlots:[5,6,7,8],transform:index===0?'return':index===1?'arch-answer':'contrast-answer',cadence:variants.cadence}];
    return{...family,...variants,phraseEvents,phrases,motif:{eventSlots:[1,2,3,4],repeatPolicy:index===0?'repeat-varied':index===1?'develop':'contrast'},summary:`${family.variant}: ${variants.contour} / motif→answer / ${variants.cadence} cadence`,applyPolicy:'candidate-only'};
  }
  function chord(index,context){
    const degreeSets=context.mode==='minor'?[[1,6,7,1],[1,4,6,7],[6,7,1,5]]:[[1,4,5,1],[1,6,4,5],[6,4,1,5]],degrees=degreeSets[index],progression=chordsForKey(context.key,degrees),rhythms=['one-per-bar','two-bar-anchor','turnaround'][index];
    const family=base('chord',index,context);
    return{...family,degrees,progression,harmonicRhythm:rhythms,keyPolicy:'candidate-only',bassCandidate:{candidateId:family.variant,role:'root-motion',familyId:family.candidateFamily.id},arrangementCandidateRef:{candidateId:family.variant,familyId:family.candidateFamily.id},melodyAlignment:{policy:'preview-only',sourcePhraseFingerprint:context.melodyPhrase?.fingerprint||context.sourcePhrase?.fingerprint||'empty'},summary:`${family.variant}: ${progression.join(' → ')} / ${rhythms}`,applyPolicy:'candidate-only'};
  }
  function section(index,context){
    const start=context.range.startMeasure,end=context.range.endMeasure,length=Math.max(1,end-start+1),names=['verse-shape','build-shape','contrast-shape'],plans=[
      [{label:'A',bars:Math.max(1,Math.floor(length/2))},{label:'A\'',bars:Math.max(1,length-Math.floor(length/2))}],
      [{label:'A',bars:Math.max(1,Math.ceil(length/3))},{label:'B',bars:Math.max(1,Math.ceil(length/3))},{label:'Lift',bars:Math.max(1,length-2*Math.ceil(length/3))}],
      [{label:'A',bars:Math.max(1,Math.floor(length/3))},{label:'C',bars:Math.max(1,length-Math.floor(length/3))}]
    ][index];
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start)throw Error('invalid-section-range');
    // Keep each named part inside the explicit candidate range, even for 1–2 bars.
    let remaining=length;
    const bounded=plans.flatMap((item,index)=>{const reserve=Math.min(plans.length-index-1,Math.max(0,remaining-1)),bars=Math.min(item.bars,remaining-reserve);remaining-=bars;return bars>0?[{...item,bars}]:[]});
    const family=base('section',index,context);
    return{...family,shape:names[index],plan:bounded,arrangementCandidateRef:{candidateId:family.variant,familyId:family.candidateFamily.id},summary:`${family.variant}: ${names[index]} / ${bounded.map(item=>item.label).join(' → ')}`,applyPolicy:'metadata-only'};
  }
  function sectionTimeline(value,session,core,selection=null){
    if(value?.kind!=='section'||!Array.isArray(value.plan)||!value.plan.length)throw Error('section-plan-required');
    const source=value.range,start=source?.startMeasure,end=source?.endMeasure;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start)throw Error('invalid-section-range');
    const from=selection===null?start:selection?.startMeasure,to=selection===null?end:selection?.endMeasure;
    if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<start||to>end||to<from)throw Error('invalid-section-selection');
    if(typeof core?.measureRangeToTicks!=='function')throw Error('section-timeline-unavailable');
    let cursor=start;
    const segments=[];
    for(const item of value.plan){
      if(typeof item?.label!=='string'||!item.label.trim()||!Number.isSafeInteger(item.bars)||item.bars<1)throw Error('invalid-section-part');
      const last=cursor+item.bars-1;
      if(!Number.isSafeInteger(last)||last>end)throw Error('section-plan-boundary');
      const firstSelected=Math.max(cursor,from),lastSelected=Math.min(last,to);
      if(firstSelected<=lastSelected){
        const ticks=core.measureRangeToTicks({startMeasure:firstSelected,endMeasure:lastSelected},session.midiData);
        if(!Number.isSafeInteger(ticks.startTick)||!Number.isSafeInteger(ticks.endTick)||ticks.startTick<0||ticks.endTick<=ticks.startTick)throw Error('invalid-section-ticks');
        if(segments.length&&segments.at(-1).endTick!==ticks.startTick)throw Error('section-timeline-gap');
        segments.push({label:item.label,startMeasure:firstSelected,endMeasure:lastSelected,startTick:ticks.startTick,endTick:ticks.endTick,bars:lastSelected-firstSelected+1,partial:firstSelected!==cursor||lastSelected!==last});
      }
      cursor=last+1;
    }
    if(cursor!==end+1)throw Error('section-plan-gap');
    return{kind:'section-timeline-preview',segments,mutates:false};
  }
  function lyricsTimeline(value,session,core,selection=null){
    if(value?.kind!=='lyrics-structure'||!Array.isArray(value.lines)||!value.lines.length)throw Error('lyrics-lines-required');
    const source=value.range,start=source?.startMeasure,end=source?.endMeasure;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start)throw Error('invalid-lyrics-range');
    const from=selection===null?start:selection?.startMeasure,to=selection===null?end:selection?.endMeasure;
    if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<start||to>end||to<from)throw Error('invalid-lyrics-selection');
    if(value.lineCount!==value.lines.length||value.lines.length>256)throw Error('invalid-lyrics-line-count');
    const variant=value.candidateFamily?.variant,ref=value.melodyCandidateRef;
    if(!variant||value.linkedMelodyCandidate!==variant||ref?.candidateId!==variant||!ref.familyId||ref.familyId!==value.candidateFamily?.id)throw Error('lyrics-melody-reference-mismatch');
    if(typeof core?.measureRangeToTicks!=='function')throw Error('lyrics-timeline-unavailable');
    let lastLine=0,lastMeasure=start;
    const slots=[];
    // Existing measureSlot is an anchor, not an inferred sung duration or note assignment.
    // Validate every source line before narrowing; malformed excluded lines also fail closed.
    for(const line of value.lines){
      if(!Number.isSafeInteger(line?.line)||line.line<=lastLine||!Number.isSafeInteger(line.measureSlot)||line.measureSlot<lastMeasure||line.measureSlot>end||!Number.isSafeInteger(line.melodyPhraseSlot)||line.melodyPhraseSlot<1)throw Error('invalid-lyrics-line');
      if(!Number.isSafeInteger(line.syllableCount)||line.syllableCount<1||line.syllableCount>256||!Array.isArray(line.stress)||line.stress.length!==line.syllableCount||line.stress.some(item=>item!=='strong'&&item!=='weak'))throw Error('invalid-lyrics-stress');
      lastLine=line.line;lastMeasure=line.measureSlot;
      const ticks=core.measureRangeToTicks({startMeasure:line.measureSlot,endMeasure:line.measureSlot},session.midiData);
      if(!Number.isSafeInteger(ticks.startTick)||!Number.isSafeInteger(ticks.endTick)||ticks.startTick<0||ticks.endTick<=ticks.startTick)throw Error('invalid-lyrics-ticks');
      if(line.measureSlot>=from&&line.measureSlot<=to)slots.push({line:line.line,melodySlot:line.melodyPhraseSlot,measureSlot:line.measureSlot,startTick:ticks.startTick,endTick:ticks.endTick,syllableCount:line.syllableCount,stress:clone(line.stress),stressPolicy:value.stressPolicy});
    }
    const range=core.measureRangeToTicks({startMeasure:from,endMeasure:to},session.midiData);
    if(!Number.isSafeInteger(range.startTick)||!Number.isSafeInteger(range.endTick)||range.startTick<0||range.endTick<=range.startTick||slots.some(slot=>slot.startTick<range.startTick||slot.endTick>range.endTick))throw Error('invalid-lyrics-ticks');
    return{kind:'lyrics-anchor-timeline-preview',linkedMelodyCandidate:variant,range:clone(range),slots,alignmentPolicy:'measure-anchor-only',mutates:false};
  }
  function lyricsMelodyMatches(value,workspace){
    const ref=value.melodyCandidateRef,matches=[];
    if(!Array.isArray(workspace?.candidateSets))throw Error('invalid-lyrics-melody-workspace');
    workspace.candidateSets.forEach((set,setIndex)=>{
      if(set?.kind!=='melody')return;
      if(!Array.isArray(set.candidates))throw Error('invalid-lyrics-melody-candidates');
      set.candidates.forEach((candidate,candidateIndex)=>{
        if(candidate?.candidateId===ref.candidateId&&candidate.value?.candidateFamily?.id===ref.familyId)matches.push({set,candidate,setIndex,candidateIndex});
      });
    });
    return matches;
  }
  // Occurrence locators are runtime-only, bound to the complete workspace.
  // They allow explicit inspection even when legacy deterministic IDs repeat.
  function lyricsMelodyReferenceChoices(value,workspace,session,core,selection=null){
    lyricsTimeline(value,session,core,selection);
    const workspaceSignature=JSON.stringify(workspace),matches=lyricsMelodyMatches(value,workspace);
    if(!matches.length)throw Error('missing-lyrics-melody-reference');
    return{kind:'lyrics-melody-reference-choices',workspaceSignature,mutates:false,choices:matches.map(({set,candidate,setIndex,candidateIndex})=>{
      const locator={setIndex,candidateIndex,workspaceSignature};let error='';
      try{lyricsMelodyReferencePreview(value,workspace,session,core,selection,locator)}catch(e){error=e.message}
      return{setIndex,candidateIndex,setId:set.setId,candidateId:candidate.candidateId,summary:String(candidate.value.summary||''),status:String(candidate.status||''),error};
    })};
  }
  // Inspect abstract events only; explicit choice does not rebind stored refs.
  function lyricsMelodyReferencePreview(value,workspace,session,core,selection=null,explicit=null){
    const timeline=lyricsTimeline(value,session,core,selection),ref=value.melodyCandidateRef;
    let matches=lyricsMelodyMatches(value,workspace);
    if(explicit!==null){
      if(!Number.isSafeInteger(explicit?.setIndex)||explicit.setIndex<0||!Number.isSafeInteger(explicit?.candidateIndex)||explicit.candidateIndex<0||typeof explicit.workspaceSignature!=='string')throw Error('invalid-lyrics-melody-choice');
      if(explicit.workspaceSignature!==JSON.stringify(workspace))throw Error('stale-lyrics-melody-choice');
      matches=matches.filter(item=>item.setIndex===explicit.setIndex&&item.candidateIndex===explicit.candidateIndex);
      if(matches.length!==1)throw Error('invalid-lyrics-melody-choice');
    }
    if(matches.length!==1)throw Error(matches.length?'ambiguous-lyrics-melody-reference':'missing-lyrics-melody-reference');
    const {set,candidate}=matches[0],melody=candidate.value;
    if(melody.kind!=='melody'||melody.variant!==ref.candidateId||melody.candidateFamily?.variant!==ref.candidateId||melody.key!==value.key||['startMeasure','endMeasure','startTick','endTick'].some(key=>melody.range?.[key]!==value.range?.[key]))throw Error('incompatible-lyrics-melody-reference');
    if(!Array.isArray(melody.phrases)||!melody.phrases.length||!Array.isArray(melody.phraseEvents)||!melody.phraseEvents.length)throw Error('invalid-lyrics-melody-phrases');
    const phrases=new Map(),events=new Map();
    for(const event of melody.phraseEvents){
      if(!Number.isSafeInteger(event?.slot)||event.slot<1||events.has(event.slot)||!Number.isSafeInteger(event.phrase)||event.phrase<1||!Number.isSafeInteger(event.degree)||event.degree<1||event.degree>7||!Number.isSafeInteger(event.durationUnits)||event.durationUnits<1)throw Error('invalid-lyrics-melody-event');
      events.set(event.slot,event);
    }
    const used=new Set();
    for(const phrase of melody.phrases){
      if(!Number.isSafeInteger(phrase?.slot)||phrase.slot<1||phrases.has(phrase.slot)||!Array.isArray(phrase.eventSlots)||!phrase.eventSlots.length)throw Error('invalid-lyrics-melody-phrase');
      for(const slot of phrase.eventSlots){
        if(!Number.isSafeInteger(slot)||used.has(slot)||!events.has(slot)||events.get(slot).phrase!==phrase.slot)throw Error('invalid-lyrics-melody-event-reference');
        used.add(slot);
      }
      phrases.set(phrase.slot,phrase);
    }
    if(used.size!==events.size)throw Error('unreferenced-lyrics-melody-event');
    // Validate excluded lines too: partial inspection must not hide bad refs.
    for(const line of value.lines)if(!phrases.has(line.melodyPhraseSlot))throw Error('missing-lyrics-melody-phrase');
    return{kind:'lyrics-melody-reference-preview',setId:set.setId,candidateId:ref.candidateId,familyId:ref.familyId,referenceChoice:explicit===null?null:{setIndex:explicit.setIndex,candidateIndex:explicit.candidateIndex},range:clone(timeline.range),lines:timeline.slots.map(line=>({...clone(line),eventSlots:clone(phrases.get(line.melodySlot).eventSlots),events:phrases.get(line.melodySlot).eventSlots.map(slot=>clone(events.get(slot)))})),mutates:false};
  }
  function lyricsMelodyReferenceRows(preview){
    if(preview?.kind!=='lyrics-melody-reference-preview')return[];
    return[`Melody reference verified: ${preview.candidateId} / set ${preview.setId}${preview.referenceChoice?` / explicit occurrence ${preview.referenceChoice.setIndex+1}:${preview.referenceChoice.candidateIndex+1}`:''} / ${preview.lines.length} Lyrics lines / M${preview.range.startMeasure}-${preview.range.endMeasure} / tick ${preview.range.startTick}-${preview.range.endTick} / abstract events only; note-syllable allocation unallocated`,...preview.lines.map(line=>`Lyrics line ${line.line}: anchor M${line.measureSlot} / tick ${line.startTick}-${line.endTick} / Melody phrase ${line.melodySlot} / event slots ${line.eventSlots.join(', ')} / degrees ${line.events.map(event=>event.degree).join(', ')} / duration units ${line.events.map(event=>event.durationUnits).join(', ')}`)];
  }
  function lyricsTimelineRows(timeline){
    if(timeline?.kind!=='lyrics-anchor-timeline-preview')return[];
    return[`Lyrics anchors: ${timeline.slots.length} / M${timeline.range.startMeasure}-${timeline.range.endMeasure} / tick ${timeline.range.startTick}-${timeline.range.endTick} / measure anchors only; note assignment unallocated; S=strong w=weak`,...timeline.slots.map(slot=>`Lyrics line ${slot.line}: anchor M${slot.measureSlot} / tick ${slot.startTick}-${slot.endTick} / ${slot.syllableCount} syllables / Melody ${timeline.linkedMelodyCandidate} phrase ${slot.melodySlot} / stress ${slot.stress.slice(0,16).map(item=>item==='strong'?'S':'w').join('')+(slot.stress.length>16?'…':'')}`)];
  }
  function arrangementTimeline(value,session,core,selection=null){
    if(value?.kind!=='arrangement')throw Error('arrangement-required');
    const start=value.range?.startMeasure,end=value.range?.endMeasure;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start)throw Error('invalid-arrangement-range');
    const from=selection===null?start:selection?.startMeasure,to=selection===null?end:selection?.endMeasure;
    if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<start||to>end||to<from)throw Error('invalid-arrangement-selection');
    if(!Number.isSafeInteger(value.entry)||value.entry<start||value.entry>end)throw Error('invalid-arrangement-entry');
    if(!Array.isArray(value.tracks)||!value.tracks.length||value.tracks.some(role=>typeof role!=='string'||!role.trim())||new Set(value.tracks).size!==value.tracks.length)throw Error('invalid-arrangement-tracks');
    const variant=value.candidateFamily?.variant,familyId=value.candidateFamily?.id;
    for(const ref of [value.sectionCandidateRef,value.chordCandidateRef])if(!variant||!familyId||ref?.candidateId!==variant||ref?.familyId!==familyId)throw Error('arrangement-reference-mismatch');
    if(typeof core?.measureRangeToTicks!=='function')throw Error('arrangement-timeline-unavailable');
    const resolve=(first,last)=>{
      const ticks=core.measureRangeToTicks({startMeasure:first,endMeasure:last},session.midiData);
      if(!Number.isSafeInteger(ticks.startTick)||!Number.isSafeInteger(ticks.endTick)||ticks.startTick<0||ticks.endTick<=ticks.startTick)throw Error('invalid-arrangement-ticks');
      return{startMeasure:first,endMeasure:last,startTick:ticks.startTick,endTick:ticks.endTick};
    };
    // An entry is a measure anchor. Do not infer an instrument, sounding duration,
    // MIDI notes or a sustain/entry policy when a partial window excludes it.
    const source=resolve(start,end),entry=resolve(value.entry,value.entry),range=resolve(from,to);
    if(entry.startTick<source.startTick||entry.endTick>source.endTick||range.startTick<source.startTick||range.endTick>source.endTick)throw Error('invalid-arrangement-ticks');
    const selected=value.entry>=from&&value.entry<=to;
    if(selected&&(entry.startTick<range.startTick||entry.endTick>range.endTick))throw Error('invalid-arrangement-ticks');
    return{kind:'arrangement-entry-timeline-preview',range,entryAnchors:selected?[{measureSlot:value.entry,startTick:entry.startTick,endTick:entry.endTick,tracks:clone(value.tracks)}]:[],tracks:clone(value.tracks),sectionCandidateRef:clone(value.sectionCandidateRef),chordCandidateRef:clone(value.chordCandidateRef),alignmentPolicy:'measure-entry-anchor-only',mutates:false};
  }
  function arrangementTimelineRows(timeline){
    if(timeline?.kind!=='arrangement-entry-timeline-preview')return[];
    return[`Arrangement entry anchors: ${timeline.entryAnchors.length} / M${timeline.range.startMeasure}-${timeline.range.endMeasure} / tick ${timeline.range.startTick}-${timeline.range.endTick} / measure entry anchors only; instrument rendering unallocated`,...timeline.entryAnchors.map(anchor=>`Arrangement entry: M${anchor.measureSlot} / tick ${anchor.startTick}-${anchor.endTick} / roles ${anchor.tracks.join(', ')} / Section ${timeline.sectionCandidateRef.candidateId} / Chord ${timeline.chordCandidateRef.candidateId}`)];
  }
  function arrangement(index,context){
    const roles=context.trackRoles,variants=[
      {density:'low',register:'mid',dynamics:'soft',entryOffsetBars:0,focus:['melody']},
      {density:'medium',register:'low-mid',dynamics:'medium',entryOffsetBars:1,focus:['melody','bass']},
      {density:'high',register:'wide',dynamics:'strong',entryOffsetBars:0,focus:['melody','bass','drums']}
    ][index],available=variants.focus.filter(role=>roles.includes(role));
    const family=base('arrangement',index,context);
    return{...family,tracks:available.length?available:roles.slice(0,index+1),...variants,entry:context.range.startMeasure+variants.entryOffsetBars,sectionCandidateRef:{candidateId:family.variant,familyId:family.candidateFamily.id},chordCandidateRef:{candidateId:family.variant,familyId:family.candidateFamily.id},summary:`${family.variant}: ${variants.density} / ${variants.register} / ${variants.dynamics}`,applyPolicy:'metadata-only'};
  }
  function continuation(index,context){
    const variants=[
      {method:'repeat-with-space',reuseMotif:true,variation:'rhythm-light',cadence:'open'},
      {method:'sequence',reuseMotif:true,variation:'pitch-sequence',cadence:'half'},
      {method:'answer',reuseMotif:false,variation:'contrast-answer',cadence:'resolved'}
    ][index];
    const family=base('continuation',index,context),source=context.sourcePhrase||{notes:[],fingerprint:'empty'},fallback=[1,3,2,1],motif=(source.notes||[]).slice(-4).map(note=>note.degree).filter(Boolean),seed=motif.length>=2?motif:fallback;
    const degrees=index===0?[...seed,...seed]:index===1?[...seed.map(degree=>Math.min(7,degree+1)),...seed]:[...seed.slice().reverse(),...seed.slice(0,-1),1];
    const durations=(source.notes||[]).slice(-seed.length).map(note=>Math.max(1,Math.min(4,Math.round(note.durationTicks/240))));while(durations.length<seed.length)durations.push(1);
    const phraseEvents=degrees.map((degree,eventIndex)=>({slot:eventIndex+1,degree,durationUnits:durations[eventIndex%durations.length],sourceEventSlot:eventIndex%seed.length+1,transform:variants.variation}));
    return{...family,...variants,derivedFromExisting:source.noteCount>0,sourcePhrase:{trackId:source.trackId||null,noteCount:source.noteCount||0,fingerprint:source.fingerprint||'empty',intervals:clone(source.intervals||[])},phraseEvents,phrases:[{slot:1,role:'continuation',eventSlots:phraseEvents.map(event=>event.slot),cadence:variants.cadence}],summary:`${family.variant}: ${variants.method} / ${source.noteCount||0} source notes / ${variants.cadence} cadence`,applyPolicy:'candidate-only'};
  }
  function lyrics(index,context){
    const variants=[
      {section:'verse',syllableCounts:[6,6,7,6],rhymePolicy:'loose',stressPolicy:'speech-first'},
      {section:'pre-chorus',syllableCounts:[6,7,7,8],rhymePolicy:'paired',stressPolicy:'build'},
      {section:'chorus',syllableCounts:[5,5,7,5],rhymePolicy:'repeat-hook',stressPolicy:'downbeat-hook'}
    ][index];
    const family=base('lyrics-structure',index,context),lineCount=variants.syllableCounts.length,span=Math.max(1,context.range.endMeasure-context.range.startMeasure+1),lines=variants.syllableCounts.map((syllableCount,lineIndex)=>({line:lineIndex+1,syllableCount,stress:Array.from({length:syllableCount},(_,syllableIndex)=>syllableIndex===0||syllableIndex===syllableCount-1?'strong':'weak'),melodyPhraseSlot:lineIndex%2+1,measureSlot:context.range.startMeasure+Math.min(span-1,Math.floor(lineIndex*span/lineCount))}));
    return{...family,...variants,lineCount,syllableTarget:index===0?'short':index===1?'rising':'hook',lines,linkedMelodyCandidate:family.variant,melodyCandidateRef:{candidateId:family.variant,familyId:family.candidateFamily.id},summary:`${family.variant}: ${variants.section} / ${lineCount} lines / syllable+stress slots`,applyPolicy:'metadata-only'};
  }
  function candidateValues(kind,context=defaultContext()){
    if(!KINDS.has(kind))throw Error('unsupported-composition-kind');
    const safe={...defaultContext(),...clone(context),range:{...defaultContext().range,...clone(context.range||{})}};
    return[0,1,2].map(index=>kind==='melody'?melody(index,safe):kind==='chord'?chord(index,safe):kind==='section'?section(index,safe):kind==='arrangement'?arrangement(index,safe):kind==='continuation'?continuation(index,safe):lyrics(index,safe));
  }
  function detailLines(value){
    if(!value||!value.kind)return[];
    const family=`Family ${value.candidateFamily?.variant||value.variant}`;
    if(value.kind==='melody')return[`Key ${value.key}`,`Motif → answer / ${value.cadence}`,`Degrees ${value.scaleDegrees.join('–')}`,`Rhythm ${value.rhythm}`,family];
    if(value.kind==='chord')return[`Key ${value.key}`,value.progression.join(' → '),`Bass root-motion ${value.bassCandidate?.candidateId}`,`Melody alignment Preview only`,family];
    if(value.kind==='section')return[`Shape ${value.shape}`,value.plan.map(item=>`${item.label} ${item.bars} bars`).join(' / '),`Arrangement ${value.arrangementCandidateRef?.candidateId}`,family];
    if(value.kind==='arrangement')return[`Tracks ${value.tracks.join(', ')||'none'}`,`Register ${value.register}`,`Dynamics ${value.dynamics}`,`Section/Chord ${value.sectionCandidateRef?.candidateId}`,family];
    if(value.kind==='continuation')return[`Method ${value.method}`,`Source notes ${value.sourcePhrase?.noteCount||0}`,`Variation ${value.variation}`,`Cadence ${value.cadence}`,family];
    return[`Section ${value.section}`,`${value.lineCount} lines / ${value.lines?.map(line=>line.syllableCount).join('-')} syllables`,`Stress ${value.stressPolicy}`,`Linked melody ${value.linkedMelodyCandidate}`,family];
  }
  root.MusicStudioAIComposition=Object.freeze({VERSION,defaultContext,keyFromEvent,parseKey,chordsForKey,createContext,candidateValues,sectionTimeline,lyricsTimeline,lyricsTimelineRows,lyricsMelodyReferenceChoices,lyricsMelodyReferencePreview,lyricsMelodyReferenceRows,arrangementTimeline,arrangementTimelineRows,detailLines});
})(typeof window!=='undefined'?window:globalThis);
