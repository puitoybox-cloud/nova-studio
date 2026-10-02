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
    const roles=[...new Set((session?.midiData?.tracks||[]).map(track=>core?.resolveCoreTrackRole?.(track)||track.roleAssignment||track.part||null).filter(Boolean))];
    return{version:VERSION,key:parsed.label,mode:parsed.mode,range,trackRoles:roles.length?roles:['melody','drums','bass'],source:fromEvent?'midi-key-map':projectKey?'project-key':'default-local'};
  }
  function degreeChord(parsed,degree){
    const mode=MODES[parsed.mode]||MODES.major,index=Math.max(1,Math.min(7,degree))-1,pc=(parsed.pc+mode.intervals[index])%12,names=parsed.preferFlats?FLAT_NAMES:SHARP_NAMES;
    return names[pc]+mode.qualities[index];
  }
  function chordsForKey(key,degrees){const parsed=parseKey(key);return degrees.map(degree=>degreeChord(parsed,degree));}
  function base(kind,index,context){
    return{version:VERSION,kind,variant:String.fromCharCode(65+index),synthetic:true,localOnly:true,key:context.key,source:context.source,range:clone(context.range)};
  }
  function melody(index,context){
    const variants=[
      {label:'simple',contour:'stepwise',scaleDegrees:[1,2,3,2,1,3,2,1],rhythm:'sparse',density:'low',register:'mid',motifBars:2},
      {label:'balanced',contour:'arch',scaleDegrees:[1,3,4,5,6,5,3,2],rhythm:'balanced',density:'medium',register:'mid-high',motifBars:2},
      {label:'contrast',contour:'leap-and-answer',scaleDegrees:[1,5,3,6,4,2,7,1],rhythm:'active',density:'high',register:'wide',motifBars:1}
    ][index];
    return{...base('melody',index,context),...variants,summary:`${String.fromCharCode(65+index)}: ${variants.contour} / ${variants.rhythm} / degree ${variants.scaleDegrees.join('-')}`,applyPolicy:'candidate-only'};
  }
  function chord(index,context){
    const degreeSets=context.mode==='minor'?[[1,6,7,1],[1,4,6,7],[6,7,1,5]]:[[1,4,5,1],[1,6,4,5],[6,4,1,5]],degrees=degreeSets[index],progression=chordsForKey(context.key,degrees),rhythms=['one-per-bar','two-bar-anchor','turnaround'][index];
    return{...base('chord',index,context),degrees,progression,harmonicRhythm:rhythms,keyPolicy:'candidate-only',summary:`${String.fromCharCode(65+index)}: ${progression.join(' → ')} / ${rhythms}`,applyPolicy:'candidate-only'};
  }
  function section(index,context){
    const start=context.range.startMeasure,end=context.range.endMeasure,length=Math.max(1,end-start+1),names=['verse-shape','build-shape','contrast-shape'],plans=[
      [{label:'A',bars:Math.max(1,Math.floor(length/2))},{label:'A\'',bars:Math.max(1,length-Math.floor(length/2))}],
      [{label:'A',bars:Math.max(1,Math.ceil(length/3))},{label:'B',bars:Math.max(1,Math.ceil(length/3))},{label:'Lift',bars:Math.max(1,length-2*Math.ceil(length/3))}],
      [{label:'A',bars:Math.max(1,Math.floor(length/3))},{label:'C',bars:Math.max(1,length-Math.floor(length/3))}]
    ][index];
    return{...base('section',index,context),shape:names[index],plan:plans,summary:`${String.fromCharCode(65+index)}: ${names[index]} / ${plans.map(item=>item.label).join(' → ')}`,applyPolicy:'metadata-only'};
  }
  function arrangement(index,context){
    const roles=context.trackRoles,variants=[
      {density:'low',register:'mid',dynamics:'soft',entryOffsetBars:0,focus:['melody']},
      {density:'medium',register:'low-mid',dynamics:'medium',entryOffsetBars:1,focus:['melody','bass']},
      {density:'high',register:'wide',dynamics:'strong',entryOffsetBars:0,focus:['melody','bass','drums']}
    ][index],available=variants.focus.filter(role=>roles.includes(role));
    return{...base('arrangement',index,context),tracks:available.length?available:roles.slice(0,index+1),...variants,entry:context.range.startMeasure+variants.entryOffsetBars,summary:`${String.fromCharCode(65+index)}: ${variants.density} / ${variants.register} / ${variants.dynamics}`,applyPolicy:'metadata-only'};
  }
  function continuation(index,context){
    const variants=[
      {method:'repeat-with-space',reuseMotif:true,variation:'rhythm-light',cadence:'open'},
      {method:'sequence',reuseMotif:true,variation:'pitch-sequence',cadence:'half'},
      {method:'answer',reuseMotif:false,variation:'contrast-answer',cadence:'resolved'}
    ][index];
    return{...base('continuation',index,context),...variants,summary:`${String.fromCharCode(65+index)}: ${variants.method} / ${variants.cadence} cadence`,applyPolicy:'candidate-only'};
  }
  function lyrics(index,context){
    const variants=[
      {section:'verse',lineCount:4,syllableTarget:'short',rhymePolicy:'loose',stressPolicy:'speech-first'},
      {section:'pre-chorus',lineCount:4,syllableTarget:'rising',rhymePolicy:'paired',stressPolicy:'build'},
      {section:'chorus',lineCount:4,syllableTarget:'hook',rhymePolicy:'repeat-hook',stressPolicy:'downbeat-hook'}
    ][index];
    return{...base('lyrics-structure',index,context),...variants,linkedMelodyCandidate:String.fromCharCode(65+index),summary:`${String.fromCharCode(65+index)}: ${variants.section} / ${variants.lineCount} lines / ${variants.stressPolicy}`,applyPolicy:'metadata-only'};
  }
  function candidateValues(kind,context=defaultContext()){
    if(!KINDS.has(kind))throw Error('unsupported-composition-kind');
    const safe={...defaultContext(),...clone(context),range:{...defaultContext().range,...clone(context.range||{})}};
    return[0,1,2].map(index=>kind==='melody'?melody(index,safe):kind==='chord'?chord(index,safe):kind==='section'?section(index,safe):kind==='arrangement'?arrangement(index,safe):kind==='continuation'?continuation(index,safe):lyrics(index,safe));
  }
  function detailLines(value){
    if(!value||!value.kind)return[];
    if(value.kind==='melody')return[`Key ${value.key}`,`Contour ${value.contour}`,`Degrees ${value.scaleDegrees.join('–')}`,`Rhythm ${value.rhythm}`];
    if(value.kind==='chord')return[`Key ${value.key}`,value.progression.join(' → '),`Harmonic rhythm ${value.harmonicRhythm}`];
    if(value.kind==='section')return[`Shape ${value.shape}`,value.plan.map(item=>`${item.label} ${item.bars} bars`).join(' / ')];
    if(value.kind==='arrangement')return[`Tracks ${value.tracks.join(', ')||'none'}`,`Register ${value.register}`,`Dynamics ${value.dynamics}`,`Entry bar ${value.entry}`];
    if(value.kind==='continuation')return[`Method ${value.method}`,`Variation ${value.variation}`,`Cadence ${value.cadence}`];
    return[`Section ${value.section}`,`${value.lineCount} lines`,`Stress ${value.stressPolicy}`,`Linked melody ${value.linkedMelodyCandidate}`];
  }
  root.MusicStudioAIComposition=Object.freeze({VERSION,defaultContext,keyFromEvent,parseKey,chordsForKey,createContext,candidateValues,detailLines});
})(typeof window!=='undefined'?window:globalThis);
