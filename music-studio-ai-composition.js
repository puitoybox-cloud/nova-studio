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
    const variant=String.fromCharCode(65+index),seed=`${context.key}|${context.range.startMeasure}|${context.range.endMeasure}|${variant}${context.generation?'|'+JSON.stringify(context.generation):''}`;
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
    let matches=lyricsMelodyMatches(value,workspace),choiceNumber=null;
    if(explicit!==null){
      if(!Number.isSafeInteger(explicit?.setIndex)||explicit.setIndex<0||!Number.isSafeInteger(explicit?.candidateIndex)||explicit.candidateIndex<0||typeof explicit.workspaceSignature!=='string')throw Error('invalid-lyrics-melody-choice');
      if(explicit.workspaceSignature!==JSON.stringify(workspace))throw Error('stale-lyrics-melody-choice');
      choiceNumber=matches.findIndex(item=>item.setIndex===explicit.setIndex&&item.candidateIndex===explicit.candidateIndex)+1;
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
    return{kind:'lyrics-melody-reference-preview',setId:set.setId,candidateId:ref.candidateId,familyId:ref.familyId,referenceChoiceNumber:choiceNumber,referenceChoice:explicit===null?null:{setIndex:explicit.setIndex,candidateIndex:explicit.candidateIndex},range:clone(timeline.range),lines:timeline.slots.map(line=>({...clone(line),eventSlots:clone(phrases.get(line.melodySlot).eventSlots),events:phrases.get(line.melodySlot).eventSlots.map(slot=>clone(events.get(slot)))})),mutates:false};
  }
  function lyricsMelodyReferenceRows(preview){
    if(preview?.kind!=='lyrics-melody-reference-preview')return[];
    return[`Melody reference verified: ${preview.candidateId} / set ${preview.setId}${preview.referenceChoice?` / explicit choice ${preview.referenceChoiceNumber}`:''} / ${preview.lines.length} Lyrics lines / M${preview.range.startMeasure}-${preview.range.endMeasure} / tick ${preview.range.startTick}-${preview.range.endTick} / abstract events only; note-syllable allocation unallocated`,...preview.lines.map(line=>`Lyrics line ${line.line}: anchor M${line.measureSlot} / tick ${line.startTick}-${line.endTick} / Melody phrase ${line.melodySlot} / event slots ${line.eventSlots.join(', ')} / degrees ${line.events.map(event=>event.degree).join(', ')} / duration units ${line.events.map(event=>event.durationUnits).join(', ')}`)];
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
  // Resolve stored identities only. Do not render instruments or infer harmony.
  function arrangementReferencePreview(value,workspace,session,core,selection=null){
    const timeline=arrangementTimeline(value,session,core,selection);
    if(!Array.isArray(workspace?.candidateSets))throw Error('invalid-arrangement-reference-workspace');
    const references=[];
    for(const kind of ['section','chord']){
      const ref=value[kind+'CandidateRef'],matches=[];
      for(const set of workspace.candidateSets){
        if(set?.kind!==kind)continue;
        if(!Array.isArray(set.candidates))throw Error('invalid-arrangement-reference-candidates');
        for(const candidate of set.candidates)if(candidate?.candidateId===ref.candidateId&&candidate.value?.candidateFamily?.id===ref.familyId)matches.push({set,candidate});
      }
      if(matches.length!==1)throw Error((matches.length?'ambiguous':'missing')+'-arrangement-'+kind+'-reference');
      const {set,candidate}=matches[0],target=candidate.value;
      if(target.kind!==kind||target.variant!==ref.candidateId||target.candidateFamily?.variant!==ref.candidateId||target.key!==value.key||['startMeasure','endMeasure','startTick','endTick'].some(key=>target.range?.[key]!==value.range?.[key]))throw Error('incompatible-arrangement-'+kind+'-reference');
      // Section already has an exact structural validator. Validate its whole
      // source before a partial inspection can hide an invalid excluded part.
      const section=kind==='section'?sectionTimeline(target,session,core,selection):null;
      references.push({kind,setId:set.setId,candidateId:candidate.candidateId,familyId:ref.familyId,value:clone(target),section});
    }
    return{kind:'arrangement-reference-preview',timeline,references,mutates:false};
  }
  // Observe the existing core role contract; never select an instrument or write a binding.
  function arrangementTrackPreview(value,workspace,session,core,selection=null){
    const preview=arrangementReferencePreview(value,workspace,session,core,selection),tracks=session?.midiData?.tracks;
    if(!Array.isArray(tracks)||typeof core?.resolveCoreTrackRole!=='function')throw Error('arrangement-tracks-unavailable');
    const ids=new Set();
    for(const track of tracks){
      if(typeof track?.id!=='string'||!track.id.trim())throw Error('invalid-arrangement-track-id');
      if(ids.has(track.id))throw Error('duplicate-arrangement-track-id');
      ids.add(track.id);
    }
    // Validate every declared role even if a partial window excludes the entry.
    const trackTargets=preview.timeline.tracks.map(role=>{
      const matches=tracks.filter(track=>core.resolveCoreTrackRole(track)===role);
      if(matches.length!==1)throw Error((matches.length?'ambiguous':'missing')+'-arrangement-track-role:'+role);
      return{role,trackId:matches[0].id};
    });
    return{...preview,trackTargets};
  }
  // Explicit inspection of one already verified role/Track pair. This is not a
  // destination binding or an authorization to render/write notes.
  function arrangementDestinationPreview(value,workspace,session,core,target,selection=null){
    const preview=arrangementTrackPreview(value,workspace,session,core,selection);
    if(typeof target?.role!=='string'||typeof target?.trackId!=='string'||!target.trackId.trim())throw Error('explicit-arrangement-destination-required');
    if(!preview.trackTargets.some(item=>item.role===target.role&&item.trackId===target.trackId))throw Error('incompatible-arrangement-destination');
    return{...preview,destinationInspection:{role:target.role,trackId:target.trackId,range:clone(preview.timeline.range),policy:'existing-role-identity-only',mutates:false}};
  }
  function arrangementReferenceRows(preview){
    if(preview?.kind!=='arrangement-reference-preview')return[];
    return['Arrangement reference identities verified / instrument rendering unallocated; harmony not assessed',...arrangementTimelineRows(preview.timeline),...(preview.trackTargets?["Existing role tracks verified / read-only; no destination binding",...preview.trackTargets.map(item=>`Role ${item.role}: existing Track ID ${item.trackId}`)]:[]),...(preview.destinationInspection?[`Explicit destination identity verified: ${preview.destinationInspection.role} / Track ID ${preview.destinationInspection.trackId} / M${preview.destinationInspection.range.startMeasure}-${preview.destinationInspection.range.endMeasure} / tick ${preview.destinationInspection.range.startTick}-${preview.destinationInspection.range.endTick} / read-only; write compatibility unassessed; no destination binding`]:[]),...preview.references.flatMap(ref=>[`${ref.kind} reference: ${ref.candidateId} / set ${ref.setId} / family ${ref.familyId}`,...(ref.section?.segments||[]).map(part=>`Referenced Section ${part.label}: M${part.startMeasure}-${part.endMeasure} / tick ${part.startTick}-${part.endTick}`)])];
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
  function generationOptions(input={}){
    const seed=input.seed??0,register=input.register??'mid';
    if(!Number.isSafeInteger(seed)||seed<0||seed>999999||!['low-mid','mid','mid-high'].includes(register))throw Error('invalid-generation-options');
    return{seed,register};
  }
  function generatedRecipe(value,context,index){
    if(!context.generation)return value;
    const settings=generationOptions(context.generation);value.generation=settings;
    if(!['melody','continuation'].includes(value.kind))return value;
    let state=(settings.seed+1+index*101)>>>0;const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state};
    value.register=settings.register;
    const events=value.phraseEvents.map((event,i)=>({...event,degree:i===0?event.degree:1+(event.degree-1+next()%3)%7,durationUnits:1+next()%4}));
    // Retain the original cadence and phrase slots, vary the interior motif/rhythm only.
    events[events.length-1].degree=value.phraseEvents.at(-1).degree;
    value.phraseEvents=events;value.scaleDegrees=events.map(e=>e.degree);value.durationUnits=events.map(e=>e.durationUnits);
    value.summary+=` / Local seed ${settings.seed} / ${settings.register}`;
    return value;
  }
  function candidateValues(kind,context=defaultContext()){
    if(!KINDS.has(kind))throw Error('unsupported-composition-kind');
    if(context.generation)generationOptions(context.generation);
    const safe={...defaultContext(),...clone(context),range:{...defaultContext().range,...clone(context.range||{})}};
    if(safe.generation)safe.generation=generationOptions(safe.generation);
    return[0,1,2].map(index=>generatedRecipe(kind==='melody'?melody(index,safe):kind==='chord'?chord(index,safe):kind==='section'?section(index,safe):kind==='arrangement'?arrangement(index,safe):kind==='continuation'?continuation(index,safe):lyrics(index,safe),safe,index));
  }
  // Bring an actual locally produced MIDI phrase into the existing candidate path.
  // This reads output files only: origin/model/license claims cannot be inferred from MIDI.
  function midiCandidate(bytes,file,context,index=0,ppq=480){
    if(!Number.isSafeInteger(index)||index<0||index>2)throw Error('MIDI候補は最大3個です。');
    if(!Number.isSafeInteger(ppq)||ppq<1||ppq>32767)throw Error('invalid-destination-ppq');
    if(!file||!Number.isSafeInteger(file.size)||file.size<1||file.size>1048576||! /\.(mid|midi)$/i.test(file.name||''))throw Error('1 MB以下の.mid / .midiを選んでください。');
    const length=bytes?.byteLength;if(length!==file.size)throw Error('MIDIサイズが一致しません。');
    const parser=root.MusicStudioMidiParser;if(!parser)throw Error('midi-parser-unavailable');
    const parsed=parser.parseMidiFile(bytes),n=parsed.normalized;
    if(!parsed.validation.importable||parsed.trailingBytes||n.warnings.some(w=>['unfinished-note','orphan-note-off','zero-duration','after-eot','invalid-meta'].includes(w.code)))throw Error('MIDIに未完了または不正なイベントがあります。');
    const tracks=n.tracks.filter(t=>t.notes.length);
    if(tracks.length!==1||tracks[0].drumCandidate||tracks[0].channels.length!==1)throw Error('単一の旋律Track / Channelを書き出してください。');
    const t=tracks[0];if(t.notes.length>4096)throw Error('MIDI候補は4096音までです。');
    if(n.tracks.some(t=>t.controlChanges.length||t.pitchBends.length||t.unsupportedEvents.length))throw Error('CC / Pitch Bend等を含む候補は通常のMIDI Importを使ってください。');
    const range=context?.range;
    if(!Number.isSafeInteger(range?.startTick)||!Number.isSafeInteger(range?.endTick)||range.startTick<0||range.endTick<=range.startTick)throw Error('invalid-import-range');
    const span=range.endTick-range.startTick,notes=t.notes.map(note=>{
      const startTick=Math.round(note.startTick*ppq/n.ppq),endTick=Math.round((note.startTick+note.durationTicks)*ppq/n.ppq);
      if(!Number.isSafeInteger(startTick)||!Number.isSafeInteger(endTick)||startTick<0||endTick<=startTick||endTick>span)throw Error('候補が選択範囲を超えるか、PPQ変換で音が短すぎます。');
      return{pitch:note.pitch,startTick,durationTicks:endTick-startTick,velocity:note.velocity};
    });
    return{version:1,kind:'melody',variant:String.fromCharCode(65+index),synthetic:false,localOnly:true,source:'imported-midi-output',key:context.key,range:clone(range),importedMidi:{version:1,ppq,sourcePpq:n.ppq,fileName:text(file.name,120),fileSize:file.size,sourceTrack:text(t.name,120),originVerified:false,timingPolicy:'source-beats-at-project-tempo',notes},summary:`${String.fromCharCode(65+index)}: MIDI Import / ${notes.length} notes / ${text(file.name,120)}`,applyPolicy:'candidate-only'};
  }
  // Immutable source binding: all notes and metadata remain in the project;
  // only a bounded phrase is sent to the offline model.
  function remakeSource(session,core,options={}){
    const track=core.getTrackById(session.midiData.tracks,core.currentTrackId(session));
    if(!track||((core.resolveCoreTrackRole(track)==='drums'||core.resolveTrackCapabilities?.(track)?.supportsDrumLabels)&&options.operation!=='delete'))throw Error('remake-melodic-track-required');
    const range=selectedRange(session,core),notes=track.notes.filter(n=>n.startTick>=range.startTick&&n.startTick<range.endTick).sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch);
    if(!notes.length||notes.length>(options.operation==='delete'?4096:256))throw Error(options.operation==='delete'?'削除候補は選択範囲の1〜4096音です。範囲を狭めてください。':'Remakeは選択範囲の1〜256音です。範囲を狭めてください。');
    if(notes.some(n=>n.startTick+n.durationTicks>range.endTick))throw Error('remake-source-crosses-range');
    return{version:1,trackId:track.id,range:clone(range),notes:clone(notes),midiSignature:JSON.stringify(session.midiData)};
  }
  function remakePrompt(source,ppq){
    if(!Number.isSafeInteger(ppq)||ppq<1)throw Error('invalid-remake-ppq');
    return source.notes.slice(0,64).map(n=>({pitch:n.pitch,velocity:n.velocity,startTick:Math.round((n.startTick-source.range.startTick)*480/ppq),durationTicks:Math.max(1,Math.round(n.durationTicks*480/ppq))}));
  }
  // Instrument selection is explicit GM routing, never claimed as model inference.
  function remakeNewTrack(session,role){
    const presets={piano:{program:0,name:'Piano（ピアノ）'},bass:{program:32,name:'Bass（ベース）'},strings:{program:48,name:'Strings（ストリングス）'}};
    const preset=presets[role];if(!preset)throw Error('unsupported-remake-instrument');
    const tracks=session.midiData.tracks;
    if(tracks.length>=64)throw Error('arrangement-track-limit');
    const used=new Set(tracks.map(t=>t.channel)),channel=Array.from({length:16},(_,i)=>i+1).find(c=>c!==10&&!used.has(c));
    if(!channel)throw Error('no-free-midi-channel');
    let id=`arrange-${role}`,index=2;while(tracks.some(t=>t.id===id))id=`arrange-${role}-${index++}`;
    return{id,name:preset.name,trackType:'midi-melodic',roleAssignment:role,role,channel,program:preset.program,muted:false,notes:[]};
  }
  function bindRemake(value,source,mode,amount=50,destinationTrackId=source.trackId,newTrack=null){
    if(!['revise','layer','delete'].includes(mode)||![25,50,100].includes(amount))throw Error('invalid-remake-operation');
    if(mode!=='delete'&&!value?.importedMidi)throw Error('remake-model-midi-required');
    const result=mode==='delete'?{version:1,kind:'melody',variant:'A',synthetic:true,localOnly:true,source:'structured-midi-delete',range:clone(source.range),summary:'Delete（選択Track・範囲の音符を削除する規則操作）',applyPolicy:'candidate-only'}:clone(value);
    if(typeof destinationTrackId!=='string'||!destinationTrackId||(mode!=='layer'&&destinationTrackId!==source.trackId))throw Error('invalid-remake-destination');
    if(newTrack&&(mode!=='layer'||newTrack.id!==destinationTrackId||newTrack.notes?.length!==0))throw Error('invalid-remake-new-track');
    result.remake={...clone(source),mode,amount,destinationTrackId,...(newTrack?{newTrack:clone(newTrack)}:{})};
    result.summary+=` / ${mode} / Track ${source.trackId} → ${destinationTrackId} / ${source.range.startMeasure}–${source.range.endMeasure}小節 / ${amount}%`;
    return result;
  }
  // Role hints are local rules, never calibrated probabilities or automatic assignments.
  function analyzeInstrumentRoles(session,core){
    const range=selectedRange(session,core),ppq=session.midiData.ppq||480;
    return(session.midiData.tracks||[]).map(track=>{
      const notes=(track.notes||[]).filter(n=>Number.isFinite(n.pitch)&&n.startTick<range.endTick&&n.startTick+n.durationTicks>range.startTick);
      const pitches=notes.map(n=>n.pitch).sort((a,b)=>a-b),median=pitches.length?pitches[Math.floor(pitches.length/2)]:null;
      const reasons=[],scores={melody:0,bass:0,harmony:0,drums:0};
      if(core.isDrumTrack?.(track)||track.channel===10){scores.drums+=10;reasons.push('Drum channel/type（打楽器チャンネル・種別）')}
      if(Number.isInteger(track.program)&&track.program>=32&&track.program<=39){scores.bass+=5;reasons.push('GM bass（GMベース音色）')}
      if(Number.isInteger(track.program)&&track.program>=48&&track.program<=55){scores.harmony+=4;reasons.push('GM strings（GMストリングス音色）')}
      if(median!==null&&median<48){scores.bass+=3;reasons.push('Low register（低音域）')}
      const starts=new Map();for(const n of notes)starts.set(n.startTick,(starts.get(n.startTick)||0)+1);
      const polyphony=starts.size?[...starts.values()].filter(n=>n>1).length/starts.size:0;
      if(polyphony>=0.3){scores.harmony+=4;reasons.push('Simultaneous notes（同時発音）')}
      if(notes.length&&polyphony<0.1&&median>=48){scores.melody+=2;reasons.push('Single-note upper line（中高音の単音列）')}
      const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]),role=ranked[0][1]?ranked[0][0]:'unknown',uncertainty=!notes.length||ranked[0][1]-ranked[1][1]<3?'high':'medium';
      return{trackId:track.id,name:track.name||track.id,channel:track.channel??null,program:track.program??null,noteCount:notes.length,minPitch:pitches[0]??null,maxPitch:pitches.at(-1)??null,medianPitch:median,notesPerQuarter:notes.length/Math.max(1,(range.endTick-range.startTick)/ppq),simultaneousStartRatio:polyphony,role,uncertainty,reasons,assignedRole:track.roleAssignment||track.part||'unassigned',method:'local-rules-v1',range:clone(range)};
    });
  }
  // Duration-weighted pitch-class matching. Scores are heuristic, not probabilities.
  function analyzeChords(session,core){
    const range=selectedRange(session,core),roles=analyzeInstrumentRoles(session,core);
    if(range.endMeasure-range.startMeasure>=64)throw Error('chord-analysis-limit-64-bars');
    const names=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
    const vocabulary=names.flatMap(name=>['','m','7','m7','maj7','dim'].map(q=>ensembleChords(name+q)[0]));
    const rows=[];
    for(let bar=range.startMeasure;bar<=range.endMeasure;bar++){
      const span=core.measureRangeToTicks({startMeasure:bar,endMeasure:bar},session.midiData),weights=Array(12).fill(0);
      for(const track of session.midiData.tracks||[]){
        const hint=roles.find(r=>r.trackId===track.id);
        if(hint?.role==='drums'||track.channel===10)continue;
        const role=track.roleAssignment||track.part||hint?.role;
        const weight=role==='melody'||role==='vocal'?0.25:role==='bass'?0.8:1;
        for(const n of track.notes||[]){
          if(!Number.isInteger(n.pitch)||n.pitch<0||n.pitch>127||!Number.isFinite(n.startTick)||!Number.isFinite(n.durationTicks)||n.durationTicks<=0)continue;
          const overlap=Math.max(0,Math.min(span.endTick,n.startTick+n.durationTicks)-Math.max(span.startTick,n.startTick));
          weights[n.pitch%12]+=overlap*weight;
        }
      }
      const total=weights.reduce((a,b)=>a+b,0),distinct=weights.filter(w=>w>0).length;
      const ranked=vocabulary.map(c=>({...c,score:total?c.pcs.reduce((sum,pc)=>sum+weights[pc],0)/total-0.15*c.pcs.filter(pc=>weights[pc]===0).length-0.025*(c.pcs.length-3):0})).sort((a,b)=>b.score-a.score||a.pcs.length-b.pcs.length||a.symbol.localeCompare(b.symbol));
      const best=ranked[0],margin=best.score-ranked[1].score;
      const known=total>0&&distinct>=3&&best.score>=0.75&&margin>=0.04;
      rows.push({measure:bar,startTick:span.startTick,endTick:span.endTick,symbol:known?best.symbol:null,root:known?best.root:null,confidence:known&&margin>=0.15?'high':known?'medium':'unknown',score:best.score,margin,candidates:total?ranked.slice(0,3):[],method:'duration-pitch-class-rules-v1'});
    }
    return{method:'duration-pitch-class-rules-v1',range:clone(range),midiSignature:JSON.stringify(session.midiData),rows};
  }
  // Explicit chord symbols drive local orchestration, never additional AI inference.
  function ensembleChords(text){
    if(typeof text!=='string'||text.length>256)throw Error('invalid-ensemble-chords');
    const symbols=text.trim()?text.trim().split(/\s+/):[];
    return symbols.map(symbol=>{
      const m=/^([A-G](?:#|b)?)(m7|maj7|7|m|dim)?$/.exec(symbol);
      if(!m||NOTE_PCS[m[1]]==null)throw Error('invalid-ensemble-chord: '+symbol);
      const root=NOTE_PCS[m[1]],quality=m[2]||'',intervals=quality==='dim'?[0,3,6]:quality==='m'?[0,3,7]:quality==='m7'?[0,3,7,10]:quality==='7'?[0,4,7,10]:quality==='maj7'?[0,4,7,11]:[0,4,7];
      return{symbol,root,pcs:intervals.map(i=>(root+i)%12)};
    });
  }
  function chordEnsembleNotes(value,source,session,core,role){
    const chords=ensembleChords(value.ensemble.chords||'');if(!chords.length)return null;
    const notes=[],ppq=session.midiData.ppq;
    const target=core.getTrackById(session.midiData.tracks,value.ensemble.section?.targets?.[role]),prior=(target?.notes||[]).filter(n=>n.startTick<source.range.startTick).sort((a,b)=>b.startTick-a.startTick||a.pitch-b.pitch),lastStart=prior[0]?.startTick,previous=prior.filter(n=>n.startTick===lastStart).map(n=>n.pitch).sort((a,b)=>a-b);
    const melody=session.midiData.tracks.find(t=>core.resolveCoreTrackRole(t)==='melody');
    if(!Number.isSafeInteger(ppq)||ppq<1||!['piano','bass','strings'].includes(role))throw Error('invalid-ensemble-timing');
    for(let bar=source.range.startMeasure;bar<=source.range.endMeasure;bar++){
      const span=core.measureRangeToTicks({startMeasure:bar,endMeasure:bar},session.midiData),chord=chords[(bar-source.range.startMeasure)%chords.length];
      const melodyPitches=(melody?.notes||[]).filter(n=>n.startTick<span.endTick&&n.startTick+n.durationTicks>span.startTick).map(n=>n.pitch).sort((a,b)=>a-b),ceiling=melodyPitches.length?Math.max(59,melodyPitches[0]-3):84;
      const low=role==='bass'?28:48,high=role==='bass'?55:Math.min(role==='strings'?79:84,ceiling);
      const pcs=role==='bass'?[chord.root]:chord.pcs;
      const pitches=pcs.map((pc,i)=>{
        const choices=Array.from({length:128},(_,n)=>n).filter(n=>n>=low&&n<=high&&n%12===pc);
        const anchor=previous[i]??(role==='bass'?36:55+i*5);
        return choices.sort((a,b)=>Math.abs(a-anchor)-Math.abs(b-anchor)||a-b)[0];
      }).sort((a,b)=>a-b);previous.splice(0,previous.length,...pitches);
      const density=value.ensemble.section?.density||'normal',factor=density==='sparse'?2:density==='rich'?0.5:1;
      const step=role==='strings'?span.endTick-span.startTick:Math.max(1,Math.round((role==='bass'?ppq:ppq*2)*factor));
      for(let tick=span.startTick;tick<span.endTick;tick+=step)for(const [voice,pitch] of pitches.entries()){
        if(role==='piano'&&value.variant==='C'&&voice!==Math.floor((tick-span.startTick)/step)%pitches.length)continue;
        const offset=role==='piano'&&value.variant==='B'?Math.min(step-1,Math.floor(voice*step/(pitches.length*2))):0,onset=Math.min(span.endTick-1,tick+offset);
        const baseVelocity=(role==='strings'?58:role==='bass'?82:72)+(density==='sparse'?-12:density==='rich'?8:0),blend=Math.min(1,(tick-span.startTick)/Math.max(1,ppq*2)),velocity=Math.round(prior.length?prior[0].velocity*(1-blend)+baseVelocity*blend:baseVelocity);
        // Rich bass alternates chord root and fifth; first beat always anchors root.
        let rendered=pitch;if(role==='bass'&&density==='rich'&&Math.round((tick-span.startTick)/step)%2===1){rendered=pitch+7;if(rendered>55)rendered-=12;}
        notes.push({pitch:rendered,startTick:onset-source.range.startTick,durationTicks:Math.max(1,Math.min(Math.round(step*(role==='strings'?1:0.9)),span.endTick-onset)),velocity:Math.max(1,Math.min(127,velocity))});
        if(notes.length>4096)throw Error('ensemble-note-limit');
      }
    }
    return notes;
  }
  function bindEnsemble(value,source,chords='',section=null){
    ensembleChords(chords);
    if(!value?.importedMidi?.notes?.length)throw Error('ensemble-model-notes-required');
    if(section?.targets&&(typeof section.targets!=='object'||Array.isArray(section.targets)||Object.entries(section.targets).some(([role,id])=>!['piano','bass','strings','drums'].includes(role)||typeof id!=='string'||id.length>200)||new Set(Object.values(section.targets).filter(Boolean)).size!==Object.values(section.targets).filter(Boolean).length))throw Error('invalid-section-targets');
    if(section){if(!['intro','verse','prechorus','chorus','bridge','interlude','outro'].includes(section.name)||!['sparse','normal','rich'].includes(section.density)||!Array.isArray(section.roles)||!section.roles.length||new Set(section.roles).size!==section.roles.length||section.roles.some(r=>!['piano','bass','strings','drums'].includes(r)))throw Error('invalid-ensemble-section');}
    const result=clone(value);result.ensemble={version:1,source:clone(source),roles:['piano','bass','strings','drums'],chords,...(section?{section:clone(section)}:{}),method:'model-phrase-plus-rule-orchestration-v1'};
    result.summary+=' / Ensemble（ピアノ・ベース・ストリングス・規則ドラム）';return result;
  }
  // Explicit section coverage; no inferred labels, gaps, or automatic adoption.
  function wholeSongPlan(project,session,core,workspace){
    const end=session.midiData.editor?.measureCount,settings=workspace?.sectionArrangements;
    if(!Number.isSafeInteger(end)||end<1||end>256)throw Error('whole-song-limit-256-bars');
    if(!Array.isArray(settings)||!settings.length)throw Error('全小節にSectionを設定してください。');
    const ordered=clone(settings).sort((a,b)=>a.range.startMeasure-b.range.startMeasure),chunks=[];
    let cursor=1;
    for(const setting of ordered){
      const r=setting.range;
      if(!Number.isSafeInteger(r?.startMeasure)||!Number.isSafeInteger(r?.endMeasure)||r.startMeasure!==cursor||r.endMeasure<cursor||r.endMeasure>end)throw Error('Sectionの重複・空白・曲外範囲を修正してください。');
      const actual=core.measureRangeToTicks(r,session.midiData);
      if(actual.startTick!==r.startTick||actual.endTick!==r.endTick)throw Error('拍子変更後のSectionを再設定してください。');
      bindEnsemble({importedMidi:{notes:[{}]},summary:''},{},'',setting);
      // One bar per inference keeps meter/key/tempo changes bounded and auditable.
      for(let bar=r.startMeasure;bar<=r.endMeasure;bar++){
        const range=core.measureRangeToTicks({startMeasure:bar,endMeasure:bar},session.midiData),copy=clone(session);copy.editRange={startMeasure:bar,endMeasure:bar};
        const context=createContext(project,copy,core),track=core.getTrackById(session.midiData.tracks,core.currentTrackId(session)),source={version:1,trackId:track?.id,range:clone(range),midiSignature:JSON.stringify(session.midiData),notes:(track?.notes||[]).filter(n=>n.startTick<range.endTick&&n.startTick+n.durationTicks>range.startTick).sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch).slice(0,64).map(n=>({...clone(n),startTick:Math.max(n.startTick,range.startTick),durationTicks:Math.min(n.startTick+n.durationTicks,range.endTick)-Math.max(n.startTick,range.startTick)}))},meter=root.MusicStudioMeterMap.positionAtTick(session.midiData,range.startTick);
        const tempo=[...(session.midiData.tempoMap||[])].filter(e=>e.tick<=range.startTick).sort((a,b)=>a.tick-b.tick).at(-1);
        const changes=[...(session.midiData.tempoMap||[]),...(session.midiData.keySignatureMap||[])].filter(e=>e.tick>range.startTick&&e.tick<range.endTick);
        if(changes.length)throw Error('小節途中のテンポ・キー変更は全曲モデル生成未対応です。');
        if(!track||core.isDrumTrack(track))throw Error('whole-song-melodic-source-required');
        const review=workspace.harmonyReview;
        if(review&&review.analysis?.midiSignature!==JSON.stringify(session.midiData))throw Error('コード確認を更新してください。');
        const chord=review?.analysis?.rows?.find(row=>row.measure===bar)?.symbol||'';
        ensembleChords(chord);
        chunks.push({range,source,section:clone(setting),key:context.key,bpm:Math.round(tempo?.bpm||session.midiData.tempo||72),numerator:meter.numerator,denominator:meter.denominator,chords:chord,modelInputNotes:Math.min(64,source.notes.length)});
      }
      cursor=r.endMeasure+1;
    }
    if(cursor!==end+1)throw Error('全小節にSectionを設定してください。');
    return{version:1,range:core.measureRangeToTicks({startMeasure:1,endMeasure:end},session.midiData),midiSignature:JSON.stringify(session.midiData),chunks,method:'sequential-bar-model-plus-rule-orchestration'};
  }
  function japaneseArrangement(instruction,workspace){
    if(typeof instruction!=='string'||instruction.length>500)throw Error('invalid-arrangement-instruction');
    const clauses=instruction.trim().split(/[。\n;；]+/).map(s=>s.trim()).filter(Boolean);
    if(!clauses.length)throw Error('対応する定型指示を入力してください。');
    const settings=clone(workspace.sectionArrangements||[]),changes=[];
    for(const clause of clauses){
      if(clause==='元のメロディーは変更しない'){changes.push('全曲編曲は伴奏のみ。元メロディーTrackは差し替え禁止。');continue;}
      const match=/^(Aメロ|Bメロ|サビ|イントロ|間奏|アウトロ)(?:は|を|の)(静かに|豪華に|ベースだけ作り直す|ストリングスを追加する|もう少し切なく|ピアノ中心に)$/.exec(clause);
      if(!match)throw Error('未対応・曖昧な指示です。対象Sectionと定型表現を指定してください。');
      const name=({Aメロ:'verse',Bメロ:'prechorus',サビ:'chorus',イントロ:'intro',間奏:'interlude',アウトロ:'outro'})[match[1]],targets=settings.filter(s=>s.name===name);
      if(!targets.length)throw Error('対象Sectionがありません。先に小節範囲を設定してください。');
      for(const setting of targets){
        const op=match[2];if(op==='静かに')setting.density='sparse';
        else if(op==='豪華に')setting.density='rich';
        else if(op==='ベースだけ作り直す'){if(!setting.targets?.bass)throw Error('既存Bassの差し替え先を設定してください。');setting.roles=['bass'];}
        else if(op==='ストリングスを追加する'){setting.roles=['strings'];setting.targets={strings:''};}
        else if(op==='もう少し切なく')setting.mood='切ない';
        else if(op==='ピアノ中心に')setting.roles=['piano'];
        changes.push(`M${setting.range.startMeasure}–${setting.range.endMeasure} ${match[1]}: ${op} / ${setting.density} / ${setting.roles.join(', ')}${setting.mood?' / '+setting.mood:''}`);
      }
    }
    return{version:1,instruction,settings,changes,method:'finite-japanese-arrangement-commands',mutates:false};
  }
  function wholeSongCandidate(plan,parts,index){
    if(!plan?.chunks?.length||parts.length!==plan.chunks.length||parts.some(p=>!p?.ensemble||p.ensemble.wholeSong))throw Error('incomplete-whole-song');
    const value=clone(parts[0]);value.variant=String.fromCharCode(65+index);value.range=clone(plan.range);
    value.ensemble.source.range=clone(plan.range);value.ensemble.source.midiSignature=plan.midiSignature;
    value.ensemble.wholeSong={version:1,method:plan.method,parts:clone(parts)};
    value.summary=`${value.variant}: Whole song（全曲） / ${parts.length}小節を順次モデル生成・規則編曲 / 元メロディー保持`;
    return value;
  }
  function detailLines(value){
    if(!value||!value.kind)return[];
    if(value.ensemble?.wholeSong)return ['全曲候補 / 1小節ずつ順次モデル推論。各小節の選択Track先頭64音まで入力。',...value.ensemble.wholeSong.parts.map(p=>`M${p.range.startMeasure}: ${p.ensemble.section.name} / ${p.ensemble.section.density} / 入力${Math.min(64,p.ensemble.source.notes.length)}音 / ${p.ensemble.chords||'コード未指定'} / 伴奏・ドラムは規則補完`),'音楽品質・聴感は未受入。Preview→Listen→小節・楽器を指定してApply。'];
    if(value.ensemble)return[...(value.ensemble.chords?[`コード連動（規則処理）: ${value.ensemble.chords} / 根音ベース・和音ピアノ・近接声部ストリングス。1小節1コード。`]:[]),value.ensemble.chords?'Piano・Bass・Strings: 指定コードの規則伴奏。音高・リズムはAI推論ではありません。':'Piano: モデル出力を配置 / Bass・Strings: モデル出力の音高を規則で音域・密度調整','Drums: 拍子に沿う規則パターン。AIドラム推論ではありません。','元曲は保持。楽器・小節を選び、試聴してから一括採用。全パートの自然さは未受入。'];
    if(value.remake)return[`Track ${value.remake.trackId} / M${value.range.startMeasure}–${value.range.endMeasure}`,value.remake.mode==='delete'?'規則による削除候補・AI判断ではありません':value.remake.mode==='revise'?`モデル出力の音高を元音符へ対応・変更対象 ${value.remake.amount}%（時刻・長さ・強さを保持）`:'モデル出力を指定Trackへ追加する候補・元音符保持','Tempo・Meterを保持。追加先は既存Trackまたは新規Piano/Bass/Strings。音色指定は規則処理。複数楽器一括生成・自由文の完全理解は未対応。', 'Preview → Listen → Apply。未採用の元音符は保存データに残ります。'];
    if(value.source==='imported-midi-output')return[`File ${value.importedMidi?.fileName||''}`,`Notes ${value.importedMidi?.notes?.length||0}`,`Source PPQ ${value.importedMidi?.sourcePpq} → ${value.importedMidi?.ppq}`, '拍位置を保持・Projectのテンポ/拍子/音源を使用', '生成モデル・素材ライセンスはMIDIから確認できません'];
    const family=`Family ${value.candidateFamily?.variant||value.variant}`;
    if(value.kind==='melody')return[`Key ${value.key}`,`Motif → answer / ${value.cadence}`,`Degrees ${value.scaleDegrees.join('–')}`,`Rhythm ${value.rhythm}`,family];
    if(value.kind==='chord')return[`Key ${value.key}`,value.progression.join(' → '),`Bass root-motion ${value.bassCandidate?.candidateId}`,`Melody alignment Preview only`,family];
    if(value.kind==='section')return[`Shape ${value.shape}`,value.plan.map(item=>`${item.label} ${item.bars} bars`).join(' / '),`Arrangement ${value.arrangementCandidateRef?.candidateId}`,family];
    if(value.kind==='arrangement')return[`Tracks ${value.tracks.join(', ')||'none'}`,`Register ${value.register}`,`Dynamics ${value.dynamics}`,`Section/Chord ${value.sectionCandidateRef?.candidateId}`,family];
    if(value.kind==='continuation')return[`Method ${value.method}`,`Source notes ${value.sourcePhrase?.noteCount||0}`,`Variation ${value.variation}`,`Cadence ${value.cadence}`,family];
    return[`Section ${value.section}`,`${value.lineCount} lines / ${value.lines?.map(line=>line.syllableCount).join('-')} syllables`,`Stress ${value.stressPolicy}`,`Linked melody ${value.linkedMelodyCandidate}`,family];
  }
  root.MusicStudioAIComposition=Object.freeze({VERSION,japaneseArrangement,wholeSongPlan,wholeSongCandidate,analyzeChords,ensembleChords,chordEnsembleNotes,analyzeInstrumentRoles,bindEnsemble,remakeNewTrack,remakeSource,remakePrompt,bindRemake,defaultContext,midiCandidate,generationOptions,keyFromEvent,parseKey,chordsForKey,createContext,candidateValues,sectionTimeline,lyricsTimeline,lyricsTimelineRows,lyricsMelodyReferenceChoices,lyricsMelodyReferencePreview,lyricsMelodyReferenceRows,arrangementTimeline,arrangementTimelineRows,arrangementReferencePreview,arrangementTrackPreview,arrangementDestinationPreview,arrangementReferenceRows,detailLines});
})(typeof window!=='undefined'?window:globalThis);
