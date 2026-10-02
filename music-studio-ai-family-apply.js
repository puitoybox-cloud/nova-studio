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
  function createPlan(workspace,variant,project,session,core,options={}){
    const {family,composition,materializer}=deps(),kinds=normalizeKinds(options.kinds),collected=family.familyMembers(workspace,String(variant)),issues=familyIssues(collected,kinds),context=composition.createContext(project||{},session,core),melody=canonicalMelodyTrack(session,core),components=[];
    for(const kind of kinds){
      const member=collected.members[kind];if(!member)continue;
      const candidate=member.candidate,previewOptions={project,context};
      if(['melody','continuation'].includes(kind)&&melody)previewOptions.trackId=melody.id;
      let bundle=null;
      try{bundle=materializer.createPreview(session,core,candidate,previewOptions)}catch(error){issues.push(`preview:${kind}:${error.message}`)}
      if(options.metadataOnly===true&&bundle?.type==='midi-preview')bundle={version:bundle.version,type:'metadata-preview',candidateId:bundle.candidateId,kind:bundle.kind,value:clone(bundle.value),companion:clone(bundle.companion),mutates:false};
      const range=options.measureRange?clone(options.measureRange):null;
      if(bundle?.type==='midi-preview'&&range){try{materializer.selectionForRange(bundle,range)}catch(error){issues.push(`selection:${kind}:${error.message}`)}}
      components.push({kind,setId:member.setId,candidateId:candidate.candidateId,candidateSignature:sig(candidate.value),familyId:candidate.value?.candidateFamily?.id||null,targetTrackId:bundle?.targetTrackId||null,targetTrackRole:bundle?.targetTrackId?core.resolveCoreTrackRole(core.getTrackById(session.midiData.tracks,bundle.targetTrackId)):null,range:bundle?.request?.range?clone(bundle.request.range):clone(candidate.value?.range||null),selection:range,bundle:bundle?clone(bundle):null,previewType:bundle?.type||'unavailable',changes:bundle?.result?.changes?{updates:bundle.result.changes.updates.length,adds:bundle.result.changes.adds.length,deletes:bundle.result.changes.deleteNoteIds.length}:null,metadata:bundle?.type==='midi-preview'?null:clone(candidate.value)})
    }
    const familyId=collected.familyIds.length===1?collected.familyIds[0]:null,source={projectId:String(project?.projectId||''),projectRevision:project?.revision??null,midiData:clone(session.midiData),midiSignature:sig(session.midiData),editRange:rangeOf(session),workspaceSignature:sig(workspace),familySignatures:Object.fromEntries(components.map(component=>[component.kind,component.candidateSignature]))};
    const plan={version:VERSION,kind:'family-apply-plan',variant:String(variant),familyId,kinds,metadataOnly:options.metadataOnly===true,source,components,unchanged:clone(UNCHANGED),issues:[...new Set(issues)],mutates:false};
    plan.planId=sig({version:plan.version,variant:plan.variant,familyId:plan.familyId,kinds:plan.kinds,metadataOnly:plan.metadataOnly,source:{projectId:source.projectId,projectRevision:source.projectRevision,midiSignature:source.midiSignature,workspaceSignature:source.workspaceSignature},components:components.map(component=>({kind:component.kind,setId:component.setId,candidateId:component.candidateId,candidateSignature:component.candidateSignature,selection:component.selection}))});
    return plan
  }
  function validateCurrent(plan,workspace,project,session,core){
    const errors=[...(plan?.issues||[])];
    if(!plan||plan.version!==VERSION||plan.kind!=='family-apply-plan')return['invalid-family-plan'];
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
      const selection={mode:'family-apply',metadataOnly:plan.metadataOnly,familyId:plan.familyId,variant:plan.variant,components:clone(plan.kinds),targetTrackId:component.targetTrackId,measures:component.selection?[component.selection.startMeasure,component.selection.endMeasure]:null};
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
    const commit=core.applyAtomicMidiSnapshot(session,plan.source.midiData,preflight.midiDataAfter,{workspace,before:clone(workspace),after:preflight.workspaceAfter});
    if(commit?.applied!==true)return{applied:false,reason:commit?.reason||'atomic-commit-failed',errors:[commit?.reason||'atomic-commit-failed'],mutates:false};
    return{applied:true,changed:commit.changed===true,planId:plan.planId,familyId:plan.familyId,variant:plan.variant,kinds:clone(plan.kinds),undoUnits:commit.changed===true?1:0,componentResults:clone(preflight.componentResults)}
  }
  function planRows(plan){
    if(!plan||plan.kind!=='family-apply-plan')return[];
    const rows=[`Family ${plan.variant} / ${plan.familyId||'family-id-missing'}`,`Project revision: ${plan.source.projectRevision??'none'}`];
    for(const component of plan.components){
      if(component.previewType==='midi-preview')rows.push(`${component.kind}: ${component.targetTrackId} / M${component.range?.startMeasure||'?'}-${component.range?.endMeasure||'?'} / tick ${component.range?.startTick??'?'}-${component.range?.endTick??'?'} / +${component.changes?.adds||0} ~${component.changes?.updates||0} -${component.changes?.deletes||0}`);
      else rows.push(`${component.kind}: metadata only`)
    }
    if(plan.unchanged?.length)rows.push(`Unchanged: ${plan.unchanged.join(', ')}`);
    if(plan.issues.length)rows.push(`Blocked: ${plan.issues.join(', ')}`);
    return rows
  }
  root.MusicStudioAIFamilyApply=Object.freeze({VERSION,DEFAULT_KINDS:clone(DEFAULT_KINDS),UNCHANGED:clone(UNCHANGED),createPlan,simulate,applyPlan,planRows});
})(typeof window!=='undefined'?window:globalThis);
