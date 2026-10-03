/* Music Studio atomic candidate-family Apply foundation. Local-only; no provider/network path. */
(function(root){
  'use strict';
  const VERSION=1;
  const DEFAULT_KINDS=['melody','chord','section','arrangement','lyrics-structure'];
  const UNCHANGED=['drums','tempo-map','time-signature-map','key-signature-map','markers','lock-protection'];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function deps(){
    const family=root.MusicStudioAIFamilyPreview,composition=root.MusicStudioAIComposition,materializer=root.MusicStudioAICandidatePreview,workflow=root.MusicStudioAIWorkflow;
    if(!family||!composition||!materializer||!workflow)throw Error('family-apply-dependency-unavailable');
    return{family,composition,materializer,workflow}
  }
  function sig(value){const api=root.MusicStudioAIWorkflow;return api?.signature?api.signature(value):JSON.stringify(value)}
  function rangeOf(session){return clone(session?.editRange||session?.midiData?.editor?.editRange||null)}
  function canonicalMelodyTrack(session,core){return(session?.midiData?.tracks||[]).find(track=>core.resolveCoreTrackRole?.(track)==='melody')||null}
  function normalizeKinds(value){
    if(Array.isArray(value)&&!value.length)throw Error('family-component-selection-required');
    const source=Array.isArray(value)?value:DEFAULT_KINDS,result=[...new Set(source.map(String))];
    if(result.some(kind=>!['melody','chord','section','arrangement','continuation','lyrics-structure'].includes(kind)))throw Error('invalid-family-apply-kind');
    if(result.includes('melody')&&result.includes('continuation'))throw Error('conflicting-melody-components');
    return result
  }
  function familyIssues(collected,kinds){
    const issues=[];
    if(collected.familyIds.length!==1)issues.push(collected.familyIds.length>1?'family-mismatch':'family-id-missing');
    for(const kind of kinds){
      const member=collected.members[kind];
      if(!member){issues.push(`missing-component:${kind}`);continue}
      const candidate=member.candidate;
      if(candidate.status!=='available')issues.push(`candidate-not-available:${kind}`);
      const family=candidate.value?.candidateFamily;
      if(!family||family.variant!==collected.variant)issues.push(`variant-mismatch:${kind}`);
      for(const dependency of family?.dependencies||[]){
        const dep=collected.members[dependency.kind];
        if(!dep)issues.push(`missing-dependency:${kind}->${dependency.kind}`);
        else if(dep.candidate.candidateId!==dependency.candidateId)issues.push(`dependency-variant-mismatch:${kind}->${dependency.kind}`);
        else if(!kinds.includes(dependency.kind))issues.push(`dependency-not-selected:${kind}->${dependency.kind}`)
      }
    }
    return[...new Set(issues)]
  }
  function sectionState(project){return{present:Object.hasOwn(project||{},'sections'),items:Object.hasOwn(project||{},'sections')?clone(project.sections):[]}}
  function projectSectionPlan(components,workspace,project,session,core,familyId,variant){
    if(typeof core.projectSectionsSnapshot!=='function')throw Error('project-sections-history-unavailable');
    const before=core.projectSectionsSnapshot(session,project),component=components.find(item=>item.kind==='section'),sets=workspace.candidateSets.filter(set=>set.setId===component?.setId);
    if(sets.length!==1)throw Error('ambiguous-project-section-candidate');
    const candidate=sets[0].candidates.find(item=>item.candidateId===component?.candidateId);
    if(candidate?.value?.kind!=='section'||candidate.value.candidateFamily?.id!==familyId||candidate.value.variant!==variant)throw Error('project-section-candidate-mismatch');
    const selection=component.selection==null?null:{startMeasure:Number(component.selection.startMeasure),endMeasure:Number(component.selection.endMeasure)},parts=root.MusicStudioAIComposition.sectionTimeline(candidate.value,session,core,selection).segments;
    if(!Array.isArray(before.items))throw Error('invalid-project-sections');
    if(!parts?.length)throw Error('section-timeline-required');
    const validSpan=item=>Number.isSafeInteger(item?.startTick)&&Number.isSafeInteger(item?.endTick)&&item.startTick>=0&&item.endTick>item.startTick;
    if(before.items.some(item=>!validSpan(item)))throw Error('existing-section-range-unverified');
    const additions=parts.map(part=>({id:`ai-section-${familyId}-${variant}-${part.startTick}-${part.endTick}`,label:part.label,startMeasure:part.startMeasure,endMeasure:part.endMeasure,startTick:part.startTick,endTick:part.endTick,adopted:true,source:{kind:'ai-family-section',familyId,variant,setId:component.setId,candidateId:component.candidateId}}));
    const ids=new Set(before.items.map(item=>item.id));
    for(const item of additions){
      if(!validSpan(item))throw Error('invalid-section-ticks');
      if(ids.has(item.id))throw Error('project-section-id-conflict');
      if(before.items.some(existing=>existing.startTick<item.endTick&&item.startTick<existing.endTick))throw Error('project-section-overlap');
      ids.add(item.id);
    }
    return{before,after:{present:true,items:[...clone(before.items),...clone(additions)]},additions,projectSource:sectionState(project)};
  }
  function createPlan(workspace,variant,project,session,core,options={}){
    const {family,composition,materializer}=deps(),kinds=normalizeKinds(options.kinds),collected=family.familyMembers(workspace,String(variant)),issues=familyIssues(collected,kinds),context=composition.createContext(project||{},session,core),melody=canonicalMelodyTrack(session,core),components=[];
    for(const kind of kinds){
      const member=collected.members[kind];if(!member)continue;
      const candidate=member.candidate,previewOptions={project,context};
      if(['melody','continuation'].includes(kind)&&melody)previewOptions.trackId=melody.id;
      let bundle=null;
      try{bundle=materializer.createPreview(session,core,candidate,previewOptions)}catch(error){issues.push(`preview:${kind}:${error.message}`)}
      if(options.metadataOnly===true&&bundle?.type==='midi-preview')bundle={version:bundle.version,type:'metadata-preview',candidateId:bundle.candidateId,kind:bundle.kind,value:clone(bundle.value),companion:clone(bundle.companion),mutates:false};
      const range=options.measureRange==null?null:clone(options.measureRange);
      let selectedRange=null,selectedChanges=null;
      // The selected interval is an adoption contract even when no MIDI is written.
      // Validate against each original candidate, before metadata-only conversion
      // can bypass the MIDI selection guard. Never rewrite the source candidate.
      if(bundle){try{
        const sourceRange=candidate.value?.range;
        const sourceStart=Number(sourceRange?.startMeasure),sourceEnd=Number(sourceRange?.endMeasure);
        if(!Number.isInteger(sourceStart)||!Number.isInteger(sourceEnd)||sourceStart<1||sourceEnd<sourceStart)throw Error('invalid-candidate-range');
        const startMeasure=Number(range===null?sourceStart:range.startMeasure),endMeasure=Number(range===null?sourceEnd:range.endMeasure);
        if(!Number.isInteger(startMeasure)||!Number.isInteger(endMeasure)||startMeasure<sourceStart||endMeasure>sourceEnd||endMeasure<startMeasure)throw Error('invalid-preview-selection');
        const selection={startMeasure,endMeasure};
        selectedRange=core.measureRangeToTicks(selection,session.midiData);
        if(!Number.isFinite(selectedRange.startTick)||!Number.isFinite(selectedRange.endTick)||selectedRange.endTick<=selectedRange.startTick)throw Error('invalid-selection-ticks');
        if(kind==='section')bundle.companion.timeline=composition.sectionTimeline(candidate.value,session,core,selection);
        if(kind==='lyrics-structure'){bundle.companion.timeline=composition.lyricsTimeline(candidate.value,session,core,selection);bundle.companion.phraseSlots=clone(bundle.companion.timeline.slots)}
        if(bundle.type==='midi-preview'&&range){const subset=materializer.previewSelection(bundle,session,core,selection);selectedChanges=subset.result.changes}
      }catch(error){issues.push(`selection:${kind}:${error.message}`)}}
      const displayedChanges=selectedChanges||bundle?.result?.changes;
      components.push({kind,setId:member.setId,candidateId:candidate.candidateId,candidateSignature:sig(candidate.value),familyId:candidate.value?.candidateFamily?.id||null,targetTrackId:bundle?.targetTrackId||null,targetTrackRole:bundle?.targetTrackId?core.resolveCoreTrackRole(core.getTrackById(session.midiData.tracks,bundle.targetTrackId)):null,range:selectedRange?clone(selectedRange):bundle?.request?.range?clone(bundle.request.range):clone(candidate.value?.range||null),selection:range,bundle:bundle?clone(bundle):null,previewType:bundle?.type||'unavailable',changes:displayedChanges?{updates:displayedChanges.updates.length,adds:displayedChanges.adds.length,deletes:displayedChanges.deleteNoteIds.length}:null,metadata:bundle?.type==='midi-preview'?null:clone(candidate.value)})
    }
    const familyId=collected.familyIds.length===1?collected.familyIds[0]:null,source={projectId:String(project?.projectId||''),projectRevision:project?.revision??null,midiData:clone(session.midiData),midiSignature:sig(session.midiData),editRange:rangeOf(session),workspaceSignature:sig(workspace),familySignatures:Object.fromEntries(components.map(component=>[component.kind,component.candidateSignature]))};
    let projectSections=null;
    if(options.applyProjectSections===true){
      if(!kinds.includes('section'))issues.push('project-section-component-required');
      else if(options.metadataOnly===true)issues.push('project-section-metadata-only-conflict');
      else try{projectSections=projectSectionPlan(components,workspace,project,session,core,familyId,String(variant))}catch(error){issues.push(error.message)}
    }
    const plan={applyProjectSections:options.applyProjectSections===true,projectSections,version:VERSION,kind:'family-apply-plan',variant:String(variant),familyId,kinds,metadataOnly:options.metadataOnly===true,source,components,unchanged:clone(UNCHANGED),issues:[...new Set(issues)],mutates:false};
    plan.planId=sig({version:plan.version,variant:plan.variant,familyId:plan.familyId,kinds:plan.kinds,metadataOnly:plan.metadataOnly,applyProjectSections:plan.applyProjectSections,projectSections:plan.projectSections,source:{projectId:source.projectId,projectRevision:source.projectRevision,midiSignature:source.midiSignature,workspaceSignature:source.workspaceSignature},components:components.map(component=>({kind:component.kind,setId:component.setId,candidateId:component.candidateId,candidateSignature:component.candidateSignature,selection:component.selection}))});
    return plan
  }
  function validateCurrent(plan,workspace,project,session,core){
    const errors=[...(plan?.issues||[])];
    if(!plan||plan.version!==VERSION||plan.kind!=='family-apply-plan')return['invalid-family-plan'];
    if(!plan.applyProjectSections&&plan.projectSections)errors.push('unexpected-project-section-plan');
    if(plan.applyProjectSections){
      if(!plan.kinds.includes('section')||plan.metadataOnly)errors.push('invalid-project-section-mode');
      if(!plan.projectSections)errors.push('project-section-plan-required');
      else{try{if(!same(projectSectionPlan(plan.components,workspace,project,session,core,plan.familyId,plan.variant),plan.projectSections))errors.push('invalid-project-section-plan')}catch(error){errors.push(`project-sections:${error.message}`)}if(!same(core.projectSectionsSnapshot?.(session,project),plan.projectSections.before))errors.push('stale-project-sections');if(!same(sectionState(project),plan.projectSections.projectSource))errors.push('stale-project-sections-source');}
    }
    if(String(project?.projectId||'')!==plan.source.projectId)errors.push('stale-project-id');
    if((project?.revision??null)!==plan.source.projectRevision)errors.push('stale-project-revision');
    if(!same(rangeOf(session),plan.source.editRange))errors.push('stale-range');
    for(const component of plan.components){
      if(component.targetTrackId){
        const track=core.getTrackById(session?.midiData?.tracks||[],component.targetTrackId);
        if(!track)errors.push(`stale-track:${component.kind}`);
        else if(core.resolveCoreTrackRole(track)!==component.targetTrackRole)errors.push(`stale-track-role:${component.kind}`)
      }
    }
    if(sig(workspace)!==plan.source.workspaceSignature)errors.push('stale-workspace');
    if(sig(session?.midiData)!==plan.source.midiSignature)errors.push('stale-project');
    if(Object.isFrozen(workspace)||Object.isSealed(workspace)||!Object.isExtensible(workspace)||Reflect.ownKeys(workspace).some(key=>{const d=Object.getOwnPropertyDescriptor(workspace,key);return !d.configurable||d.writable!==true}))errors.push('workspace-not-mutable');
    return[...new Set(errors)]
  }
  function stagedWorkspace(plan,workspace,workflow){
    const staged=clone(workspace);
    for(const component of plan.components){
      const selection={mode:'family-apply',metadataOnly:plan.metadataOnly,familyId:plan.familyId,variant:plan.variant,components:clone(plan.kinds),targetTrackId:component.targetTrackId,measures:component.selection?[component.selection.startMeasure,component.selection.endMeasure]:null,ticks:component.range&&Number.isFinite(component.range.startTick)&&Number.isFinite(component.range.endTick)?[component.range.startTick,component.range.endTick]:null};
      workflow.decideCandidate(staged,component.setId,component.candidateId,'adopt',selection)
    }
    return staged
  }
  function simulate(plan,workspace,project,session,core){
    const {materializer,workflow}=deps(),errors=validateCurrent(plan,workspace,project,session,core);
    if(errors.length)return{ok:false,errors,mutates:false};
    const working=clone(session);
    try{if(working.coordinatedTimeline)core.enableCoordinatedTimeline(working)}catch(error){return{ok:false,errors:[`timeline:${error.message}`],mutates:false}}
    const results=[];
    for(const component of plan.components){
      if(component.previewType!=='midi-preview'){results.push({kind:component.kind,type:'metadata',ok:true});continue}
      const track=core.getTrackById(working.midiData.tracks,component.targetTrackId);
      if(!track){errors.push(`stale-track:${component.kind}`);break}
      core.selectTrackById(working,component.targetTrackId);
      try{
        const result=materializer.applyPreview(working,core,clone(component.bundle),component.selection);
        results.push({kind:component.kind,type:'midi',ok:true,targetTrackId:component.targetTrackId,result:clone(result)})
      }catch(error){errors.push(`preflight:${component.kind}:${error.message}`);break}
    }
    if(errors.length)return{ok:false,errors:[...new Set(errors)],componentResults:results,mutates:false};
    let workspaceAfter;
    try{workspaceAfter=stagedWorkspace(plan,workspace,workflow)}catch(error){return{ok:false,errors:[`metadata-stage:${error.message}`],componentResults:results,mutates:false}}
    return{ok:true,errors:[],componentResults:results,midiDataAfter:clone(working.midiData),workspaceAfter,mutates:false}
  }
  function applyPlan(plan,workspace,project,session,core){
    const preflight=simulate(plan,workspace,project,session,core);
    if(!preflight.ok)return{applied:false,reason:'preflight-failed',errors:clone(preflight.errors),mutates:false};
    const commit=core.applyAtomicMidiSnapshot(session,plan.source.midiData,preflight.midiDataAfter,{workspace,before:clone(workspace),after:preflight.workspaceAfter,...(plan.projectSections?{projectSections:{before:plan.projectSections.before,after:plan.projectSections.after}}:{})});
    if(commit?.applied!==true)return{applied:false,reason:commit?.reason||'atomic-commit-failed',errors:[commit?.reason||'atomic-commit-failed'],mutates:false};
    return{applied:true,changed:commit.changed===true,planId:plan.planId,familyId:plan.familyId,variant:plan.variant,kinds:clone(plan.kinds),undoUnits:commit.changed===true?1:0,componentResults:clone(preflight.componentResults)}
  }
  function planRows(plan){
    if(!plan||plan.kind!=='family-apply-plan')return[];
    const rows=[`Family ${plan.variant} / ${plan.familyId||'family-id-missing'}`,`Project revision: ${plan.source.projectRevision??'none'}`];
    for(const component of plan.components){
      if(component.previewType==='midi-preview')rows.push(`${component.kind}: ${component.targetTrackId} / M${component.range?.startMeasure||'?'}-${component.range?.endMeasure||'?'} / tick ${component.range?.startTick??'?'}-${component.range?.endTick??'?'} / +${component.changes?.adds||0} ~${component.changes?.updates||0} -${component.changes?.deletes||0}`);
      else rows.push(`${component.kind}: ${component.kind==='section'&&plan.applyProjectSections?'Project Sections（曲構成）':'metadata only'} / M${component.range?.startMeasure||'?'}-${component.range?.endMeasure||'?'} / tick ${component.range?.startTick??'?'}-${component.range?.endTick??'?'}`)
    }
    for(const component of plan.components)for(const part of component.bundle?.companion?.timeline?.segments||[])rows.push(`Section ${part.label}: M${part.startMeasure}-${part.endMeasure} / tick ${part.startTick}-${part.endTick}${part.partial?' / partial':''}`);
    for(const component of plan.components)rows.push(...root.MusicStudioAIComposition.lyricsTimelineRows(component.bundle?.companion?.timeline));
    if(plan.applyProjectSections)rows.push(`Project Sections: append ${plan.projectSections?.additions?.length||0} / existing retained`);
    if(plan.unchanged?.length)rows.push(`Unchanged: ${plan.unchanged.join(', ')}`);
    if(plan.issues.length)rows.push(`Blocked: ${plan.issues.join(', ')}`);
    return rows
  }
  root.MusicStudioAIFamilyApply=Object.freeze({VERSION,DEFAULT_KINDS:clone(DEFAULT_KINDS),UNCHANGED:clone(UNCHANGED),createPlan,simulate,applyPlan,planRows});
})(typeof window!=='undefined'?window:globalThis);
