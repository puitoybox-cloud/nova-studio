/* Music Studio local-first AI Assistant UI model. No network access. */
(function(root){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const text=(value,max=2000)=>String(value??'').trim().slice(0,max);
  function requireWorkflow(){const api=root.MusicStudioAIWorkflow;if(!api)throw Error('ai-workflow-unavailable');return api}
  function createState(project,options={}){
    const api=requireWorkflow(),workspace=options.workspace?api.parseWorkspace(JSON.stringify(options.workspace),project):api.createWorkspace(project,{createdAt:options.createdAt||'local-session'});
    return{version:1,workspace,activeView:'assistant',instruction:'',activeRequestId:null,activeCandidateSetId:null,newSongDraft:{title:'',bpm:120,numerator:4,denominator:4,key:'',bars:16,mood:'',genre:'',tracks:['melody','drums','bass'],sections:[],memo:''},newSongPreview:null,lastError:null};
  }
  function validateState(state){return Boolean(state)&&state.version===1&&requireWorkflow().validateWorkspace(state.workspace).ok}
  function setInstruction(state,value){if(!validateState(state))throw Error('invalid-ai-ui-state');state.instruction=text(value);return state.instruction}
  function previewEdit(state,project,session,core,input={}){
    if(!validateState(state))throw Error('invalid-ai-ui-state');
    const instruction=text(input.instruction||state.instruction);if(!instruction)throw Error('instruction-required');
    const request=requireWorkflow().createEditRequest(state.workspace,project,session,core,{...input,instruction});
    state.activeRequestId=request.requestId;state.lastError=null;return clone(request);
  }
  async function runPreview(state,core,adapter){
    if(!state.activeRequestId)throw Error('request-required');
    const result=await requireWorkflow().runLocalAdapter(state.workspace,state.activeRequestId,adapter,core);
    return clone(result);
  }
  function rejectActive(state,reason){if(!state.activeRequestId)throw Error('request-required');const result=requireWorkflow().rejectEdit(state.workspace,state.activeRequestId,reason);state.activeRequestId=null;return result}
  function applyActive(state,project,session,core,selection){if(!state.activeRequestId)throw Error('request-required');const result=requireWorkflow().applyEdit(state.workspace,state.activeRequestId,project,session,core,selection);state.activeRequestId=null;return result}
  function setNewSongDraft(state,patch={}){
    if(!validateState(state))throw Error('invalid-ai-ui-state');
    const allowed=['title','bpm','numerator','denominator','key','bars','mood','genre','tracks','sections','memo'];
    for(const key of allowed)if(Object.prototype.hasOwnProperty.call(patch,key))state.newSongDraft[key]=clone(patch[key]);
    state.newSongPreview=null;return clone(state.newSongDraft);
  }
  function previewNewSong(state){const plan=requireWorkflow().newSongPlan(state.newSongDraft);state.newSongPreview=plan;return clone(plan)}
  function confirmNewSong(state,options={}){if(!state.newSongPreview)throw Error('new-song-preview-required');return requireWorkflow().confirmNewSongPlan(state.newSongPreview,options)}
  function createCandidates(state,kind,context,candidates,options={}){const set=requireWorkflow().createCandidateSet(state.workspace,kind,context,candidates,options);state.activeCandidateSetId=set.setId;return clone(set)}
  function decideCandidate(state,candidateId,decision,selection=null){if(!state.activeCandidateSetId)throw Error('candidate-set-required');return requireWorkflow().decideCandidate(state.workspace,state.activeCandidateSetId,candidateId,decision,selection)}
  function viewModel(state,project,session,core){
    if(!validateState(state))throw Error('invalid-ai-ui-state');
    let target=null;try{target=requireWorkflow().createSafeContext(project,session,core).target}catch(_){}
    const request=state.workspace.requests.find(item=>item.requestId===state.activeRequestId)||null;
    const set=state.workspace.candidateSets.find(item=>item.setId===state.activeCandidateSetId)||null;
    return{mode:'local-only',networkAllowed:false,activeView:state.activeView,instruction:state.instruction,target:clone(target),request:clone(request),candidateSet:clone(set),newSongDraft:clone(state.newSongDraft),newSongPreview:clone(state.newSongPreview),history:clone(state.workspace.history)};
  }
  function workspaceForRevision(state,projectId,revision){if(!validateState(state)||state.workspace.projectId!==projectId)throw Error('invalid-ai-ui-state');const workspace=clone(state.workspace);workspace.baseRevision=revision;workspace.updatedAt=new Date().toISOString();return workspace}
  root.MusicStudioAIAssistantUI={createState,validateState,setInstruction,previewEdit,runPreview,rejectActive,applyActive,setNewSongDraft,previewNewSong,confirmNewSong,createCandidates,decideCandidate,viewModel,workspaceForRevision};
})(typeof window!=='undefined'?window:globalThis);
