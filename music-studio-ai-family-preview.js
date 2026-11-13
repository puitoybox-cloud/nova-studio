/* Music Studio candidate-family preview aggregator. Local-only and non-mutating. */
(function(root){
  'use strict';
  const VERSION=1;
  const KINDS=['section','arrangement','chord','melody','continuation','lyrics-structure'];
  const clone=value=>JSON.parse(JSON.stringify(value));
  function latestSet(workspace,kind){return[...(workspace?.candidateSets||[])].reverse().find(set=>set?.kind===kind)||null}
  function candidateIn(set,variant){return set?.candidates?.find(candidate=>candidate?.candidateId===variant||candidate?.value?.candidateFamily?.variant===variant)||null}
  function familyMembers(workspace,variant){
    const members={},missing=[];
    for(const kind of KINDS){const set=latestSet(workspace,kind),candidate=candidateIn(set,variant);if(candidate)members[kind]={setId:set.setId,candidate:clone(candidate)};else missing.push(kind)}
    const ids=Object.values(members).map(item=>item.candidate?.value?.candidateFamily?.id).filter(Boolean),familyIds=[...new Set(ids)];
    return{version:VERSION,variant,members,missing,familyIds,complete:missing.length===0&&familyIds.length===1};
  }
  function canonicalMelodyTrack(session,core){
    return(session?.midiData?.tracks||[]).find(track=>core.resolveCoreTrackRole?.(track)==='melody')||null;
  }
  function previewSummary(bundle){
    if(!bundle)return{type:'unavailable'};
    if(bundle.type==='metadata-preview')return{type:'metadata-preview',kind:bundle.kind,mutates:false,companion:clone(bundle.companion||null)};
    const changes=bundle.result?.changes||{updates:[],adds:[],deleteNoteIds:[]};
    return{type:'midi-preview',kind:bundle.kind,targetTrackId:bundle.targetTrackId,mutates:false,changes:{updates:changes.updates.length,adds:changes.adds.length,deletes:changes.deleteNoteIds.length},companion:clone(bundle.companion||null)};
  }
  function createFamilyPreview(workspace,variant,session,core,project,options={}){
    if(!/^[A-Z]$/.test(String(variant||'')))throw Error('invalid-family-variant');
    const composition=options.composition||root.MusicStudioAIComposition,materializer=options.materializer||root.MusicStudioAICandidatePreview;
    if(!composition||!materializer)throw Error('family-preview-dependency-unavailable');
    const collected=familyMembers(workspace,String(variant)),melodyTrack=canonicalMelodyTrack(session,core),context=composition.createContext(project||{},session,core),components={};
    for(const kind of KINDS){
      const member=collected.members[kind];if(!member)continue;
      const opts={project,context};if(['melody','continuation'].includes(kind)&&melodyTrack)opts.trackId=melodyTrack.id;
      const bundle=materializer.createPreview(session,core,member.candidate,opts);
      components[kind]={setId:member.setId,candidateId:member.candidate.candidateId,value:clone(member.candidate.value),preview:previewSummary(bundle)};
    }
    const chord=components.chord?.preview?.companion,lyrics=components['lyrics-structure']?.preview?.companion,arrangement=components.arrangement?.preview?.companion,section=components.section?.preview?.companion;
    const outside=(chord?.melodyAlignment?.slots||[]).reduce((count,slot)=>count+(slot.outsideChordToneNoteIds?.length||0),0);
    return{version:VERSION,kind:'candidate-family-preview',variant:String(variant),familyId:collected.familyIds.length===1?collected.familyIds[0]:null,complete:collected.complete,missing:clone(collected.missing),familyMismatch:collected.familyIds.length>1,components,summary:{sectionShape:section?.shape||components.section?.value?.shape||null,arrangementTracks:clone(arrangement?.tracks||components.arrangement?.value?.tracks||[]),chordProgression:clone(components.chord?.value?.progression||[]),melodyAlignmentReviewCount:outside,lyricsPhraseSlots:lyrics?.phraseSlots?.length||0},mutates:false};
  }
  function familyRows(preview){
    if(!preview||preview.kind!=='candidate-family-preview')return[];
    const rows=[];
    if(preview.summary.sectionShape)rows.push(`Section: ${preview.summary.sectionShape}`);
    for(const part of preview.components.section?.preview?.companion?.timeline?.segments||[])rows.push(`Section ${part.label}: M${part.startMeasure}-${part.endMeasure} / tick ${part.startTick}-${part.endTick}`);
    if(preview.summary.arrangementTracks.length)rows.push(`Arrangement: ${preview.summary.arrangementTracks.join(', ')}`);
    if(preview.summary.chordProgression.length)rows.push(`Chord: ${preview.summary.chordProgression.join(' → ')}`);
    rows.push(`Melody alignment review: ${preview.summary.melodyAlignmentReviewCount}`);
    rows.push(`Lyrics phrase slots: ${preview.summary.lyricsPhraseSlots}`);
    rows.push(...root.MusicStudioAIComposition.arrangementTimelineRows(preview.components.arrangement?.preview?.companion?.timeline));
    rows.push(...root.MusicStudioAIComposition.lyricsTimelineRows(preview.components['lyrics-structure']?.preview?.companion?.timeline));
    rows.push(...root.MusicStudioAICandidatePreview.continuationSourceRows(preview.components.continuation?.preview?.companion?.sourcePreview));
    if(preview.missing.length)rows.push(`Missing: ${preview.missing.join(', ')}`);
    return rows;
  }
  root.MusicStudioAIFamilyPreview=Object.freeze({VERSION,KINDS:clone(KINDS),latestSet,familyMembers,createFamilyPreview,familyRows});
})(typeof window!=='undefined'?window:globalThis);
